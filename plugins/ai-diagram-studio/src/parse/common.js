/** Shared helpers for the rule-based requirement parsers. */
import { nodeId, edgeId } from '../core/ids.js'
import { oneLine, slug } from '../core/text.js'
import { emptyIR, normalizeIR } from '../ir/index.js'

export function splitTopLevel(text, delimiters = ',') {
  const parts = []
  let current = ''
  let depth = 0
  let quote = null
  for (const char of String(text ?? '')) {
    if (quote) {
      current += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if ('([{'.includes(char)) depth += 1
    if (')]}'.includes(char)) depth = Math.max(0, depth - 1)
    if (depth === 0 && (delimiters instanceof RegExp ? delimiters.test(char) : Array.isArray(delimiters) ? delimiters.includes(char) : char === delimiters)) {
      parts.push(current)
      current = ''
      continue
    }
    if (depth === 0 && (char === '\n' || char === ';')) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  return parts.map(part => part.trim()).filter(Boolean)
}

export function normalizeLookup(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[`"'()[\]{}]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function singular(word) {
  const value = String(word ?? '')
  if (value.endsWith('ies') && value.length > 4) return `${value.slice(0, -3)}y`
  if (/(?:ches|shes|sses|xes|zes)$/.test(value)) return value.slice(0, -2)
  if (value.endsWith('s') && !value.endsWith('ss') && value.length > 3) return value.slice(0, -1)
  return value
}

export function looksLikeIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
}

export class IRBuilder {
  constructor({ diagramType, title, language, requirement, mode = 'natural_language' }) {
    this.ir = emptyIR({ diagramType, title, language, requirement, mode })
    this.usedNodeIds = new Set()
    this.usedEdgeIds = new Set()
    this.byName = new Map()
    this.assumptions = []
    this.clarifications = []
  }

  addNode(raw) {
    const name = oneLine(raw.name ?? raw.label ?? '', 120)
    if (!name) return null
    const id = raw.id && !this.usedNodeIds.has(raw.id) ? raw.id : nodeId(raw.id ?? name, this.usedNodeIds)
    const node = {
      ...raw,
      id,
      name,
      label: oneLine(raw.label ?? name, 160),
      attributes: raw.attributes ?? [],
      methods: raw.methods ?? [],
    }
    this.ir.nodes.push(node)
    const keys = new Set([normalizeLookup(name), normalizeLookup(singular(name)), normalizeLookup(id)])
    for (const key of keys) if (key && !this.byName.has(key)) this.byName.set(key, id)
    return node
  }

  resolve(value) {
    const key = normalizeLookup(value)
    if (!key) return null
    if (this.byName.has(key)) return this.byName.get(key)
    if (this.byName.has(normalizeLookup(singular(key)))) return this.byName.get(normalizeLookup(singular(key)))
    // Match only whole tokens, never a substring that could merge unrelated names.
    for (const [candidate, id] of this.byName) {
      if (candidate === key) return id
      if (candidate.split(' ').length === key.split(' ').length && candidate.endsWith(` ${key}`)) return id
    }
    return null
  }

  hasNode(id) {
    return this.ir.nodes.some(node => node.id === id)
  }

  addEdge(raw) {
    if (!raw.source || !raw.target) return null
    if (['flowchart', 'uml_activity', 'uml_state'].includes(this.ir.diagram_type)) {
      const duplicate = this.ir.edges.find(edge => edge.source === raw.source && edge.target === raw.target && edge.kind === (raw.kind ?? 'flow') && String(edge.label ?? '') === String(raw.label ?? ''))
      if (duplicate) return duplicate
    }
    const id = raw.id && !this.usedEdgeIds.has(raw.id) ? raw.id : edgeId(raw.id ?? `${raw.source}-${raw.target}`, this.usedEdgeIds)
    const edge = {
      kind: raw.kind ?? (this.ir.diagram_type === 'erd' ? 'relationship' : 'flow'),
      label: '',
      source_cardinality: 'one',
      target_cardinality: 'one',
      source_optional: false,
      target_optional: false,
      source_role: '',
      target_role: '',
      guard: '',
      action: '',
      text: '',
      order: this.ir.edges.length + 1,
      ...raw,
      id,
    }
    this.ir.edges.push(edge)
    return edge
  }

  addGroup(raw) {
    this.ir.groups.push({
      id: raw.id ?? `group-${this.ir.groups.length + 1}`,
      label: oneLine(raw.label ?? `Group ${this.ir.groups.length + 1}`, 120),
      kind: raw.kind ?? 'boundary',
      node_ids: raw.node_ids ?? [],
      description: raw.description ?? '',
    })
  }

  addFrame(raw) {
    this.ir.frames.push({
      id: raw.id ?? `frame-${this.ir.frames.length + 1}`,
      kind: raw.kind ?? 'opt',
      label: oneLine(raw.label ?? '', 160),
      message_ids: raw.message_ids ?? [],
    })
  }

  assume(text) {
    const value = oneLine(text, 400)
    if (value && !this.assumptions.includes(value)) this.assumptions.push(value)
  }

  clarify(text) {
    const value = oneLine(text, 400)
    if (value && !this.clarifications.includes(value)) this.clarifications.push(value)
  }

  finish({ theme, orientation, density, assumptions = [] }) {
    this.ir.assumptions = [...new Set([...assumptions, ...this.assumptions])].slice(0, 40)
    this.ir.style = {
      ...this.ir.style,
      theme: theme ?? this.ir.style.theme,
      orientation: orientation ?? this.ir.style.orientation,
      layout_density: density ?? this.ir.style.layout_density,
    }
    const normalized = normalizeIR(this.ir)
    return {
      ir: normalized,
      assumptions: normalized.assumptions,
      clarifications: this.clarifications,
    }
  }
}

export function stripLeadingNumber(value) {
  return String(value ?? '').replace(/^\s*(?:\d+[.)]|[-*•])\s+/, '').trim()
}

export function cleanName(value) {
  return oneLine(value, 100)
    .replace(/^(?:tabel|table|entity|entitas|class|kelas|aktor|actor|participant|komponen|component)\s+/i, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
}

export function identifierFrom(value, fallback = 'item') {
  return slug(value, fallback, 38).replace(/-/g, '_')
}
