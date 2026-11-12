/** UML use-case extraction: actors, use cases, associations and include/extend. */
import { oneLine } from '../core/text.js'
import { IRBuilder, cleanName, splitTopLevel } from './common.js'

function shortName(value, max = 70) {
  return oneLine(value, max)
    .replace(/^(?:aktor|actor|use\s*case|usecase|sistem|system)\s+/i, '')
    .replace(/^[-*•]\s*/, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/[.,;:]+$/, '')
    .trim()
}

function plausibleActor(value) {
  const text = shortName(value, 60)
  if (!text || text.length > 60) return false
  if (/\b(?:melakukan|menggunakan|memakai|dapat|bisa|uses?|can|include|extend|extends|diagram|sistem|system)\b/i.test(text)) return false
  if (/[:;]/.test(text)) return false
  return /^[A-Za-z][\w .&/-]*$/.test(text)
}

function plausibleUseCase(value) {
  const text = shortName(value, 90)
  if (!text || text.length > 90) return false
  if (/\b(?:diagram|sistem|system|aplikasi|application|aktor|actor)\b/i.test(text)) return false
  if (/[:=;]/.test(text)) return false
  return /^[A-Za-z][\w .,&/()-]*$/.test(text)
}

function splitList(value) {
  const items = []
  for (const part of splitTopLevel(value, /[,;]/)) {
    for (const sub of String(part).split(/\s+(?:dan|and|serta)\s+/i)) {
      const cleaned = shortName(sub)
      if (cleaned) items.push(cleaned)
    }
  }
  return items
}

function splitStatements(text) {
  return String(text ?? '')
    .replace(/\r/g, '')
    .replace(/;/g, '\n')
    .split(/\n|(?<=\.)\s+(?=[A-Z]|(?:use\s*cases?|usecases?|actors?|aktors?)\b)/)
    .map(line => line.trim())
    .filter(Boolean)
}

export function parseUseCase({ requirement, title, language, theme, orientation, density }) {
  const builder = new IRBuilder({ diagramType: 'uml_usecase', title, language, requirement })
  const actors = new Map()
  const useCases = new Map()

  const addActor = raw => {
    const name = shortName(raw, 60)
    if (!plausibleActor(name)) return null
    const key = name.toLowerCase()
    if (actors.has(key)) return actors.get(key)
    const existing = builder.resolve(name)
    if (existing) {
      const node = builder.ir.nodes.find(candidate => candidate.id === existing)
      if (node?.kind === 'actor') {
        actors.set(key, node)
        return node
      }
    }
    const node = builder.addNode({ kind: 'actor', name, label: name })
    actors.set(key, node)
    return node
  }

  const addUseCase = raw => {
    const name = shortName(raw, 90)
    if (!plausibleUseCase(name)) return null
    const key = name.toLowerCase()
    if (useCases.has(key)) return useCases.get(key)
    const existing = builder.resolve(name)
    if (existing) {
      const node = builder.ir.nodes.find(candidate => candidate.id === existing)
      if (node?.kind === 'usecase') {
        useCases.set(key, node)
        return node
      }
    }
    const node = builder.addNode({ kind: 'usecase', name, label: name })
    useCases.set(key, node)
    return node
  }

  for (let rawLine of splitStatements(requirement)) {
    let line = oneLine(rawLine, 300).replace(/^[-*•]\s*/, '')
    if (!line) continue
    line = line.replace(/^(?:use\s*case\s+diagram|usecase\s+diagram|diagram)\b[^:]*:\s*/i, '')
    line = line.replace(/^use\s*cases?\s+[^:]{1,60}:\s*(?=(?:actors?|aktors?|use\s*cases?|usecases?)\b)/i, '')
    if (!line) continue

    const actorDecl = line.match(/^(?:actors?|aktors?)\s*(?::|=)?\s+(.+)$/i)
    if (actorDecl) {
      for (const item of splitList(actorDecl[1])) addActor(item)
      continue
    }
    const useCaseDecl = line.match(/^(?:use\s*cases?|usecases?|fungsionalitas)\s*(?::|=)?\s+(.+)$/i)
    if (useCaseDecl) {
      for (const item of splitList(useCaseDecl[1])) addUseCase(item)
      continue
    }
  }

  const find = value => {
    const clean = cleanName(value)
    const id = builder.resolve(clean)
    return id ? builder.ir.nodes.find(node => node.id === id) : null
  }

  const addEdge = (source, target, kind, label = '') => {
    let from = find(source)
    let to = find(target)
    if (!from) {
      from = kind === 'association' || kind === 'generalization' ? addActor(source) : addUseCase(source)
      if (from) builder.assume(`"${from.name}" was referenced in a relationship and added as a ${from.kind}.`)
    }
    if (!to) {
      to = kind === 'generalization' ? addActor(target) ?? addUseCase(target) : addUseCase(target)
      if (to) builder.assume(`"${to.name}" was referenced in a relationship and added as a ${to.kind}.`)
    }
    if (!from || !to || from.id === to.id) return
    if (builder.ir.edges.some(edge => edge.source === from.id && edge.target === to.id && edge.kind === kind)) return
    builder.addEdge({ kind, source: from.id, target: to.id, label })
  }

  for (let rawLine of splitStatements(requirement)) {
    let line = oneLine(rawLine, 320).replace(/^[-*•]\s*/, '')
    if (!line) continue
    line = line.replace(/^(?:use\s*case\s+diagram|usecase\s+diagram|diagram)\b[^:]*:\s*/i, '')
    const arrow = line.match(/^(.+?)\s*(?:--\|>|->|→|=>)\s*(.+)$/)
    if (arrow) {
      const left = find(arrow[1])
      const right = find(arrow[2])
      if (left && right) {
        if (left.kind === 'actor' && right.kind === 'usecase') addEdge(left.name, right.name, 'association')
        else if (left.kind === 'usecase' && right.kind === 'usecase') addEdge(left.name, right.name, 'include')
        else if (left.kind === 'actor' && right.kind === 'actor') addEdge(left.name, right.name, 'generalization')
      }
      continue
    }
    const include = line.match(/^(.+?)\s*(?:<<\s*include\s*>>|includes?|memasukkan|termasuk)\s+(.+)$/i)
    if (include) {
      addEdge(include[1], include[2], 'include')
      continue
    }
    const extend = line.match(/^(.+?)\s*(?:<<\s*extend\s*>>|extends?|memperluas)\s+(.+)$/i)
    if (extend) {
      addEdge(extend[1], extend[2], 'extend')
      continue
    }
    const assoc = line.match(/^(.+?)\s+(?:melakukan|menggunakan|memakai|dapat|bisa|uses?|can|perform(?:s)?)\s+(.+)$/i)
    if (assoc) {
      for (const targetName of splitList(assoc[2])) addEdge(assoc[1], targetName, 'association')
    }
  }

  const useCaseNodes = builder.ir.nodes.filter(node => node.kind === 'usecase')
  if (useCaseNodes.length) {
    builder.addGroup({
      id: 'system-boundary',
      label: title || 'System Boundary',
      kind: 'system',
      node_ids: useCaseNodes.map(node => node.id),
      description: 'Use cases inside the system boundary.',
    })
  }

  if (!builder.ir.nodes.length) {
    builder.clarify('No use-case elements were found. Name the actors and use cases, for example "actor Customer; use cases Place Order, Track Order".')
  } else if (!useCaseNodes.length) {
    builder.clarify('Actors were found but no use cases were declared.')
  }
  return builder.finish({ theme, orientation, density })
}
