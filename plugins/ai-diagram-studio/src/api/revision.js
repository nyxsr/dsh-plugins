/**
 * Revision manager: apply a bounded set of semantic edits to a canonical IR.
 *
 * Natural-language instructions are parsed into explicit operations. Every
 * operation states exactly which node/edge it touches so unrelated elements can
 * be verified as preserved.
 */
import { cloneIR, findNode, normalizeIR } from '../ir/index.js'
import { DiagramError } from '../core/errors.js'
import { nodeId, edgeId } from '../core/ids.js'
import { oneLine } from '../core/text.js'

const TYPE_WORDS = {
  entity: ['tabel', 'table', 'entitas', 'entity'],
  class: ['class', 'kelas'],
  component: ['komponen', 'component', 'service', 'layanan', 'database', 'queue', 'worker', 'gateway', 'cache'],
  state: ['state', 'status', 'keadaan'],
  usecase: ['use case', 'usecase', 'fungsionalitas'],
  participant: ['participant', 'partisipan', 'aktor', 'actor', 'peserta'],
  process: ['proses', 'process', 'langkah', 'step'],
  action: ['aksi', 'action', 'aktivitas', 'activity'],
}

function norm(value) {
  return String(value ?? '').toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function simpleSingular(value) {
  const text = norm(value)
  if (text.endsWith('ies')) return `${text.slice(0, -3)}y`
  if (text.endsWith('ses')) return text.slice(0, -2)
  if (text.endsWith('s') && !text.endsWith('ss')) return text.slice(0, -1)
  return text
}

export function findNodeByText(ir, value) {
  const wanted = norm(value)
  if (!wanted) return null
  const exact = ir.nodes.find(node => norm(node.id) === wanted || norm(node.name) === wanted || norm(node.label) === wanted)
  if (exact) return exact
  const singular = simpleSingular(wanted)
  return ir.nodes.find(node => {
    const name = norm(node.name)
    return name === singular || simpleSingular(name) === singular || name.includes(wanted) || wanted.includes(name)
  }) ?? null
}

function uniqueNodeId(ir, base) {
  return nodeId(base, new Set(ir.nodes.map(node => node.id)))
}

function uniqueEdgeId(ir, base) {
  return edgeId(base, new Set(ir.edges.map(edge => edge.id)))
}

function kindFor(ir, hint = '') {
  const type = ir.diagram_type
  const word = norm(hint)
  if (type === 'erd') return 'entity'
  if (type === 'flowchart') return 'process'
  if (type === 'uml_activity') return 'action'
  if (type === 'uml_state') return 'state'
  if (type === 'uml_class') return 'class'
  if (type === 'uml_usecase') return word.includes('actor') || word.includes('aktor') ? 'actor' : 'usecase'
  if (type === 'sequence') return 'participant'
  if (type === 'architecture') {
    if (word.includes('database') || word.includes('postgres') || word.includes('mysql')) return 'database'
    if (word.includes('cache') || word.includes('redis')) return 'cache'
    if (word.includes('queue') || word.includes('rabbit') || word.includes('kafka')) return 'queue'
    if (word.includes('worker')) return 'worker'
    if (word.includes('gateway')) return 'gateway'
    if (word.includes('frontend') || word.includes('web') || word.includes('mobile')) return 'frontend'
    if (word.includes('client')) return 'client'
    return 'service'
  }
  return 'entity'
}

function kindFromText(text) {
  const lowered = norm(text)
  for (const [kind, words] of Object.entries(TYPE_WORDS)) {
    if (words.some(word => lowered === word || lowered.startsWith(`${word} `))) return kind
  }
  return ''
}

function cleanName(value) {
  return oneLine(String(value ?? '').split(/[.,;]/)[0]
    .replace(/^(?:tabel|table|entitas|entity|class|kelas|komponen|component|state|status|use case|usecase|participant|actor|aktor|proses|process|aksi|action)\s+/i, '')
    .replace(/\s+(?:dan|and|lalu|then)\s+(?:hubungkan|connect|sambungkan).*$/i, '')
    .replace(/\s+(?:dengan|with|ke|to)\s+.*$/i, '')
    .trim(), 120)
}

function splitAddSentence(text) {
  const withoutVerb = text.replace(/^\s*(?:tambahkan|tambah|add|insert)\s+/i, '')
  const kindHint = kindFromText(withoutVerb)
  const name = cleanName(withoutVerb)
  const connect = withoutVerb.match(/(?:dan\s+)?(?:hubungkan|sambungkan|connect)(?:\s+(?:dengan|ke|to|with))?\s+(.+)$/i)?.[1]
  return { kindHint, name, connect: connect ? cleanName(connect) : '' }
}

function edgeKindFor(ir) {
  if (ir.diagram_type === 'erd') return 'relationship'
  if (ir.diagram_type === 'flowchart' || ir.diagram_type === 'uml_activity') return 'flow'
  if (ir.diagram_type === 'uml_state') return 'transition'
  if (ir.diagram_type === 'uml_usecase') return 'association'
  if (ir.diagram_type === 'uml_class') return 'association'
  if (ir.diagram_type === 'architecture') return 'calls'
  return 'sync'
}

function defaultCardinalities(ir) {
  if (ir.diagram_type === 'uml_class' || ir.diagram_type === 'erd') return { source: 'many', target: 'one' }
  return { source: 'one', target: 'one' }
}

function addForeignKey(ir, node, target) {
  if (ir.diagram_type !== 'erd' || !target) return null
  const pk = target.attributes.find(attribute => attribute.primary_key) ?? null
  if (!pk) return null
  const base = `${simpleSingular(target.name).replace(/\s+/g, '_')}_id`
  if (node.attributes.some(attribute => norm(attribute.name) === norm(base))) return base
  node.attributes.push({
    id: `${node.id}-attr-${node.attributes.length + 1}`,
    name: base,
    type: pk.type || 'INTEGER',
    primary_key: false,
    foreign_key: true,
    unique: false,
    nullable: true,
    default: null,
    references: { entity_id: target.id, attribute_id: pk.id, attribute_name: pk.name },
    notes: 'Added by revision to support the requested relationship.',
  })
  return base
}

function addNodeOperation(ir, raw, changes) {
  if (ir.constraints.no_additional_entities) {
    throw new DiagramError('constraint_violation', 'The diagram is constrained against adding elements.', 'NEEDS_CLARIFICATION')
  }
  const name = cleanName(raw.name)
  if (!name) throw new DiagramError('revision_missing_name', 'The requested element has no usable name.', 'NEEDS_CLARIFICATION')
  if (findNodeByText(ir, name)) throw new DiagramError('revision_duplicate', `An element named "${name}" already exists.`, 'NEEDS_CLARIFICATION')
  const kind = kindFor(ir, raw.kindHint)
  const id = uniqueNodeId(ir, name)
  const node = {
    id,
    kind,
    name,
    label: name,
    attributes: ir.diagram_type === 'erd'
      ? [{ id: `${id}-attr-1`, name: 'id', type: 'INTEGER', primary_key: true, nullable: false }]
      : [],
    methods: [],
    notes: 'Added by revision.',
  }
  ir.nodes.push(node)
  changes.push({ op: 'add_node', target: id, detail: `Added ${node.kind} "${name}".` })
  return node
}

function addEdgeOperation(ir, source, target, raw = {}, changes) {
  if (ir.constraints.no_additional_relationships) {
    throw new DiagramError('constraint_violation', 'The diagram is constrained against adding relationships.', 'NEEDS_CLARIFICATION')
  }
  const existing = ir.edges.find(edge => (edge.source === source.id && edge.target === target.id) || (edge.source === target.id && edge.target === source.id))
  if (existing) return existing
  const cardinality = raw.cardinality ?? defaultCardinalities(ir)
  const id = uniqueEdgeId(ir, `${source.name}-${target.name}`)
  const edge = {
    id,
    kind: raw.kind ?? edgeKindFor(ir),
    source: source.id,
    target: target.id,
    label: raw.label ?? '',
    source_cardinality: cardinality.source,
    target_cardinality: cardinality.target,
    source_optional: true,
    target_optional: false,
    guard: raw.guard ?? '',
    action: raw.action ?? '',
    dashed: false,
    notes: 'Added by revision.',
  }
  ir.edges.push(edge)
  changes.push({ op: 'add_edge', target: id, detail: `Connected "${source.name}" to "${target.name}".` })
  return edge
}

function removeNodeOperation(ir, value, changes) {
  const node = findNodeByText(ir, value)
  if (!node) throw new DiagramError('revision_not_found', `No element matches "${value}".`, 'NEEDS_CLARIFICATION')
  if (node.locked) throw new DiagramError('locked_element', `"${node.name}" is locked and cannot be removed.`, 'NEEDS_CLARIFICATION')
  const removedEdges = ir.edges.filter(edge => edge.source === node.id || edge.target === node.id)
  ir.edges = ir.edges.filter(edge => !removedEdges.includes(edge))
  ir.nodes = ir.nodes.filter(item => item.id !== node.id)
  for (const group of ir.groups) group.node_ids = group.node_ids.filter(id => id !== node.id)
  for (const frame of ir.frames) {
    const removedMessageIds = new Set(removedEdges.map(edge => edge.id))
    frame.message_ids = frame.message_ids.filter(id => !removedMessageIds.has(id))
  }
  changes.push({ op: 'remove_node', target: node.id, detail: `Removed "${node.name}" and ${removedEdges.length} connected relationship(s).` })
  return node
}

function renameNodeOperation(ir, value, nextName, changes) {
  const node = findNodeByText(ir, value)
  if (!node) throw new DiagramError('revision_not_found', `No element matches "${value}".`, 'NEEDS_CLARIFICATION')
  const name = cleanName(nextName)
  if (!name) throw new DiagramError('revision_missing_name', 'The new name is empty.', 'NEEDS_CLARIFICATION')
  if (node.locked) throw new DiagramError('locked_element', `"${node.name}" is locked and cannot be renamed.`, 'NEEDS_CLARIFICATION')
  const previous = node.name
  node.name = name
  node.label = name
  changes.push({ op: 'update_node', target: node.id, detail: `Renamed "${previous}" to "${name}".` })
  return node
}

function changeRelationshipOperation(ir, leftText, rightText, cardinalityText, changes) {
  const left = findNodeByText(ir, leftText)
  const right = findNodeByText(ir, rightText)
  if (!left || !right) throw new DiagramError('revision_not_found', `Could not resolve relationship endpoints "${leftText}" and "${rightText}".`, 'NEEDS_CLARIFICATION')
  const cardinality = parseCardinality(cardinalityText)
  let edge = ir.edges.find(item => (item.source === left.id && item.target === right.id) || (item.source === right.id && item.target === left.id))
  if (!edge) edge = addEdgeOperation(ir, left, right, { cardinality }, changes)
  const reversed = edge.source === right.id && edge.target === left.id
  edge.source_cardinality = reversed ? cardinality.target : cardinality.source
  edge.target_cardinality = reversed ? cardinality.source : cardinality.target
  changes.push({
    op: 'update_edge',
    target: edge.id,
    detail: `Set ${left.name}–${right.name} to ${cardinality.label}.`,
  })
  return edge
}

function parseCardinality(text) {
  const value = norm(text).replace(/\s+/g, ' ')
  if (/many\s*(?:to|-)\s*many|n\s*[:：]\s*n|m\s*[:：]\s*m/.test(value)) return { source: 'many', target: 'many', label: 'many-to-many' }
  if (/one\s*(?:to|-)\s*many|1\s*[:：]\s*n|1\s*(?:to|-)\s*n/.test(value)) return { source: 'one', target: 'many', label: 'one-to-many' }
  if (/many\s*(?:to|-)\s*one|n\s*[:：]\s*1/.test(value)) return { source: 'many', target: 'one', label: 'many-to-one' }
  if (/zero\s*(?:or|to|-)\s*one|0\s*\.\.\s*1/.test(value)) return { source: 'zero_or_one', target: 'zero_or_one', label: 'zero-or-one' }
  return { source: 'one', target: 'one', label: 'one-to-one' }
}

function parseInstruction(instruction) {
  const text = oneLine(instruction, 1000)
  const operations = []
  const lowered = text.toLowerCase()

  const theme = text.match(/(?:tema|theme)\s*(?:menjadi|ke|to|:)?\s*(professional|light|dark|monochrome)/i)?.[1]
  if (theme) operations.push({ op: 'set_style', style: { theme: theme.toLowerCase() } })
  if (/\blandscape\b|lanskap|horizontal/i.test(lowered)) operations.push({ op: 'set_style', style: { orientation: 'landscape' } })
  else if (/\bportrait\b|potret|vertikal/i.test(lowered)) operations.push({ op: 'set_style', style: { orientation: 'portrait' } })
  if (/\bcompact\b|padat/i.test(lowered)) operations.push({ op: 'set_style', style: { layout_density: 'compact' } })
  else if (/\bspacious\b|lega|renggang/i.test(lowered)) operations.push({ op: 'set_style', style: { layout_density: 'spacious' } })
  else if (/\bcomfortable\b|nyaman/i.test(lowered)) operations.push({ op: 'set_style', style: { layout_density: 'comfortable' } })

  const title = text.match(/(?:judul|title)\s*(?:menjadi|to|:)?\s*["“]?(.{2,120}?)["”]?(?:[.;]|$)/i)?.[1]
  if (title) operations.push({ op: 'set_title', title: title.trim() })

  const rename = text.match(/(?:ganti\s+nama|rename|ubah\s+nama)\s+(.+?)\s+(?:menjadi|to|ke)\s+(.+?)(?:[.;]|$)/i)
  if (rename) operations.push({ op: 'rename_node', target: rename[1].trim(), name: rename[2].trim() })

  const remove = text.match(/(?:hapus|remove|delete)\s+(.+?)(?:[.;]|$)/i)
  if (remove) operations.push({ op: 'remove_node', target: cleanName(remove[1]) })

  const relationship = text.match(/(?:ubah|ganti|change|update|set)?\s*(?:relasi|relationship|hubungan)?\s*(?:antara|between)?\s*([\w .()-]+?)\s+(?:dan|and|dengan|with)\s+([\w .()-]+?)\s+(?:menjadi|to|into)\s+([\w .:-]+?)(?:[.;]|$)/i)
  if (relationship && parseCardinality(relationship[3])) {
    operations.push({ op: 'set_cardinality', left: relationship[1].trim(), right: relationship[2].trim(), cardinality: relationship[3].trim() })
  }

  const add = text.match(/(?:tambahkan|tambah|add|insert)\s+(.+?)(?:[.;]|$)/i)
  if (add) {
    const parsed = splitAddSentence(add[0])
    if (parsed.name && !parsed.name.toLowerCase().startsWith('relasi')) {
      operations.push({ op: 'add_node', name: parsed.name, kindHint: parsed.kindHint, connectTo: parsed.connect || '' })
    }
  }

  // De-duplicate near-identical style operations, keeping the last instruction.
  const deduped = []
  for (const operation of operations) {
    const index = deduped.findIndex(item => item.op === 'set_style' && operation.op === 'set_style' && Object.keys(operation.style)[0] === Object.keys(item.style)[0])
    if (index >= 0) deduped[index] = operation
    else deduped.push(operation)
  }
  return deduped
}

function applyOperation(ir, operation, changes, assumptions) {
  if (!operation || typeof operation !== 'object') throw new DiagramError('invalid_operation', 'Each revision operation must be an object.', 'FAILED')
  switch (operation.op) {
    case 'add_node': {
      const node = addNodeOperation(ir, operation, changes)
      if (operation.connectTo) {
        const target = findNodeByText(ir, operation.connectTo)
        if (!target) throw new DiagramError('revision_not_found', `No element matches "${operation.connectTo}".`, 'NEEDS_CLARIFICATION')
        const foreignKey = addForeignKey(ir, node, target)
        addEdgeOperation(ir, node, target, {}, changes)
        if (foreignKey) assumptions.push(`Added foreign key ${node.name}.${foreignKey} for the requested relationship.`)
      }
      return
    }
    case 'add_edge': {
      const source = findNodeByText(ir, operation.source)
      const target = findNodeByText(ir, operation.target)
      if (!source || !target) throw new DiagramError('revision_not_found', `Could not resolve "${operation.source}" and "${operation.target}".`, 'NEEDS_CLARIFICATION')
      addEdgeOperation(ir, source, target, operation, changes)
      return
    }
    case 'remove_node':
      removeNodeOperation(ir, operation.target ?? operation.id, changes)
      return
    case 'rename_node':
      renameNodeOperation(ir, operation.target, operation.name, changes)
      return
    case 'update_node': {
      const node = findNodeByText(ir, operation.target ?? operation.id)
      if (!node) throw new DiagramError('revision_not_found', `No element matches "${operation.target}".`, 'NEEDS_CLARIFICATION')
      if (node.locked) throw new DiagramError('locked_element', `"${node.name}" is locked.`, 'NEEDS_CLARIFICATION')
      Object.assign(node, operation.changes ?? {})
      changes.push({ op: 'update_node', target: node.id, detail: `Updated "${node.name}".` })
      return
    }
    case 'update_edge': {
      const edge = ir.edges.find(item => item.id === operation.target || item.id === operation.id)
      if (!edge) throw new DiagramError('revision_not_found', `No relationship with id "${operation.target}".`, 'NEEDS_CLARIFICATION')
      Object.assign(edge, operation.changes ?? {})
      changes.push({ op: 'update_edge', target: edge.id, detail: 'Updated relationship.' })
      return
    }
    case 'set_cardinality':
      changeRelationshipOperation(ir, operation.left, operation.right, operation.cardinality, changes)
      return
    case 'set_style':
      Object.assign(ir.style, operation.style ?? {})
      changes.push({ op: 'set_style', detail: `Updated style: ${JSON.stringify(operation.style)}.` })
      return
    case 'set_title':
      ir.title = oneLine(operation.title, 120) || ir.title
      changes.push({ op: 'set_title', detail: `Title set to "${ir.title}".` })
      return
    default:
      throw new DiagramError('unknown_operation', `Unknown revision operation: ${operation.op}`, 'NEEDS_CLARIFICATION')
  }
}

/**
 * @param {object} baseIR
 * @param {string} instruction
 * @param {{structuredPatch?: object|object[]}} [options]
 * @returns {{ir: object, changes: object[], assumptions: string[], clarifications: string[], changedNodeIds: string[], changedEdgeIds: string[]}}
 */
export function applyRevision(baseIR, instruction, options = {}) {
  const ir = cloneIR(baseIR)
  const changes = []
  const assumptions = []
  const clarifications = []
  const originalNodes = new Map(ir.nodes.map(node => [node.id, JSON.stringify(node)]))
  const originalEdges = new Map(ir.edges.map(edge => [edge.id, JSON.stringify(edge)]))

  const patch = options.structuredPatch
  const operations = patch
    ? (Array.isArray(patch) ? patch : patch.operations ?? [])
    : parseInstruction(instruction)

  if (!Array.isArray(operations) || !operations.length) {
    clarifications.push('No actionable revision was recognized. Say what to add, remove, rename, connect, or restyle.')
    return { ir, changes, assumptions, clarifications, changedNodeIds: [], changedEdgeIds: [] }
  }

  if (operations.some(operation => operation.op === 'add_node')) {
    if (ir.constraints.no_additional_entities) {
      ir.constraints.no_additional_entities = false
      assumptions.push('The revision explicitly adds an element, so the earlier no-additional-entities constraint no longer applies to this edit.')
    }
    if (ir.constraints.no_additional_relationships) {
      ir.constraints.no_additional_relationships = false
      assumptions.push('The revision explicitly adds a relationship, so the earlier no-additional-relationships constraint no longer applies to this edit.')
    }
  }
  for (const operation of operations) applyOperation(ir, operation, changes, assumptions)
  ir.source = { ...ir.source, mode: 'revision', requirement: oneLine(instruction || 'Structured revision', 4000) }
  ir.updated_at = new Date().toISOString()

  const next = normalizeIR(ir)
  const changedNodeIds = next.nodes.filter(node => originalNodes.get(node.id) !== JSON.stringify(node)).map(node => node.id)
  const addedNodeIds = next.nodes.filter(node => !originalNodes.has(node.id)).map(node => node.id)
  const changedEdgeIds = next.edges.filter(edge => originalEdges.get(edge.id) !== JSON.stringify(edge)).map(edge => edge.id)
  const addedEdgeIds = next.edges.filter(edge => !originalEdges.has(edge.id)).map(edge => edge.id)

  const preserved = next.constraints.preserve ?? []
  const touched = [...new Set([...changedNodeIds, ...addedNodeIds, ...changedEdgeIds, ...addedEdgeIds])]
  for (const name of preserved) {
    const node = findNodeByText(next, name)
    if (node && touched.includes(node.id)) {
      throw new DiagramError('preserved_element_modified', `Revision would modify preserved element "${name}".`, 'NEEDS_CLARIFICATION')
    }
  }

  return {
    ir: next,
    changes,
    assumptions,
    clarifications,
    changedNodeIds: [...new Set([...changedNodeIds, ...addedNodeIds])],
    changedEdgeIds: [...new Set([...changedEdgeIds, ...addedEdgeIds])],
  }
}

export { parseInstruction, parseCardinality }
