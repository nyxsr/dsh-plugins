/** Parse an explicit, already-structured diagram specification. */
import { cleanName, IRBuilder, splitTopLevel } from './common.js'
import { oneLine } from '../core/text.js'

function ref(value) {
  if (value && typeof value === 'object') return oneLine(value.id ?? value.name ?? value.label ?? '', 120)
  return oneLine(value ?? '', 120)
}

function cardinalityPair(value) {
  const text = String(value ?? '').toLowerCase()
  if (/many\s*(?:to|-)\s*many|n\s*:\s*m|\*\s*:\s*\*/.test(text)) return ['many', 'many']
  if (/one\s*(?:to|-)\s*many|1\s*:\s*(?:n|\*)|1\s*\.\.\s*\*/.test(text)) return ['one', 'many']
  if (/many\s*(?:to|-)\s*one|(?:n|\*)\s*:\s*1/.test(text)) return ['many', 'one']
  if (/zero[ _-]?or[ _-]?one|0\s*\.\.\s*1/.test(text)) return ['zero_or_one', 'zero_or_one']
  return ['one', 'one']
}

export function parseStructured(specification, { diagramType, title, language, requirement, theme, orientation, density }) {
  const builder = new IRBuilder({
    diagramType,
    title: title ?? specification.title ?? 'Untitled Diagram',
    language,
    requirement: requirement ?? '',
    mode: 'structured',
  })
  const oldToNew = new Map()
  const add = raw => {
    const node = builder.addNode(raw)
    if (node && raw.id) oldToNew.set(raw.id, node.id)
    return node
  }
  const resolve = value => {
    const key = ref(value)
    return oldToNew.get(key) ?? builder.resolve(key) ?? key
  }

  const constraints = specification.constraints ?? {}
  builder.ir.constraints = {
    no_additional_entities: Boolean(constraints.no_additional_entities ?? specification.no_additional_entities),
    no_additional_relationships: Boolean(constraints.no_additional_relationships ?? specification.no_additional_relationships),
    preserve: Array.isArray(constraints.preserve) ? constraints.preserve.map(item => oneLine(item, 120)) : [],
    notes: Array.isArray(constraints.notes) ? constraints.notes.map(item => oneLine(item, 400)) : [],
  }
  for (const assumption of specification.assumptions ?? []) builder.assume(assumption)

  // Generic node/edge form takes precedence, since it is the most explicit.
  if (Array.isArray(specification.nodes) && specification.nodes.length) {
    for (const raw of specification.nodes) {
      if (typeof raw === 'string') {
        add({ name: raw, label: raw })
        continue
      }
      add({
        ...raw,
        id: raw.id,
        name: cleanName(raw.name ?? raw.label ?? raw.id ?? ''),
        label: raw.label ?? raw.name ?? raw.id,
        kind: raw.kind ?? raw.type,
      })
    }
    for (const edge of specification.edges ?? []) {
      builder.addEdge({
        ...edge,
        kind: edge.kind ?? edge.type,
        source: resolve(edge.source ?? edge.from),
        target: resolve(edge.target ?? edge.to),
        order: edge.order ?? builder.ir.edges.length + 1,
      })
    }
    return applyCommon(builder, specification, { theme, orientation, density })
  }

  if (Array.isArray(specification.entities)) {
    for (const entity of specification.entities) {
      const value = typeof entity === 'string' ? { name: entity } : entity
      const name = cleanName(value.name ?? value.label ?? value.id ?? '')
      if (!name) continue
      const attributes = (value.attributes ?? value.columns ?? []).map(attribute => {
        if (typeof attribute === 'string') return attribute
        const reference = attribute.references
        return {
          ...attribute,
          primary_key: attribute.primary_key ?? attribute.pk,
          foreign_key: attribute.foreign_key ?? attribute.fk,
          references: reference
            ? {
                entity_id: ref(reference.entity_id ?? reference.entity ?? reference.table),
                attribute_id: reference.attribute_id ?? null,
                attribute_name: reference.attribute_name ?? reference.column ?? reference.attribute ?? null,
              }
            : attribute.references ?? null,
        }
      })
      add({
        id: value.id,
        kind: value.kind ?? (value.associative ? 'associative_entity' : 'entity'),
        name,
        label: value.label ?? name,
        description: value.description ?? value.notes ?? '',
        attributes,
      })
    }
    for (const relationship of specification.relationships ?? []) {
      const value = typeof relationship === 'string' ? parseRelationshipString(relationship) : relationship
      if (!value) continue
      const source = resolve(value.source ?? value.from ?? value.parent)
      const target = resolve(value.target ?? value.to ?? value.child)
      if (!source || !target) {
        builder.clarify(`Relationship "${value.source ?? value.from} → ${value.target ?? value.to}" refers to an entity that was not defined.`)
        continue
      }
      const pair = value.cardinality
        ? cardinalityPair(value.cardinality)
        : [value.source_cardinality ?? value.from_cardinality ?? 'one', value.target_cardinality ?? value.to_cardinality ?? 'one']
      builder.addEdge({
        kind: value.kind ?? value.type ?? 'relationship',
        source,
        target,
        label: value.label ?? value.name ?? '',
        source_cardinality: pair[0],
        target_cardinality: pair[1],
        source_optional: value.source_optional ?? false,
        target_optional: value.target_optional ?? false,
        source_role: value.source_role ?? '',
        target_role: value.target_role ?? '',
      })
    }
    for (const node of builder.ir.nodes) {
      for (const attribute of node.attributes) {
        if (attribute.references?.entity_id) {
          const mapped = resolve(attribute.references.entity_id)
          attribute.references.entity_id = mapped
        }
      }
    }
    return applyCommon(builder, specification, { theme, orientation, density })
  }

  if (Array.isArray(specification.classes)) {
    for (const item of specification.classes) {
      const value = typeof item === 'string' ? { name: item } : item
      const name = cleanName(value.name ?? value.id ?? '')
      if (!name) continue
      add({
        id: value.id,
        kind: value.kind ?? value.stereotype ?? 'class',
        name,
        label: value.label ?? name,
        stereotype: value.stereotype ?? '',
        attributes: value.attributes ?? [],
        methods: value.methods ?? value.operations ?? [],
      })
    }
    for (const relationship of specification.relationships ?? []) {
      const value = typeof relationship === 'string' ? parseRelationshipString(relationship) : relationship
      if (!value) continue
      builder.addEdge({
        kind: value.kind ?? value.type ?? 'association',
        source: resolve(value.source ?? value.from),
        target: resolve(value.target ?? value.to),
        label: value.label ?? '',
        source_role: value.source_role ?? '',
        target_role: value.target_role ?? '',
        source_cardinality: value.source_cardinality ?? 'one',
        target_cardinality: value.target_cardinality ?? 'one',
      })
    }
    return applyCommon(builder, specification, { theme, orientation, density })
  }

  if (Array.isArray(specification.actors) || Array.isArray(specification.use_cases)) {
    for (const actor of specification.actors ?? []) {
      const value = typeof actor === 'string' ? { name: actor } : actor
      add({ id: value.id, kind: 'actor', name: cleanName(value.name ?? value.label), label: value.label })
    }
    for (const useCase of specification.use_cases ?? specification.usecases ?? []) {
      const value = typeof useCase === 'string' ? { name: useCase } : useCase
      add({ id: value.id, kind: 'usecase', name: cleanName(value.name ?? value.label), label: value.label })
    }
    for (const system of specification.systems ?? []) {
      const value = typeof system === 'string' ? { name: system } : system
      add({ id: value.id, kind: 'system', name: cleanName(value.name ?? value.label) })
    }
    for (const relationship of specification.relationships ?? []) {
      const value = typeof relationship === 'string' ? parseRelationshipString(relationship) : relationship
      if (!value) continue
      builder.addEdge({
        kind: value.kind ?? value.type ?? 'association',
        source: resolve(value.source ?? value.from ?? value.actor),
        target: resolve(value.target ?? value.to ?? value.usecase),
        label: value.label ?? '',
      })
    }
    return applyCommon(builder, specification, { theme, orientation, density })
  }

  if (Array.isArray(specification.states)) {
    for (const state of specification.states) {
      const value = typeof state === 'string' ? { name: state } : state
      add({ id: value.id, kind: value.kind ?? 'state', name: cleanName(value.name ?? value.label), label: value.label })
    }
    for (const transition of specification.transitions ?? specification.relationships ?? []) {
      const value = typeof transition === 'string' ? parseTransitionString(transition) : transition
      if (!value) continue
      builder.addEdge({
        kind: 'transition',
        source: resolve(value.source ?? value.from),
        target: resolve(value.target ?? value.to),
        label: value.label ?? '',
        guard: value.guard ?? '',
        action: value.action ?? '',
      })
    }
    return applyCommon(builder, specification, { theme, orientation, density })
  }

  if (Array.isArray(specification.steps)) {
    const kind = diagramType === 'uml_activity' ? 'action' : 'process'
    let previous = null
    let start = null
    for (const step of specification.steps) {
      const value = typeof step === 'string' ? { name: step } : step
      const type = value.kind ?? value.type ?? kind
      const node = add({
        id: value.id,
        kind: type,
        name: cleanName(value.name ?? value.label),
        label: value.label,
        description: value.description ?? '',
      })
      if (!previous && type === 'initial') start = node
      if (previous) {
        builder.addEdge({
          source: previous.id,
          target: node.id,
          kind: 'flow',
          label: value.edge_label ?? value.condition ?? '',
          guard: value.guard ?? '',
        })
      }
      previous = node
    }
    for (const branch of specification.branches ?? []) {
      builder.addEdge({
        source: resolve(branch.source ?? branch.from),
        target: resolve(branch.target ?? branch.to),
        kind: 'flow',
        label: branch.label ?? branch.condition ?? '',
        guard: branch.guard ?? '',
      })
    }
    return applyCommon(builder, specification, { theme, orientation, density })
  }

  if (Array.isArray(specification.participants) || Array.isArray(specification.messages)) {
    const messageStart = builder.ir.edges.length
    for (const participant of specification.participants ?? []) {
      const value = typeof participant === 'string' ? { name: participant } : participant
      add({ id: value.id, kind: value.kind ?? 'participant', name: cleanName(value.name ?? value.label), label: value.label })
    }
    (specification.messages ?? []).forEach((message, index) => {
      const value = typeof message === 'string' ? parseMessageString(message) : message
      if (!value) return
      const source = resolve(value.source ?? value.from ?? value.sender)
      const target = resolve(value.target ?? value.to ?? value.receiver)
      if (!source || !target) {
        builder.clarify('A message refers to a participant that was not declared.')
        return
      }
      builder.addEdge({
        kind: value.kind ?? value.type ?? 'sync',
        source,
        target,
        text: value.text ?? value.label ?? value.message ?? '',
        label: value.text ?? value.label ?? value.message ?? '',
        order: value.order ?? index + 1,
      })
    })
    const messageEdges = builder.ir.edges.slice(messageStart)
    const resolveMessage = ref => {
      const value = String(ref)
      if (/^\d+$/.test(value)) return messageEdges[Number(value) - 1]?.id ?? value
      return messageEdges.find(edge => edge.id === ref || String(edge.order) === value)?.id ?? value
    }
    for (const frame of specification.frames ?? []) {
      builder.addFrame({
        ...frame,
        message_ids: (frame.message_ids ?? []).map(resolveMessage),
      })
    }
    return applyCommon(builder, specification, { theme, orientation, density })
  }

  if (Array.isArray(specification.components)) {
    for (const component of specification.components) {
      const value = typeof component === 'string' ? { name: component } : component
      add({
        id: value.id,
        kind: value.kind ?? value.type ?? 'service',
        name: cleanName(value.name ?? value.label),
        label: value.label,
        technology: value.technology ?? '',
        description: value.description ?? '',
        group_id: value.group_id ?? null,
      })
    }
    for (const connection of specification.connections ?? specification.relationships ?? []) {
      const value = typeof connection === 'string' ? parseConnectionString(connection) : connection
      if (!value) continue
      builder.addEdge({
        kind: value.kind ?? value.type ?? 'calls',
        source: resolve(value.source ?? value.from),
        target: resolve(value.target ?? value.to),
        label: value.label ?? value.protocol ?? '',
      })
    }
    for (const group of specification.groups ?? specification.boundaries ?? []) {
      const value = typeof group === 'string' ? { label: group } : group
      builder.addGroup({
        id: value.id,
        label: value.label ?? value.name,
        kind: value.kind ?? 'boundary',
        node_ids: (value.node_ids ?? value.components ?? []).map(resolve),
      })
    }
    return applyCommon(builder, specification, { theme, orientation, density })
  }

  builder.clarify('The structured specification does not contain a supported collection (entities, nodes, steps, classes, participants, states, or components).')
  return applyCommon(builder, specification, { theme, orientation, density })
}

function applyCommon(builder, specification, { theme, orientation, density }) {
  for (const group of specification.groups ?? []) {
    if (builder.ir.groups.some(existing => existing.id === group.id)) continue
    builder.addGroup(group)
  }
  return builder.finish({ theme, orientation, density })
}

export function parseRelationshipString(value) {
  const text = oneLine(value, 240)
  const patterns = [
    /^(.+?)\s*(?:<\|--|--\|>|->|→|--)\s*(.+?)$/,
    /^(.+?)\s+(?:has|have|has many|contains?)\s+(?:many\s+|one\s+)?(.+?)$/i,
    /^(.+?)\s+(?:memiliki|mempunyai|berisi)\s+(?:banyak\s+|satu\s+)?(.+?)$/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return { source: cleanName(match[1]), target: cleanName(match[2]) }
  }
  return null
}

export function parseTransitionString(value) {
  const text = oneLine(value, 240)
  const match = text.match(/^(.+?)\s*(?:->|→|=>|menjadi|ke)\s*(.+?)(?:\s*\[(.+?)\])?$/)
  if (!match) return null
  return { source: cleanName(match[1]), target: cleanName(match[2]), guard: match[3] ?? '' }
}

export function parseMessageString(value) {
  const text = oneLine(value, 300)
  const match = text.match(/^(.+?)\s*(-->>|-->|->>|->|→|⇒)\s*(.+?)\s*[:：]\s*(.+)$/)
  if (!match) return null
  const arrow = match[2]
  return {
    source: cleanName(match[1]),
    target: cleanName(match[3]),
    text: match[4],
    kind: arrow.includes('--') ? 'return' : arrow === '->>' ? 'async' : 'sync',
  }
}

export function parseConnectionString(value) {
  const text = oneLine(value, 300)
  const match = text.match(/^(.+?)\s*(?:->|→|--|=>)\s*(.+?)(?:\s*[:：]\s*(.+))?$/)
  if (!match) return null
  return { source: cleanName(match[1]), target: cleanName(match[2]), label: match[3] ?? '' }
}
