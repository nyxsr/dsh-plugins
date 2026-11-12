/** UML state-machine extraction from arrow notation or status narratives. */
import { oneLine } from '../core/text.js'
import { IRBuilder, splitTopLevel } from './common.js'

const INITIAL_RAW = /^(?:\[\*\]|initial|start|mulai|awal)$/i
const FINAL_RAW = /^(?:\[\*\]|final|end|selesai|akhir)$/i

function normalizeMarker(value) {
  return oneLine(value, 100)
    .replace(/\s+/g, ' ')
    .replace(/^\[\s*\*\s*\]$/, '[*]')
    .trim()
}

function cleanState(raw) {
  const text = normalizeMarker(raw)
  return text
    .replace(/^(?:state|status|keadaan)\s+/i, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/[.,;]+$/, '')
    .trim()
}

function parseToken(raw) {
  let token = normalizeMarker(raw)
  let suffix = ''
  const suffixIndex = token.search(/\s*(?:\[[^\]]*\]|:\s|\/\s)/)
  if (suffixIndex > 0) {
    suffix = token.slice(suffixIndex).trim()
    token = token.slice(0, suffixIndex).trim()
  }
  let kind = 'state'
  const shaped = token.match(/^\{([^{}]+)\}$/)
  if (shaped) {
    token = shaped[1].trim()
    kind = 'choice'
  }
  token = token.replace(/^\(\(|\)\)$/g, '').trim()
  return { raw: token, name: cleanState(token), suffix, kind }
}

function parseSuffix(raw) {
  let text = oneLine(raw, 200)
  let guard = ''
  let action = ''
  let label = ''
  const guardMatch = text.match(/\[([^\]]+)\]/)
  if (guardMatch) {
    guard = guardMatch[1].trim()
    text = text.replace(guardMatch[0], '').trim()
  }
  const actionMatch = text.match(/\/\s*(.+)$/)
  if (actionMatch) {
    action = actionMatch[1].trim()
    text = text.replace(actionMatch[0], '').trim()
  }
  label = text.replace(/^[:：]\s*/, '').trim()
  if (!label && guard) label = guard
  return { label, guard, action }
}

export function parseState({ requirement, title, language, theme, orientation, density }) {
  const builder = new IRBuilder({ diagramType: 'uml_state', title, language, requirement })
  const text = String(requirement ?? '')
  const states = new Map()
  let initial = null
  let final = null

  const ensureInitial = () => {
    if (!initial) initial = builder.addNode({ kind: 'initial', name: 'Initial', label: 'Initial' })
    return initial
  }
  const ensureFinal = () => {
    if (!final) final = builder.addNode({ kind: 'final', name: 'Final', label: 'Final' })
    return final
  }
  const addState = (raw, kind = 'state') => {
    const name = cleanState(raw)
    if (!name) return null
    if (INITIAL_RAW.test(normalizeMarker(raw)) || INITIAL_RAW.test(name)) return ensureInitial()
    if (FINAL_RAW.test(normalizeMarker(raw)) || FINAL_RAW.test(name)) return ensureFinal()
    const key = name.toLowerCase()
    if (states.has(key)) return states.get(key)
    const finalKind = kind === 'choice' || /\?$/.test(name) ? 'choice' : 'state'
    const node = builder.addNode({ kind: finalKind, name, label: name })
    states.set(key, node)
    return node
  }

  // Explicit state lists. "status pengiriman: A, B" is accepted as a list too.
  const listPatterns = [
    /\b(?:states?|statuses|daftar\s+status)\s*[:=]\s*([^.;\n]+)/i,
    /\bstatus\s+[^:.;\n]{1,40}:\s*([^.;\n]+)/i,
  ]
  for (const pattern of listPatterns) {
    const found = text.match(pattern)
    if (!found) continue
    for (const item of splitTopLevel(found[1], /[,;]/)) {
      for (const sub of String(item).split(/\s+(?:dan|and)\s+/i)) addState(sub)
    }
  }
  for (const found of text.matchAll(/\bstate\s+("([^"]+)"|[A-Za-z_][\w -]{0,60})(?=[;,\n]|$)/gi)) {
    addState(found[2] ?? found[1])
  }

  const addTransition = (sourceRaw, targetRaw, suffix = '') => {
    const sourceToken = parseToken(sourceRaw)
    const targetToken = parseToken(targetRaw)
    const source = sourceToken.raw === '[*]' ? ensureInitial() : addState(sourceToken.raw, sourceToken.kind)
    const target = targetToken.raw === '[*]' ? ensureFinal() : addState(targetToken.raw, targetToken.kind)
    if (!source || !target || source.id === target.id) return
    const meta = parseSuffix(suffix)
    if (builder.ir.edges.some(edge => edge.source === source.id && edge.target === target.id && edge.label === meta.label)) return
    builder.addEdge({
      kind: 'transition',
      source: source.id,
      target: target.id,
      label: meta.label,
      guard: meta.guard,
      action: meta.action,
    })
  }

  const addChain = raw => {
    const tokens = String(raw)
      .split(/\s*(?:-->|->|→|⇒|=>)\s*/)
      .map(token => token.trim().replace(/[.,;]+$/, ''))
      .filter(Boolean)
    if (tokens.length < 2) return false
    for (let index = 0; index < tokens.length - 1; index += 1) {
      addTransition(tokens[index], tokens[index + 1], parseToken(tokens[index + 1]).suffix)
    }
    return true
  }

  const lines = text
    .replace(/\r/g, '')
    .split(/\n|;/)
  for (let rawLine of lines) {
    let line = oneLine(rawLine, 300).replace(/^[-*•]\s*/, '')
    if (!line) continue
    line = line.replace(/^(?:state\s*machine|state\s*diagram|statechart|status\s+\w+)\b[^:]*:\s*/i, '')
    if (!line) continue
    const statements = line.split(/\.\s+(?=[A-Z_\[*])/)
    for (const statement of statements) {
      const arrow = /(?:-->|->|→|⇒|=>)/.test(statement)
      if (arrow && addChain(statement)) continue
      const natural = statement.match(/^(.+?)\s+(?:menjadi|berubah\s+menjadi|beralih\s+ke|transitions?\s+to|moves?\s+to|goes?\s+to)\s+(.+?)(?:\s+jika\s+(.+))?$/i)
      if (natural) {
        addTransition(natural[1], natural[2], natural[3] ? `jika ${natural[3]}` : '')
      }
    }
  }

  const stateNodes = () => builder.ir.nodes.filter(node => node.kind === 'state' || node.kind === 'choice')
  if (!initial) {
    const first = stateNodes()[0]
    if (first) {
      ensureInitial()
      builder.addEdge({ kind: 'transition', source: initial.id, target: first.id })
      builder.assume('An initial pseudostate was connected to the first declared state because no initial marker was supplied.')
    }
  }
  if (!final) {
    const candidates = stateNodes()
    const terminal = candidates.filter(node => !builder.ir.edges.some(edge => edge.source === node.id))
    const target = terminal[0] ?? candidates.at(-1)
    if (target) {
      ensureFinal()
      builder.addEdge({ kind: 'transition', source: target.id, target: final.id })
      builder.assume('A final state was added from the last terminal state because no final marker was supplied.')
    }
  }
  if (initial && !builder.ir.edges.some(edge => edge.source === initial.id)) {
    const first = stateNodes()[0]
    if (first) builder.addEdge({ kind: 'transition', source: initial.id, target: first.id })
  }
  if (final && !builder.ir.edges.some(edge => edge.target === final.id)) {
    const last = stateNodes().at(-1)
    if (last) builder.addEdge({ kind: 'transition', source: last.id, target: final.id })
  }

  if (!stateNodes().length) {
    builder.clarify('No states were found. Describe states and transitions, for example "Draft -> Submitted -> Approved".')
  }
  return builder.finish({ theme, orientation, density })
}
