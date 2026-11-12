/**
 * Semantic validation is renderer-independent. It inspects only the canonical
 * IR and returns structured issues; it never changes the model.
 */
import { findNode, primaryKey } from '../ir/index.js'

function issue(code, message, extra = {}) {
  return { code, message, severity: extra.severity ?? 'error', hint: extra.hint ?? null, ...extra }
}

function adjacency(ir) {
  const outgoing = new Map(ir.nodes.map(node => [node.id, []]))
  const incoming = new Map(ir.nodes.map(node => [node.id, []]))
  for (const edge of ir.edges) {
    if (outgoing.has(edge.source)) outgoing.get(edge.source).push(edge)
    if (incoming.has(edge.target)) incoming.get(edge.target).push(edge)
  }
  return { outgoing, incoming }
}

function reachableFrom(starts, outgoing) {
  const seen = new Set(starts)
  const queue = [...starts]
  while (queue.length) {
    const current = queue.shift()
    for (const edge of outgoing.get(current) ?? []) {
      if (!seen.has(edge.target)) {
        seen.add(edge.target)
        queue.push(edge.target)
      }
    }
  }
  return seen
}

function duplicateNames(ir, errors, warnings) {
  const byName = new Map()
  for (const node of ir.nodes) {
    const key = node.name.trim().toLowerCase()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key).push(node.id)
  }
  for (const [name, ids] of byName) {
    if (ids.length > 1) {
      warnings.push(issue('duplicate_node_name', `Multiple elements share the name "${name}".`, {
        severity: 'warning',
        hint: 'Rename one element or confirm that the duplicate is intentional.',
        node_id: ids[0],
        related: ids,
      }))
    }
  }
}

function commonChecks(ir, errors, warnings) {
  if (!ir.nodes.length) {
    errors.push(issue('diagram_empty', 'The diagram has no semantic nodes.', {
      hint: 'Describe at least one entity, step, class, participant, or component.',
    }))
    return
  }
  const ids = new Set(ir.nodes.map(node => node.id))
  for (const edge of ir.edges) {
    if (!ids.has(edge.source)) {
      errors.push(issue('edge_source_missing', `Edge ${edge.id} references missing source "${edge.source}".`, {
        edge_id: edge.id,
      }))
    }
    if (!ids.has(edge.target)) {
      errors.push(issue('edge_target_missing', `Edge ${edge.id} references missing target "${edge.target}".`, {
        edge_id: edge.id,
      }))
    }
  }
  const groupIds = new Set(ir.groups.map(group => group.id))
  for (const group of ir.groups) {
    if (!group.node_ids.length) {
      warnings.push(issue('group_empty', `Group "${group.label}" contains no nodes.`, {
        severity: 'warning',
      }))
    }
    for (const nodeId of group.node_ids) {
      if (!ids.has(nodeId)) {
        errors.push(issue('group_node_missing', `Group "${group.label}" references missing node "${nodeId}".`, {
          node_id: nodeId,
        }))
      }
    }
  }
  for (const node of ir.nodes) {
    if (node.group_id && !groupIds.has(node.group_id)) {
      warnings.push(issue('node_group_missing', `Node "${node.label}" references missing group "${node.group_id}".`, {
        severity: 'warning',
        node_id: node.id,
      }))
    }
    if (node.group_id && !ir.groups.find(group => group.id === node.group_id)?.node_ids.includes(node.id)) {
      warnings.push(issue('group_membership_mismatch', `Node "${node.label}" is not listed inside its group.`, {
        severity: 'warning',
        node_id: node.id,
      }))
    }
  }
  for (const preserve of ir.constraints?.preserve ?? []) {
    if (!ids.has(preserve) && !ir.edges.some(edge => edge.id === preserve) && !groupIds.has(preserve)) {
      errors.push(issue('constraint_missing_element', `Revision requested preserving "${preserve}", but it does not exist.`, {
        hint: 'Check the element id or remove it from the preserve constraint.',
      }))
    }
  }
  duplicateNames(ir, errors, warnings)
}

function erdChecks(ir, errors, warnings) {
  const entities = ir.nodes.filter(node => !node.kind.endsWith('note'))
  const entityIds = new Set(entities.map(node => node.id))
  for (const entity of entities) {
    const names = new Set()
    for (const attribute of entity.attributes) {
      const key = attribute.name.toLowerCase()
      if (names.has(key)) {
        errors.push(issue('erd_duplicate_attribute', `Entity "${entity.name}" defines "${attribute.name}" more than once.`, {
          node_id: entity.id,
        }))
      }
      names.add(key)
      if (!attribute.type) {
        warnings.push(issue('erd_attribute_type_missing', `Attribute "${entity.name}.${attribute.name}" has no declared data type.`, {
          severity: 'warning',
          node_id: entity.id,
          hint: 'Data types are optional for conceptual ERDs.',
        }))
      }
    }
    const pk = primaryKey(entity)
    if (!pk.length) {
      warnings.push(issue('erd_missing_primary_key', `Entity "${entity.name}" has no primary key.`, {
        severity: 'warning',
        node_id: entity.id,
        hint: 'Add a primary key for a logical/physical ERD, or confirm this is conceptual.',
      }))
    }
    for (const attribute of entity.attributes.filter(attribute => attribute.foreign_key)) {
      if (!attribute.references?.entity_id) {
        errors.push(issue('erd_fk_reference_missing', `Foreign key "${entity.name}.${attribute.name}" does not name a referenced entity.`, {
          node_id: entity.id,
          hint: 'Provide the referenced table/column or clarify the relationship.',
        }))
        continue
      }
      const target = findNode(ir, attribute.references.entity_id)
      if (!target || !entityIds.has(target.id)) {
        errors.push(issue('erd_fk_entity_missing', `Foreign key "${entity.name}.${attribute.name}" references unknown entity "${attribute.references.entity_id}".`, {
          node_id: entity.id,
        }))
        continue
      }
      const targetPk = primaryKey(target)
      let targetAttribute = null
      if (attribute.references.attribute_id) {
        targetAttribute = target.attributes.find(attr => attr.id === attribute.references.attribute_id) ?? null
      } else if (attribute.references.attribute_name) {
        targetAttribute = target.attributes.find(attr => attr.name.toLowerCase() === attribute.references.attribute_name.toLowerCase()) ?? null
      } else if (targetPk.length === 1) {
        targetAttribute = targetPk[0]
        warnings.push(issue('erd_fk_referenced_column_inferred', `Foreign key "${entity.name}.${attribute.name}" does not name a column; "${target.name}.${targetAttribute.name}" was used as the referenced primary key.`, {
          severity: 'warning',
          node_id: entity.id,
          hint: 'Specify referenced columns explicitly if this assumption is wrong.',
        }))
      } else if (targetPk.length > 1) {
        warnings.push(issue('erd_fk_composite_reference_unresolved', `Foreign key "${entity.name}.${attribute.name}" targets "${target.name}", which has a composite primary key; referenced columns are ambiguous.`, {
          severity: 'warning',
          node_id: entity.id,
        }))
      }
      if (targetAttribute && !targetAttribute.primary_key && !targetAttribute.unique) {
        errors.push(issue('erd_fk_not_unique', `Foreign key "${entity.name}.${attribute.name}" references "${target.name}.${targetAttribute.name}", which is neither a primary key nor unique.`, {
          node_id: entity.id,
        }))
      }
      if (targetAttribute && attribute.type && targetAttribute.type && attribute.type.toLowerCase() !== targetAttribute.type.toLowerCase()) {
        warnings.push(issue('erd_fk_type_mismatch', `Foreign key "${entity.name}.${attribute.name}" type "${attribute.type}" differs from referenced type "${targetAttribute.type}".`, {
          severity: 'warning',
          node_id: entity.id,
        }))
      }
      if (targetAttribute && targetPk.length > 1 && targetAttribute.primary_key) {
        warnings.push(issue('erd_fk_composite_partial', `Foreign key "${entity.name}.${attribute.name}" maps only part of the composite key of "${target.name}".`, {
          severity: 'warning',
          node_id: entity.id,
        }))
      }
    }
  }

  const seenPairs = new Set()
  for (const edge of ir.edges) {
    const source = findNode(ir, edge.source)
    const target = findNode(ir, edge.target)
    if (!source || !target) continue
    if (source.id === target.id) {
      warnings.push(issue('erd_self_relationship', `Relationship "${edge.id}" connects "${source.name}" to itself.`, {
        severity: 'warning',
        edge_id: edge.id,
      }))
    }
    const pair = [source.id, target.id].sort().join('|')
    if (seenPairs.has(pair)) {
      warnings.push(issue('erd_duplicate_relationship', `More than one relationship connects "${source.name}" and "${target.name}".`, {
        severity: 'warning',
        edge_id: edge.id,
      }))
    }
    seenPairs.add(pair)
    if (edge.source_cardinality === 'many' && edge.target_cardinality === 'many') {
      warnings.push(issue('erd_many_to_many', `"${source.name}" and "${target.name}" are many-to-many; consider an associative entity if the relationship has attributes.`, {
        severity: 'warning',
        edge_id: edge.id,
      }))
    }
  }

  // Every declared FK should be represented by a relationship edge unless the
  // relationship is many-to-many or the user explicitly separated concerns.
  for (const entity of entities) {
    for (const attribute of entity.attributes.filter(attribute => attribute.foreign_key && attribute.references?.entity_id)) {
      const target = findNode(ir, attribute.references.entity_id)
      if (!target) continue
      const relationship = ir.edges.find(edge => (edge.source === entity.id && edge.target === target.id) || (edge.source === target.id && edge.target === entity.id))
      if (!relationship) {
        warnings.push(issue('erd_fk_without_relationship', `Foreign key "${entity.name}.${attribute.name}" has no relationship line to "${target.name}".`, {
          severity: 'warning',
          node_id: entity.id,
          hint: 'Add a relationship edge to make the reference visible in the diagram.',
        }))
      } else {
        // A relationship may be drawn parent -> child or child -> parent. The
        // FK holder is always the "many"/dependent endpoint.
        const dependentCardinality = relationship.source === entity.id ? relationship.source_cardinality : relationship.target_cardinality
        const expected = attribute.unique ? ['one', 'zero_or_one'] : ['many', 'one_or_more']
        if (!expected.includes(dependentCardinality)) {
          warnings.push(issue('erd_cardinality_fk_mismatch', `Relationship cardinality at "${target.name}" may contradict the ${attribute.unique ? 'unique' : 'non-unique'} foreign key "${entity.name}.${attribute.name}".`, {
            severity: 'warning',
            edge_id: relationship.id,
            hint: `Expected target cardinality: ${attribute.unique ? 'one/zero_or_one' : 'many/one_or_more'}.`,
          }))
        }
        if (Boolean(relationship.source_optional) !== Boolean(attribute.nullable)) {
          warnings.push(issue('erd_optionality_fk_mismatch', `Relationship optionality at "${entity.name}" may contradict whether "${attribute.name}" is nullable.`, {
            severity: 'warning',
            edge_id: relationship.id,
          }))
        }
      }
    }
  }

  for (const edge of ir.edges) {
    if (edge.kind === 'identifying') {
      const source = findNode(ir, edge.source)
      const target = findNode(ir, edge.target)
      if (source && target) {
        const inherited = source.attributes.some(attribute => attribute.foreign_key && attribute.references?.entity_id === target.id && attribute.primary_key)
        if (!inherited) {
          warnings.push(issue('erd_identifying_without_pk_fk', `Identifying relationship ${edge.id} is not backed by a primary-key foreign key.`, {
            severity: 'warning',
            edge_id: edge.id,
          }))
        }
      }
    }
  }
}

function flowchartChecks(ir, errors, warnings) {
  const { outgoing, incoming } = adjacency(ir)
  const semantic = ir.nodes.filter(node => node.kind !== 'note')
  const starts = semantic.filter(node => node.kind === 'start')
  const ends = semantic.filter(node => node.kind === 'end')
  if (!starts.length) errors.push(issue('flow_missing_start', 'Flowchart has no start node.'))
  if (starts.length > 1) warnings.push(issue('flow_multiple_starts', 'Flowchart has multiple start nodes.', { severity: 'warning' }))
  if (!ends.length) errors.push(issue('flow_missing_end', 'Flowchart has no end node.'))
  for (const node of semantic) {
    if (node.kind === 'start' && (incoming.get(node.id) ?? []).length) {
      warnings.push(issue('flow_start_has_incoming', `Start node "${node.label}" has incoming edges.`, { severity: 'warning', node_id: node.id }))
    }
    if (node.kind === 'end' && (outgoing.get(node.id) ?? []).length) {
      errors.push(issue('flow_end_has_outgoing', `End node "${node.label}" has outgoing edges.`, { node_id: node.id }))
    }
    if (node.kind === 'decision') {
      const out = outgoing.get(node.id) ?? []
      if (out.length < 2) {
        errors.push(issue('flow_decision_branch_count', `Decision "${node.label}" needs at least two outgoing branches.`, { node_id: node.id }))
      }
      for (const edge of out) {
        if (!edge.label && !edge.guard) {
          warnings.push(issue('flow_decision_label_missing', `Branch from decision "${node.label}" has no condition label.`, {
            severity: 'warning',
            edge_id: edge.id,
          }))
        }
      }
    }
    if (node.kind === 'process' && !(outgoing.get(node.id) ?? []).length && !(incoming.get(node.id) ?? []).length) {
      warnings.push(issue('flow_isolated_process', `Process "${node.label}" is isolated.`, { severity: 'warning', node_id: node.id }))
    }
    if (node.kind === 'subprocess' && !(outgoing.get(node.id) ?? []).length) {
      warnings.push(issue('flow_subprocess_no_exit', `Subprocess "${node.label}" has no exit path.`, { severity: 'warning', node_id: node.id }))
    }
  }
  if (starts.length) {
    const reachable = reachableFrom(starts.map(node => node.id), outgoing)
    for (const node of semantic) {
      if (!reachable.has(node.id)) {
        errors.push(issue('flow_unreachable_node', `Node "${node.label}" is not reachable from any start node.`, { node_id: node.id }))
      }
    }
    if (ends.length && !ends.some(node => reachable.has(node.id))) {
      errors.push(issue('flow_no_path_to_end', 'No end node is reachable from the start node.'))
    }
  }
  for (const edge of ir.edges) {
    const source = findNode(ir, edge.source)
    if (source?.kind === 'decision' && !edge.label && !edge.guard) {
      // Already reported above; keeps edge-specific context.
    }
  }
}

function activityChecks(ir, errors, warnings) {
  const { outgoing, incoming } = adjacency(ir)
  const semantic = ir.nodes.filter(node => node.kind !== 'note')
  const initials = semantic.filter(node => node.kind === 'initial')
  const finals = semantic.filter(node => node.kind === 'final')
  if (initials.length !== 1) {
    errors.push(issue('activity_initial_count', `Activity diagram must have exactly one initial node (found ${initials.length}).`))
  }
  if (!finals.length) warnings.push(issue('activity_missing_final', 'Activity diagram has no final node.', { severity: 'warning' }))
  for (const node of semantic) {
    const out = outgoing.get(node.id) ?? []
    const into = incoming.get(node.id) ?? []
    if (node.kind === 'initial' && (out.length !== 1 || into.length)) {
      errors.push(issue('activity_initial_shape', `Initial node "${node.label}" must have exactly one outgoing edge and no incoming edges.`, { node_id: node.id }))
    }
    if (node.kind === 'final' && out.length) {
      errors.push(issue('activity_final_outgoing', `Final node "${node.label}" must not have outgoing edges.`, { node_id: node.id }))
    }
    if (node.kind === 'decision' && out.length < 2) {
      errors.push(issue('activity_decision_branches', `Decision "${node.label}" needs at least two outgoing branches.`, { node_id: node.id }))
    }
    if (node.kind === 'merge' && into.length < 2) {
      warnings.push(issue('activity_merge_incoming', `Merge "${node.label}" has fewer than two incoming branches.`, { severity: 'warning', node_id: node.id }))
    }
    if (node.kind === 'fork' && out.length < 2) {
      errors.push(issue('activity_fork_branches', `Fork "${node.label}" needs at least two outgoing branches.`, { node_id: node.id }))
    }
    if (node.kind === 'join' && into.length < 2) {
      errors.push(issue('activity_join_branches', `Join "${node.label}" needs at least two incoming branches.`, { node_id: node.id }))
    }
    if (node.kind === 'decision') {
      for (const edge of out) {
        if (!edge.guard && !edge.label) {
          warnings.push(issue('activity_guard_missing', `Decision branch from "${node.label}" has no guard.`, { severity: 'warning', edge_id: edge.id }))
        }
      }
    }
  }
  if (initials.length === 1) {
    const reachable = reachableFrom([initials[0].id], outgoing)
    for (const node of semantic) {
      if (!reachable.has(node.id)) errors.push(issue('activity_unreachable', `Activity "${node.label}" is unreachable from the initial node.`, { node_id: node.id }))
    }
  }
}

function stateChecks(ir, errors, warnings) {
  const { outgoing, incoming } = adjacency(ir)
  const semantic = ir.nodes.filter(node => node.kind !== 'note')
  const initials = semantic.filter(node => node.kind === 'initial')
  const finals = semantic.filter(node => node.kind === 'final')
  if (initials.length !== 1) {
    errors.push(issue('state_initial_count', `State machine must have exactly one initial pseudostate (found ${initials.length}).`))
  }
  if (!finals.length) warnings.push(issue('state_missing_final', 'State machine has no final state.', { severity: 'warning' }))
  for (const node of semantic) {
    const out = outgoing.get(node.id) ?? []
    const into = incoming.get(node.id) ?? []
    if (node.kind === 'initial' && (out.length !== 1 || into.length)) {
      errors.push(issue('state_initial_shape', `Initial state must have one outgoing transition and no incoming transitions.`, { node_id: node.id }))
    }
    if (node.kind === 'final' && out.length) {
      errors.push(issue('state_final_outgoing', `Final state "${node.label}" must not have outgoing transitions.`, { node_id: node.id }))
    }
    if (node.kind === 'choice' && out.length < 2) {
      errors.push(issue('state_choice_branches', `Choice "${node.label}" needs at least two outgoing transitions.`, { node_id: node.id }))
    }
    if (node.kind === 'choice') {
      for (const edge of out) {
        if (!edge.guard && !edge.label) {
          warnings.push(issue('state_guard_missing', `Choice branch from "${node.label}" has no guard.`, { severity: 'warning', edge_id: edge.id }))
        }
      }
    }
  }
  if (initials.length === 1) {
    const reachable = reachableFrom([initials[0].id], outgoing)
    for (const node of semantic) {
      if (!reachable.has(node.id)) errors.push(issue('state_unreachable', `State "${node.label}" is unreachable from the initial state.`, { node_id: node.id }))
    }
  }
}

function classChecks(ir, errors, warnings) {
  const { outgoing } = adjacency(ir)
  const semantic = ir.nodes.filter(node => node.kind !== 'note')
  const map = new Map(semantic.map(node => [node.id, node]))
  for (const node of semantic) {
    if (!node.name) errors.push(issue('class_name_missing', `Class ${node.id} has no name.`, { node_id: node.id }))
    const memberNames = new Set()
    for (const member of [...node.attributes, ...node.methods]) {
      const key = member.name.toLowerCase()
      if (memberNames.has(key)) {
        errors.push(issue('class_duplicate_member', `Class "${node.name}" defines "${member.name}" more than once.`, { node_id: node.id }))
      }
      memberNames.add(key)
    }
  }
  const inheritanceGraph = new Map(semantic.map(node => [node.id, []]))
  for (const edge of ir.edges) {
    const source = map.get(edge.source)
    const target = map.get(edge.target)
    if (!source || !target) continue
    if (edge.kind === 'inheritance') {
      if (source.id === target.id) errors.push(issue('class_self_inheritance', `Class "${source.name}" inherits from itself.`, { edge_id: edge.id }))
      if (target.kind === 'enum') errors.push(issue('class_inherit_enum', `Class "${source.name}" cannot inherit from enum "${target.name}".`, { edge_id: edge.id }))
      inheritanceGraph.get(source.id)?.push(target.id)
      if (target.kind !== 'class' && target.kind !== 'abstract' && target.kind !== 'interface') {
        warnings.push(issue('class_inherit_target_kind', `Inheritance target "${target.name}" is not a class or interface.`, { severity: 'warning', edge_id: edge.id }))
      }
    }
    if (edge.kind === 'realization' && target.kind !== 'interface') {
      errors.push(issue('class_realization_target', `Realization must target an interface, but "${target.name}" is a ${target.kind}.`, { edge_id: edge.id }))
    }
    if (['aggregation', 'composition'].includes(edge.kind) && target.kind === 'interface') {
      warnings.push(issue('class_whole_is_interface', `${edge.kind} targets interface "${target.name}".`, { severity: 'warning', edge_id: edge.id }))
    }
  }
  const visiting = new Set()
  const visited = new Set()
  const visit = id => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    for (const next of inheritanceGraph.get(id) ?? []) {
      if (visit(next)) return true
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }
  if ([...inheritanceGraph.keys()].some(visit)) {
    errors.push(issue('class_inheritance_cycle', 'The class inheritance graph contains a cycle.'))
  }
  for (const node of semantic) {
    if (node.kind === 'class' && !(outgoing.get(node.id) ?? []).length && !ir.edges.some(edge => edge.target === node.id)) {
      warnings.push(issue('class_isolated', `Class "${node.name}" has no relationships.`, { severity: 'warning', node_id: node.id }))
    }
  }
}

function usecaseChecks(ir, errors, warnings) {
  const { outgoing } = adjacency(ir)
  const map = new Map(ir.nodes.map(node => [node.id, node]))
  for (const edge of ir.edges) {
    const source = map.get(edge.source)
    const target = map.get(edge.target)
    if (!source || !target) continue
    if (edge.kind === 'association') {
      const pair = new Set([source.kind, target.kind])
      if (!(pair.has('actor') && pair.has('usecase'))) {
        errors.push(issue('usecase_association_endpoints', `Association ${edge.id} must connect an actor to a use case.`, { edge_id: edge.id }))
      }
    }
    if (['include', 'extend'].includes(edge.kind)) {
      if (source.kind !== 'usecase' || target.kind !== 'usecase') {
        errors.push(issue('usecase_relation_endpoints', `${edge.kind} must connect two use cases.`, { edge_id: edge.id }))
      }
    }
    if (edge.kind === 'generalization' && source.kind !== target.kind) {
      warnings.push(issue('usecase_generalization_kind', `Generalization connects a ${source.kind} to a ${target.kind}.`, { severity: 'warning', edge_id: edge.id }))
    }
  }
  for (const node of ir.nodes) {
    if (node.kind === 'actor') {
      const linked = ir.edges.some(edge => edge.source === node.id || edge.target === node.id)
      if (!linked) warnings.push(issue('usecase_actor_unlinked', `Actor "${node.name}" has no associations.`, { severity: 'warning', node_id: node.id }))
    }
    if (node.kind === 'usecase') {
      const linked = ir.edges.some(edge => edge.source === node.id || edge.target === node.id)
      if (!linked) warnings.push(issue('usecase_unlinked', `Use case "${node.name}" is not connected.`, { severity: 'warning', node_id: node.id }))
    }
  }
}

function sequenceChecks(ir, errors, warnings) {
  const participants = new Map(ir.nodes.map(node => [node.id, node]))
  if (ir.nodes.length < 1) errors.push(issue('sequence_no_participants', 'Sequence diagram has no participants.'))
  if (!ir.edges.length) warnings.push(issue('sequence_no_messages', 'Sequence diagram has no messages.', { severity: 'warning' }))
  const orders = new Map()
  for (const message of ir.edges) {
    if (!participants.has(message.source)) {
      errors.push(issue('sequence_sender_missing', `Message ${message.id} has an unknown sender "${message.source}".`, { edge_id: message.id }))
    }
    if (!participants.has(message.target)) {
      errors.push(issue('sequence_receiver_missing', `Message ${message.id} has an unknown receiver "${message.target}".`, { edge_id: message.id }))
    }
    if (orders.has(message.order)) {
      warnings.push(issue('sequence_duplicate_order', `Messages ${orders.get(message.order)} and ${message.id} share sequence number ${message.order}.`, {
        severity: 'warning',
        edge_id: message.id,
      }))
    }
    orders.set(message.order, message.id)
    if (!message.text && !message.label) {
      warnings.push(issue('sequence_message_label_missing', `Message ${message.id} has no label.`, { severity: 'warning', edge_id: message.id }))
    }
  }
  const sorted = [...ir.edges].sort((a, b) => a.order - b.order)
  for (let index = 0; index < sorted.length; index += 1) {
    const message = sorted[index]
    if (message.kind === 'return') {
      const priorSync = sorted.slice(0, index).some(candidate =>
        ['sync', 'async'].includes(candidate.kind) &&
        candidate.source === message.target &&
        candidate.target === message.source)
      if (!priorSync) {
        warnings.push(issue('sequence_return_unmatched', `Return message ${message.id} has no preceding call in the opposite direction.`, {
          severity: 'warning',
          edge_id: message.id,
        }))
      }
    }
  }
  const participantIds = new Set(ir.nodes.map(node => node.id))
  const used = new Set(ir.edges.flatMap(message => [message.source, message.target]))
  for (const node of ir.nodes) {
    if (!used.has(node.id)) warnings.push(issue('sequence_participant_unused', `Participant "${node.name}" has no messages.`, { severity: 'warning', node_id: node.id }))
  }
  const messageIds = new Set(ir.edges.map(message => message.id))
  const ranges = []
  for (const frame of ir.frames) {
    if (!frame.message_ids.length) {
      warnings.push(issue('sequence_frame_empty', `Frame "${frame.label || frame.kind}" contains no messages.`, { severity: 'warning' }))
    }
    for (const messageId of frame.message_ids) {
      if (!messageIds.has(messageId)) {
        errors.push(issue('sequence_frame_message_missing', `Frame "${frame.label || frame.kind}" references missing message "${messageId}".`))
      }
    }
    const indexes = frame.message_ids.map(id => sorted.findIndex(message => message.id === id)).filter(index => index >= 0)
    if (indexes.length) ranges.push({ frame, min: Math.min(...indexes), max: Math.max(...indexes) })
    if (['alt', 'loop'].includes(frame.kind) && !frame.label) {
      warnings.push(issue('sequence_frame_label_missing', `${frame.kind} frame should describe its condition or iteration.`, { severity: 'warning' }))
    }
  }
  for (let a = 0; a < ranges.length; a += 1) {
    for (let b = a + 1; b < ranges.length; b += 1) {
      const first = ranges[a]
      const second = ranges[b]
      const overlaps = first.min <= second.max && second.min <= first.max
      const nested = (first.min <= second.min && first.max >= second.max) || (second.min <= first.min && second.max >= first.max)
      if (overlaps && !nested) {
        warnings.push(issue('sequence_frames_overlap', `Frames "${first.frame.id}" and "${second.frame.id}" partially overlap; move them to whole message ranges.`, {
          severity: 'warning',
        }))
      }
    }
  }
  if (sorted.length && sorted[0].kind === 'return') {
    errors.push(issue('sequence_return_first', 'The first message cannot be a return message.', { edge_id: sorted[0].id }))
  }
  if (![...participantIds].every(id => participants.has(id))) {
    errors.push(issue('sequence_participant_missing', 'Sequence diagram contains an invalid participant reference.'))
  }
}

function architectureChecks(ir, errors, warnings) {
  const componentIds = new Set(ir.nodes.map(node => node.id))
  if (!ir.nodes.length) errors.push(issue('architecture_empty', 'Architecture diagram has no components.'))
  for (const edge of ir.edges) {
    if (!componentIds.has(edge.source) || !componentIds.has(edge.target)) continue
    if (edge.source === edge.target) {
      warnings.push(issue('architecture_self_dependency', `Component "${edge.source}" depends on itself.`, { severity: 'warning', edge_id: edge.id }))
    }
    if (!edge.label) {
      warnings.push(issue('architecture_edge_label_missing', `Connection ${edge.id} has no protocol or purpose label.`, { severity: 'warning', edge_id: edge.id }))
    }
  }
  const memberships = new Map()
  for (const group of ir.groups) {
    for (const nodeId of group.node_ids) {
      if (!memberships.has(nodeId)) memberships.set(nodeId, [])
      memberships.get(nodeId).push(group.id)
    }
  }
  for (const [nodeId, groups] of memberships) {
    if (groups.length > 1) {
      warnings.push(issue('architecture_node_multiple_groups', `Component "${nodeId}" belongs to multiple boundaries (${groups.join(', ')}).`, {
        severity: 'warning',
        node_id: nodeId,
      }))
    }
  }
  const used = new Set(ir.edges.flatMap(edge => [edge.source, edge.target]))
  for (const node of ir.nodes) {
    if (node.kind === 'boundary') continue
    if (!used.has(node.id)) warnings.push(issue('architecture_isolated', `Component "${node.name}" has no dependencies.`, { severity: 'warning', node_id: node.id }))
  }
}

export function validateDiagram(ir) {
  const errors = []
  const warnings = []
  const checks = []
  commonChecks(ir, errors, warnings)
  const before = errors.length
  switch (ir.diagram_type) {
    case 'erd': erdChecks(ir, errors, warnings); break
    case 'flowchart': flowchartChecks(ir, errors, warnings); break
    case 'uml_activity': activityChecks(ir, errors, warnings); break
    case 'uml_state': stateChecks(ir, errors, warnings); break
    case 'uml_class': classChecks(ir, errors, warnings); break
    case 'uml_usecase': usecaseChecks(ir, errors, warnings); break
    case 'sequence': sequenceChecks(ir, errors, warnings); break
    case 'architecture': architectureChecks(ir, errors, warnings); break
    default:
      errors.push(issue('unsupported_type', `No semantic validator exists for "${ir.diagram_type}".`))
  }
  checks.push({ id: 'common_structure', status: errors.length === before ? 'passed' : 'failed' })
  checks.push({ id: `${ir.diagram_type}_rules`, status: errors.length > before ? 'failed' : 'passed' })
  checks.push({ id: 'nonblocking_review', status: warnings.length ? 'warning' : 'passed' })

  return {
    status: errors.length ? 'FAILED' : 'PASSED',
    errors,
    warnings,
    assumptions: Array.isArray(ir.assumptions) ? [...ir.assumptions] : [],
    checks,
    stats: {
      errors: errors.length,
      warnings: warnings.length,
      nodes: ir.nodes.length,
      edges: ir.edges.length,
    },
  }
}
