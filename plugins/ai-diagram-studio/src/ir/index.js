/**
 * Canonical Diagram IR v1.
 *
 * Semantics live in nodes/edges/groups/frames. Layout is optional data that a
 * later layout pass may replace without changing meaning. Renderer syntax is
 * never stored here; it is derived on demand from this model.
 */
import { DiagramError, invariant } from '../core/errors.js'
import { clean, oneLine } from '../core/text.js'

export const IR_VERSION = '1.0'
export const MAX_NODES = 220
export const MAX_EDGES = 480
export const MAX_ATTRIBUTES = 48
export const MAX_METHODS = 40
export const MAX_GROUPS = 40

export const DIAGRAM_TYPES = [
  'erd',
  'flowchart',
  'uml_class',
  'uml_usecase',
  'uml_activity',
  'uml_state',
  'sequence',
  'architecture',
]

export const DIAGRAM_LABELS = {
  erd: 'Entity Relationship Diagram',
  flowchart: 'Flowchart',
  uml_class: 'UML Class Diagram',
  uml_usecase: 'UML Use Case Diagram',
  uml_activity: 'UML Activity Diagram',
  uml_state: 'UML State Machine Diagram',
  sequence: 'Sequence Diagram',
  architecture: 'Software Architecture Diagram',
}

const ERD_KINDS = new Set(['entity', 'associative_entity'])
const FLOW_KINDS = new Set([
  'start', 'end', 'process', 'decision', 'input', 'output', 'document',
  'subprocess', 'connector', 'note', 'terminator',
])
const ACTIVITY_KINDS = new Set(['initial', 'final', 'action', 'decision', 'merge', 'fork', 'join', 'note'])
const STATE_KINDS = new Set(['initial', 'final', 'state', 'choice', 'note'])
const USECASE_KINDS = new Set(['actor', 'usecase', 'system', 'note'])
const CLASS_KINDS = new Set(['class', 'interface', 'abstract', 'enum', 'note'])
const ARCH_KINDS = new Set([
  'client', 'frontend', 'service', 'api', 'gateway', 'database', 'cache', 'queue',
  'worker', 'storage', 'external', 'infra', 'boundary', 'note',
])
const SEQUENCE_KINDS = new Set(['participant', 'actor', 'boundary', 'control', 'entity', 'database', 'note'])

const KINDS_BY_TYPE = {
  erd: ERD_KINDS,
  flowchart: FLOW_KINDS,
  uml_activity: ACTIVITY_KINDS,
  uml_state: STATE_KINDS,
  uml_usecase: USECASE_KINDS,
  uml_class: CLASS_KINDS,
  architecture: ARCH_KINDS,
  sequence: SEQUENCE_KINDS,
}

export const EDGE_KINDS = {
  erd: new Set(['relationship', 'identifying']),
  flowchart: new Set(['flow']),
  uml_activity: new Set(['flow']),
  uml_state: new Set(['transition']),
  uml_usecase: new Set(['association', 'include', 'extend', 'generalization']),
  uml_class: new Set(['association', 'inheritance', 'realization', 'dependency', 'aggregation', 'composition']),
  architecture: new Set(['depends', 'calls', 'reads', 'writes', 'publishes', 'subscribes', 'replicates']),
  sequence: new Set(['sync', 'async', 'return', 'create', 'destroy', 'self']),
}

const CARDINALITIES = new Set(['one', 'zero_or_one', 'many', 'one_or_more'])
const THEMES = new Set(['professional', 'light', 'dark', 'monochrome'])
const ORIENTATIONS = new Set(['auto', 'portrait', 'landscape'])
const DENSITIES = new Set(['auto', 'compact', 'comfortable', 'spacious'])

export function nowIso() {
  return new Date().toISOString()
}

export function emptyIR({ diagramType = 'erd', title = 'Untitled Diagram', language = 'en', requirement = '', mode = 'natural_language' } = {}) {
  invariant(DIAGRAM_TYPES.includes(diagramType), 'unsupported_type', `Unsupported diagram type: ${diagramType}`, {
    supported: DIAGRAM_TYPES,
  })
  const stamp = nowIso()
  return {
    schema_version: IR_VERSION,
    diagram_id: null,
    diagram_type: diagramType,
    title: oneLine(title, 120) || 'Untitled Diagram',
    description: '',
    language: language === 'id' ? 'id' : 'en',
    source: { mode, requirement: clean(requirement, 4000), parser: 'rule-based-v1' },
    notation: { erd: 'crowfoot', uml: 'uml2', sequence: 'uml2' },
    style: { theme: 'professional', orientation: 'auto', layout_density: 'auto', scale: 2 },
    nodes: [],
    edges: [],
    groups: [],
    frames: [],
    assumptions: [],
    constraints: {
      no_additional_entities: false,
      no_additional_relationships: false,
      preserve: [],
      notes: [],
    },
    layout: null,
    revision: 1,
    parent_revision: null,
    revision_changes: [],
    created_at: stamp,
    updated_at: stamp,
  }
}

function normalizeAttribute(raw, entityId, index) {
  if (typeof raw === 'string') {
    const text = oneLine(raw, 120)
    return {
      id: `${entityId}-attr-${index + 1}`,
      name: text,
      type: '',
      primary_key: false,
      foreign_key: false,
      unique: false,
      nullable: true,
      default: null,
      references: null,
      notes: '',
    }
  }
  invariant(raw && typeof raw === 'object', 'invalid_attribute', 'Each attribute must be an object or string.', {
    entity: entityId,
    index,
  })
  const name = oneLine(raw.name ?? raw.label ?? '', 120)
  invariant(name, 'invalid_attribute', 'Every attribute needs a name.', { entity: entityId, index })
  return {
    id: oneLine(raw.id ?? `${entityId}-attr-${index + 1}`, 120),
    name,
    type: oneLine(raw.type ?? raw.data_type ?? '', 80),
    primary_key: Boolean(raw.primary_key ?? raw.pk),
    foreign_key: Boolean(raw.foreign_key ?? raw.fk),
    unique: Boolean(raw.unique),
    nullable: raw.nullable === undefined ? !Boolean(raw.primary_key ?? raw.pk) : Boolean(raw.nullable),
    default: raw.default == null ? null : oneLine(raw.default, 80),
    references: raw.references && typeof raw.references === 'object'
      ? {
          entity_id: oneLine(raw.references.entity_id ?? raw.references.entity ?? '', 120),
          attribute_id: raw.references.attribute_id ? oneLine(raw.references.attribute_id, 120) : null,
          attribute_name: raw.references.attribute_name ? oneLine(raw.references.attribute_name, 120) : null,
        }
      : null,
    notes: oneLine(raw.notes ?? '', 200),
  }
}

function normalizeMethod(raw, classId, index) {
  if (typeof raw === 'string') {
    return {
      id: `${classId}-method-${index + 1}`,
      name: oneLine(raw, 140),
      returns: '',
      visibility: 'public',
      parameters: [],
      abstract: false,
      static: false,
    }
  }
  invariant(raw && typeof raw === 'object', 'invalid_method', 'Each method must be an object or string.', {
    class: classId,
    index,
  })
  return {
    id: oneLine(raw.id ?? `${classId}-method-${index + 1}`, 120),
    name: oneLine(raw.name ?? '', 140),
    returns: oneLine(raw.returns ?? raw.return_type ?? '', 80),
    visibility: ['public', 'private', 'protected', 'package'].includes(raw.visibility) ? raw.visibility : 'public',
    parameters: Array.isArray(raw.parameters)
      ? raw.parameters.slice(0, 12).map(parameter => (typeof parameter === 'string'
          ? oneLine(parameter, 80)
          : oneLine(`${parameter?.name ?? ''}: ${parameter?.type ?? ''}`.replace(/: $/, ''), 80)))
      : [],
    abstract: Boolean(raw.abstract),
    static: Boolean(raw.static),
  }
}

export function normalizeNode(raw, diagramType, index = 0) {
  invariant(raw && typeof raw === 'object', 'invalid_node', 'Each node must be an object.', { index })
  const id = oneLine(raw.id ?? '', 120)
  invariant(id, 'invalid_node', 'Every node needs a stable id.', { index })
  const allowed = KINDS_BY_TYPE[diagramType]
  let kind = oneLine(raw.kind ?? raw.type ?? '', 40)
  if (!kind) kind = defaultKind(diagramType)
  if (diagramType === 'flowchart' && kind === 'terminator') kind = raw.label?.toLowerCase().startsWith('end') ? 'end' : 'start'
  invariant(allowed.has(kind), 'invalid_node_kind', `Node kind "${kind}" is not valid for ${diagramType}.`, {
    node: id,
    allowed: [...allowed],
  })
  const name = oneLine(raw.name ?? raw.label ?? raw.title ?? id, 160)
  const attributes = Array.isArray(raw.attributes) ? raw.attributes.slice(0, MAX_ATTRIBUTES) : []
  const methods = Array.isArray(raw.methods) ? raw.methods.slice(0, MAX_METHODS) : []
  return {
    id,
    kind,
    name,
    label: oneLine(raw.label ?? name, 160),
    description: clean(raw.description ?? '', 400),
    stereotype: oneLine(raw.stereotype ?? '', 60),
    technology: oneLine(raw.technology ?? '', 80),
    attributes: attributes.map((attribute, attrIndex) => normalizeAttribute(attribute, id, attrIndex)),
    methods: methods.map((method, methodIndex) => normalizeMethod(method, id, methodIndex)),
    group_id: raw.group_id ? oneLine(raw.group_id, 120) : null,
    boundary: raw.boundary ? oneLine(raw.boundary, 80) : null,
    notes: oneLine(raw.notes ?? '', 300),
    locked: Boolean(raw.locked),
  }
}

function defaultKind(diagramType) {
  switch (diagramType) {
    case 'erd': return 'entity'
    case 'flowchart': return 'process'
    case 'uml_class': return 'class'
    case 'uml_usecase': return 'usecase'
    case 'uml_activity': return 'action'
    case 'uml_state': return 'state'
    case 'sequence': return 'participant'
    case 'architecture': return 'service'
    default: return 'process'
  }
}

export function normalizeEdge(raw, diagramType, index = 0) {
  invariant(raw && typeof raw === 'object', 'invalid_edge', 'Each edge must be an object.', { index })
  const id = oneLine(raw.id ?? `edge-${index + 1}`, 120)
  const source = oneLine(raw.source ?? raw.from ?? '', 120)
  const target = oneLine(raw.target ?? raw.to ?? '', 120)
  const allowed = EDGE_KINDS[diagramType]
  let kind = oneLine(raw.kind ?? raw.type ?? '', 40)
  if (!kind) kind = diagramType === 'erd' ? 'relationship' : diagramType === 'uml_state' ? 'transition' : diagramType === 'sequence' ? 'sync' : 'flow'
  invariant(allowed.has(kind), 'invalid_edge_kind', `Edge kind "${kind}" is not valid for ${diagramType}.`, {
    edge: id,
    allowed: [...allowed],
  })
  const sourceCardinality = CARDINALITIES.has(raw.source_cardinality) ? raw.source_cardinality : 'one'
  const targetCardinality = CARDINALITIES.has(raw.target_cardinality) ? raw.target_cardinality : 'one'
  return {
    id,
    kind,
    source,
    target,
    label: oneLine(raw.label ?? '', 160),
    source_cardinality: sourceCardinality,
    target_cardinality: targetCardinality,
    source_optional: Boolean(raw.source_optional),
    target_optional: Boolean(raw.target_optional),
    source_role: oneLine(raw.source_role ?? raw.source_label ?? '', 80),
    target_role: oneLine(raw.target_role ?? raw.target_label ?? '', 80),
    guard: oneLine(raw.guard ?? '', 160),
    action: oneLine(raw.action ?? '', 160),
    order: Number.isFinite(Number(raw.order)) ? Math.max(0, Math.min(9999, Number(raw.order))) : index + 1,
    text: oneLine(raw.text ?? raw.label ?? '', 200),
    dashed: Boolean(raw.dashed),
    notes: oneLine(raw.notes ?? '', 300),
    locked: Boolean(raw.locked),
  }
}

function normalizeGroup(raw, index) {
  invariant(raw && typeof raw === 'object', 'invalid_group', 'Each group must be an object.', { index })
  return {
    id: oneLine(raw.id ?? `group-${index + 1}`, 120),
    label: oneLine(raw.label ?? raw.name ?? `Group ${index + 1}`, 120),
    kind: oneLine(raw.kind ?? 'boundary', 40),
    node_ids: Array.isArray(raw.node_ids) ? raw.node_ids.map(id => oneLine(id, 120)).slice(0, MAX_NODES) : [],
    description: oneLine(raw.description ?? '', 240),
  }
}

function normalizeFrame(raw, index) {
  invariant(raw && typeof raw === 'object', 'invalid_frame', 'Each sequence frame must be an object.', { index })
  const kind = ['alt', 'opt', 'loop', 'par', 'break', 'critical'].includes(raw.kind) ? raw.kind : 'opt'
  return {
    id: oneLine(raw.id ?? `frame-${index + 1}`, 120),
    kind,
    label: oneLine(raw.label ?? '', 160),
    message_ids: Array.isArray(raw.message_ids) ? raw.message_ids.map(id => oneLine(id, 120)).slice(0, MAX_EDGES) : [],
  }
}

export function normalizeIR(input, { strict = true } = {}) {
  invariant(input && typeof input === 'object', 'invalid_ir', 'Diagram IR must be an object.')
  const diagramType = oneLine(input.diagram_type ?? input.diagramType ?? '', 40)
  if (strict) {
    invariant(DIAGRAM_TYPES.includes(diagramType), 'unsupported_type', `Unsupported diagram type: ${diagramType || '(missing)'}`, {
      supported: DIAGRAM_TYPES,
    })
  }
  const base = emptyIR({
    diagramType: DIAGRAM_TYPES.includes(diagramType) ? diagramType : 'erd',
    title: input.title ?? 'Untitled Diagram',
    language: input.language,
    requirement: input.source?.requirement ?? input.requirement ?? '',
    mode: input.source?.mode ?? 'natural_language',
  })
  const rawNodes = Array.isArray(input.nodes) ? input.nodes : []
  const rawEdges = Array.isArray(input.edges) ? input.edges : []
  invariant(rawNodes.length <= MAX_NODES, 'diagram_too_large', `A diagram may contain at most ${MAX_NODES} nodes.`, {
    nodes: rawNodes.length,
  })
  invariant(rawEdges.length <= MAX_EDGES, 'diagram_too_large', `A diagram may contain at most ${MAX_EDGES} edges.`, {
    edges: rawEdges.length,
  })

  const ir = {
    ...base,
    diagram_id: input.diagram_id ? oneLine(input.diagram_id, 90) : null,
    diagram_type: base.diagram_type,
    title: oneLine(input.title ?? base.title, 120) || 'Untitled Diagram',
    description: clean(input.description ?? '', 1200),
    language: input.language === 'id' ? 'id' : 'en',
    source: {
      mode: ['natural_language', 'structured', 'revision'].includes(input.source?.mode) ? input.source.mode : 'natural_language',
      requirement: clean(input.source?.requirement ?? input.requirement ?? '', 4000),
      parser: oneLine(input.source?.parser ?? 'rule-based-v1', 60),
    },
    notation: {
      erd: oneLine(input.notation?.erd ?? 'crowfoot', 30),
      uml: oneLine(input.notation?.uml ?? 'uml2', 30),
      sequence: oneLine(input.notation?.sequence ?? 'uml2', 30),
    },
    style: {
      theme: THEMES.has(input.style?.theme) ? input.style.theme : 'professional',
      orientation: ORIENTATIONS.has(input.style?.orientation) ? input.style.orientation : 'auto',
      layout_density: DENSITIES.has(input.style?.layout_density) ? input.style.layout_density : 'auto',
      scale: Math.max(1, Math.min(4, Number(input.style?.scale ?? 2) || 2)),
    },
    assumptions: Array.isArray(input.assumptions)
      ? input.assumptions.slice(0, 40).map(item => (typeof item === 'string' ? oneLine(item, 400) : oneLine(item?.text ?? '', 400))).filter(Boolean)
      : [],
    constraints: {
      no_additional_entities: Boolean(input.constraints?.no_additional_entities),
      no_additional_relationships: Boolean(input.constraints?.no_additional_relationships),
      preserve: Array.isArray(input.constraints?.preserve)
        ? input.constraints.preserve.slice(0, 60).map(item => oneLine(item, 120))
        : [],
      notes: Array.isArray(input.constraints?.notes)
        ? input.constraints.notes.slice(0, 20).map(item => oneLine(item, 400))
        : [],
    },
    revision: Number.isInteger(input.revision) && input.revision > 0 ? input.revision : 1,
    parent_revision: Number.isInteger(input.parent_revision) ? input.parent_revision : null,
    revision_changes: Array.isArray(input.revision_changes)
      ? input.revision_changes.slice(0, 40).map(item => oneLine(item, 240))
      : [],
    created_at: typeof input.created_at === 'string' ? input.created_at : base.created_at,
    updated_at: typeof input.updated_at === 'string' ? input.updated_at : base.updated_at,
    layout: input.layout && typeof input.layout === 'object' ? input.layout : null,
  }

  ir.nodes = rawNodes.map((node, index) => normalizeNode(node, ir.diagram_type, index))
  ir.edges = rawEdges.map((edge, index) => normalizeEdge(edge, ir.diagram_type, index))
  ir.groups = Array.isArray(input.groups)
    ? input.groups.slice(0, MAX_GROUPS).map(normalizeGroup)
    : []
  ir.frames = diagramType === 'sequence' && Array.isArray(input.frames)
    ? input.frames.slice(0, 20).map(normalizeFrame)
    : []

  const nodeIds = new Set()
  for (const node of ir.nodes) {
    invariant(!nodeIds.has(node.id), 'duplicate_node_id', `Duplicate node id: ${node.id}`, { node: node.id })
    nodeIds.add(node.id)
  }
  const edgeIds = new Set()
  for (const edge of ir.edges) {
    invariant(!edgeIds.has(edge.id), 'duplicate_edge_id', `Duplicate edge id: ${edge.id}`, { edge: edge.id })
    edgeIds.add(edge.id)
  }
  for (const group of ir.groups) {
    invariant(!ir.groups.some(other => other !== group && other.id === group.id), 'duplicate_group_id', `Duplicate group id: ${group.id}`)
  }
  return ir
}

export function cloneIR(ir) {
  return structuredClone(ir)
}

export function findNode(ir, id) {
  return ir.nodes.find(node => node.id === id) ?? null
}

export function findEdge(ir, id) {
  return ir.edges.find(edge => edge.id === id) ?? null
}

export function entityAttribute(ir, entityId, attributeId) {
  const entity = findNode(ir, entityId)
  if (!entity) return null
  return entity.attributes.find(attribute => attribute.id === attributeId) ?? null
}

export function primaryKey(entity) {
  return entity.attributes.filter(attribute => attribute.primary_key)
}

export function canonicalJSON(ir) {
  return JSON.stringify(ir, null, 2)
}

export function irStats(ir) {
  return {
    nodes: ir.nodes.length,
    edges: ir.edges.length,
    groups: ir.groups.length,
    frames: ir.frames.length,
    attributes: ir.nodes.reduce((total, node) => total + node.attributes.length, 0),
    messages: ir.diagram_type === 'sequence' ? ir.edges.length : 0,
  }
}

export function assertIR(input) {
  try {
    return normalizeIR(input)
  } catch (error) {
    if (error instanceof DiagramError) throw error
    throw new DiagramError('invalid_ir', 'Diagram IR is structurally invalid.', { cause: error })
  }
}
