/** UML class-diagram extraction for explicit and natural-language input. */
import { oneLine } from '../core/text.js'
import { IRBuilder, cleanName, splitTopLevel } from './common.js'

function multiplicity(value) {
  const token = String(value ?? '').trim().replace(/^"|"$/g, '')
  if (!token) return null
  if (/^(?:0\.\.1|\?|optional)$/.test(token)) return 'zero_or_one'
  if (/^(?:1\.\.\*|1\.\.n|1\.\.N|one or more)$/.test(token)) return 'one_or_more'
  if (/^(?:\*|0\.\.\*|n|m|many)$/i.test(token)) return 'many'
  if (/^(?:1|one)$/i.test(token)) return 'one'
  return null
}

function memberVisibility(value) {
  const token = String(value ?? '').trim()
  if (token.startsWith('-')) return 'private'
  if (token.startsWith('#')) return 'protected'
  if (token.startsWith('~')) return 'package'
  return 'public'
}

function parseMember(raw) {
  const member = oneLine(raw, 160).replace(/^[+\-#~]\s*/, '').trim()
  if (!member) return null
  const method = member.match(/^(?:(?:static|abstract|final)\s+)*([A-Za-z_][\w$]*)\s*\(([^)]*)\)\s*(?::\s*(.+))?$/)
  if (method) {
    return {
      kind: 'method',
      name: method[1],
      parameters: splitTopLevel(method[2] ?? '').map(parameter => oneLine(parameter, 80)),
      returns: oneLine(method[3] ?? '', 80),
      visibility: memberVisibility(raw),
      static: /\bstatic\b/i.test(raw),
      abstract: /\babstract\b/i.test(raw),
    }
  }
  const attribute = member.match(/^([A-Za-z_][\w$]*)\s*(?::\s*(.+))?$/)
  if (!attribute) return null
  const type = oneLine(attribute[2] ?? '', 80)
  return { kind: 'attribute', name: attribute[1], type, visibility: memberVisibility(raw), static: /\bstatic\b/i.test(raw) }
}

function parseBody(body) {
  const attributes = []
  const methods = []
  const members = String(body ?? '')
    .replace(/\r/g, '')
    .split(/[;\n]+/)
    .map(member => member.trim())
    .filter(Boolean)
  for (const member of members) {
    const parsed = parseMember(member)
    if (!parsed) continue
    if (parsed.kind === 'method') {
      methods.push({
        name: parsed.name,
        parameters: parsed.parameters,
        returns: parsed.returns,
        visibility: parsed.visibility,
        static: parsed.static,
        abstract: parsed.abstract,
      })
    } else {
      attributes.push({
        name: parsed.name,
        type: parsed.type,
        visibility: parsed.visibility,
        static: parsed.static,
      })
    }
  }
  return { attributes, methods }
}

function cleanClassRef(value) {
  const text = oneLine(value, 100)
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/^(?:class|kelas|interface|abstract\s+class)\s+/i, '')
    .trim()
  return /^[A-Za-z_][\w$]*$/.test(text) ? text : ''
}

function classKind(keyword) {
  const value = String(keyword ?? '').toLowerCase()
  if (/interface/.test(value)) return 'interface'
  if (/abstract/.test(value)) return 'abstract'
  if (/enum/.test(value)) return 'enum'
  return 'class'
}

export function parseClass({ requirement, title, language, theme, orientation, density }) {
  const builder = new IRBuilder({ diagramType: 'uml_class', title, language, requirement })
  const text = String(requirement ?? '')
  const seen = new Map()
  const addClass = (name, kind = 'class', body = '', stereotype = '') => {
    const clean = cleanClassRef(name)
    if (!clean) return null
    const key = clean.toLowerCase()
    if (seen.has(key)) {
      const existing = seen.get(key)
      if (body) {
        const parsed = parseBody(body)
        existing.attributes.push(...parsed.attributes)
        existing.methods.push(...parsed.methods)
      }
      return existing
    }
    const parsed = parseBody(body)
    const node = builder.addNode({
      kind,
      name: clean,
      label: clean,
      stereotype: stereotype || (kind === 'interface' ? 'interface' : kind === 'abstract' ? 'abstract' : kind === 'enum' ? 'enum' : ''),
      attributes: parsed.attributes,
      methods: parsed.methods,
    })
    seen.set(key, node)
    return node
  }

  const classBlock = /\b(interface|abstract\s+class|class|enum|kelas)\s+(?!diagram\b)([A-Za-z_][\w$]*)\b(?:\s+extends\s+([A-Za-z_][\w$]*(?:\s*,\s*[A-Za-z_][\w$]*)*))?(?:\s+implements\s+([A-Za-z_][\w$]*(?:\s*,\s*[A-Za-z_][\w$]*)*))?\s*(?:\{([^{}]*)\})?/gi
  const inheritance = []
  const realizations = []
  let match
  while ((match = classBlock.exec(text)) !== null) {
    const kind = classKind(match[1])
    const node = addClass(match[2], kind, match[5] ?? '')
    if (!node) continue
    for (const parent of splitTopLevel(match[3] ?? '', /,/)) {
      if (cleanClassRef(parent)) inheritance.push({ child: node.name, parent: cleanName(parent) })
    }
    for (const iface of splitTopLevel(match[4] ?? '', /,/)) {
      if (cleanClassRef(iface)) realizations.push({ child: node.name, iface: cleanName(iface) })
    }
  }

  // A declaration list such as "class diagram with classes User, Order, Product".
  if (!builder.ir.nodes.length) {
    const listMatch = text.match(/\b(?:classes|class\s+list|daftar\s+kelas|kelas)\s*[:=]\s*([^.;\n]+)/i)
      ?? text.match(/\b(?:dengan|with)\s+(?:class|classes|kelas)\s+([^.;\n]+)/i)
    if (listMatch) {
      for (const item of splitTopLevel(listMatch[1], /[,;]/)) {
        const parts = String(item).split(/\s+(?:dan|and)\s+/i)
        for (const part of parts) {
          const name = cleanClassRef(part)
          if (name && !/^(?:diagram|sistem|system|aplikasi|application)$/i.test(name)) addClass(name)
        }
      }
    }
  }
  if (!builder.ir.nodes.length) {
    const simple = text.match(/\b(?:class|kelas)\s+([A-Z][\w$]*(?:\s*,\s*[A-Z][\w$]*)*)/)
    if (simple) for (const name of splitTopLevel(simple[1], /,/)) addClass(name)
  }

  const has = value => {
    const id = builder.resolve(value)
    return id ? builder.ir.nodes.find(node => node.id === id) : null
  }

  const addRelation = (sourceName, targetName, kind, details = {}) => {
    const source = has(sourceName)
    const target = has(targetName)
    if (!source || !target || source.id === target.id) {
      if (source || target) builder.clarify(`The relationship "${sourceName} → ${targetName}" has an endpoint that is not a declared class.`)
      return
    }
    if (builder.ir.edges.some(edge => edge.source === source.id && edge.target === target.id && edge.kind === kind)) return
    builder.addEdge({
      kind,
      source: source.id,
      target: target.id,
      label: details.label ?? '',
      source_cardinality: details.sourceCardinality ?? 'one',
      target_cardinality: details.targetCardinality ?? 'one',
      source_role: details.sourceRole ?? '',
      target_role: details.targetRole ?? '',
    })
  }

  // Explicit UML arrow notation, one relationship per line.
  const arrowPattern = /(<\|--|<\|\.\.|\.\.\|>|\*--|o--|-->|\.\.>|--)/g
  for (const rawLine of text.split(/\r?\n|;|\.(?=\s|$)/)) {
    const line = oneLine(rawLine, 300)
    if (!line || !arrowPattern.test(line)) continue
    arrowPattern.lastIndex = 0
    const arrow = line.match(arrowPattern)?.[0]
    if (!arrow) continue
    const [leftRaw, ...rightParts] = line.split(arrow)
    let rightRaw = rightParts.join(arrow)
    let label = ''
    const colon = rightRaw.match(/^(.+?)\s*:\s*(.+)$/)
    if (colon) {
      rightRaw = colon[1]
      label = colon[2]
    }
    const leftIds = [...leftRaw.matchAll(/[A-Za-z_][\w$]*/g)].map(found => found[0])
    const rightIds = [...rightRaw.matchAll(/[A-Za-z_][\w$]*/g)].map(found => found[0])
    const left = leftIds.at(-1)
    const right = rightIds[0]
    if (!left || !right) continue
    const sourceCard = multiplicity(leftRaw.match(/"([^"]+)"/)?.[1])
    const targetCard = multiplicity(rightRaw.match(/"([^"]+)"/)?.[1])
    if (arrow === '<|--') addRelation(right, left, 'inheritance')
    else if (arrow === '<|..' || arrow === '..|>') addRelation(arrow === '..|>' ? left : right, arrow === '..|>' ? right : left, 'realization')
    else if (arrow === '*--') addRelation(left, right, 'composition', { sourceCardinality: sourceCard, targetCardinality: targetCard, label })
    else if (arrow === 'o--') addRelation(left, right, 'aggregation', { sourceCardinality: sourceCard, targetCardinality: targetCard, label })
    else if (arrow === '..>') addRelation(left, right, 'dependency', { label })
    else if (arrow === '-->') addRelation(left, right, 'association', { sourceCardinality: sourceCard, targetCardinality: targetCard, label })
    else addRelation(left, right, 'association', { sourceCardinality: sourceCard, targetCardinality: targetCard, label })
  }

  for (const relation of inheritance) addRelation(relation.child, relation.parent, 'inheritance')
  for (const relation of realizations) addRelation(relation.child, relation.iface, 'realization')

  const natural = [
    { pattern: /^(.+?)\s+(?:extends|mewarisi|inherits?\s+from)\s+(.+)$/i, kind: 'inheritance', flip: false },
    { pattern: /^(.+?)\s+(?:implements|mengimplementasikan)\s+(.+)$/i, kind: 'realization', flip: false },
    { pattern: /^(.+?)\s+(?:contains?|mengandung|terdiri\s+dari|komposisi|composition)\s+(.+)$/i, kind: 'composition', flip: false },
    { pattern: /^(.+?)\s+(?:aggregates?|agregasi|aggregation)\s+(.+)$/i, kind: 'aggregation', flip: false },
    { pattern: /^(.+?)\s+(?:depends?\s+on|membutuhkan|bergantung\s+pada)\s+(.+)$/i, kind: 'dependency', flip: false },
    { pattern: /^(.+?)\s+(?:uses?|menggunakan)\s+(.+)$/i, kind: 'dependency', flip: false },
    { pattern: /^(.+?)\s+(?:has|have|memiliki|mempunyai)\s+(?:many\s+|banyak\s+|satu\s+|one\s+)?(.+)$/i, kind: 'association', flip: false, many: true },
    { pattern: /^(.+?)\s+(?:associated\s+with|berelasi\s+dengan|berhubungan\s+dengan)\s+(.+)$/i, kind: 'association', flip: false },
  ]
  for (const rawLine of text.split(/\r?\n|;|\./)) {
    const line = oneLine(rawLine, 260).replace(/^[-*]\s*/, '')
    if (!line) continue
    for (const rule of natural) {
      const found = line.match(rule.pattern)
      if (!found) continue
      const source = cleanClassRef(found[1].replace(/^.*\b(?:class|kelas)\s+/i, ''))
      const target = cleanClassRef(found[2])
      if (source && target) {
        addRelation(source, target, rule.kind, { targetCardinality: rule.many ? 'many' : 'one' })
        break
      }
    }
  }

  if (!builder.ir.nodes.length) {
    builder.clarify('No UML classes were found. Provide class declarations or a class list, for example "class User { id: UUID; name: String }".')
  }
  return builder.finish({ theme, orientation, density })
}
