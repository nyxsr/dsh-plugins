/** Software-architecture extraction: components, boundaries and dependencies. */
import { oneLine } from '../core/text.js'
import { IRBuilder, splitTopLevel } from './common.js'

const ROLE_PREFIX = /^(?:komponen|component|layanan|service|modul|module|sistem|system|database|db|cache|queue|broker|worker|storage|client|frontend|backend|gateway)\s+/i
const NATURAL_VERB = /^(memanggil|menggunakan|bergantung\s+pada|membaca|menulis|memublikasikan|berlangganan|mengonsumsi|calls?|uses?|depends?\s+on|reads?|writes?|publishes?|subscribes?|consumes?)$/i

function inferKind(raw) {
  const text = String(raw ?? '').toLowerCase()
  if (/\b(?:postgres(?:ql)?|mysql|mariadb|mongodb|oracle|sqlite|database|basis data|db)\b/.test(text)) return 'database'
  if (/\b(?:redis|memcached|cache)\b/.test(text)) return 'cache'
  if (/\b(?:kafka|rabbitmq|sqs|pubsub|message broker|broker|queue|antrian)\b/.test(text)) return 'queue'
  if (/\b(?:worker|consumer|background job|job runner)\b/.test(text)) return 'worker'
  if (/\b(?:s3|blob|object storage|file storage|storage)\b/.test(text)) return 'storage'
  if (/\b(?:third[ -]?party|external|payment|stripe|midtrans|xendit)\b/.test(text)) return 'external'
  if (/\b(?:gateway)\b/.test(text)) return 'gateway'
  if (/\b(?:frontend|front-end|web app|mobile app|react|vue|angular|next\.js)\b/.test(text)) return 'frontend'
  if (/\b(?:client|browser|desktop)\b/.test(text)) return 'client'
  if (/\b(?:kubernetes|k8s|docker|server|vpc|infrastructure|infra|cloud)\b/.test(text)) return 'infra'
  if (/\b(?:api|rest|graphql|grpc)\b/.test(text)) return 'api'
  return 'service'
}

function edgeKindFor(source, target, explicit, label) {
  if (explicit) return explicit
  const text = `${label ?? ''}`.toLowerCase()
  if (/\breads?\b|\bmembaca\b/.test(text)) return 'reads'
  if (/\bwrites?\b|\bmenulis\b/.test(text)) return 'writes'
  if (/\bpublishes?\b|\bmemublikasikan\b/.test(text)) return 'publishes'
  if (/\bsubscribes?\b|\bberlangganan\b|\bconsumes?\b|\bmengonsumsi\b/.test(text)) return 'subscribes'
  if (/\breplicates?\b|\breplikasi\b/.test(text)) return 'replicates'
  if (target?.kind === 'queue') return source?.kind === 'worker' ? 'subscribes' : 'publishes'
  if (target?.kind === 'database' || target?.kind === 'storage') return 'reads'
  if (source?.kind === 'queue' && target?.kind === 'worker') return 'subscribes'
  if (label) return 'calls'
  return 'depends'
}

function parseName(raw) {
  let text = oneLine(String(raw ?? '').replace(ROLE_PREFIX, ''), 90)
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/^(?:sebuah|a|an|the)\s+/i, '')
    .replace(/[.,;]+$/, '')
    .trim()
  let technology = ''
  const tech = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (tech) {
    text = tech[1].trim()
    technology = tech[2].trim()
  }
  return { name: text, technology }
}

function splitStatements(text) {
  return String(text ?? '')
    .replace(/\r/g, '')
    .split(/\n|;|(?<=\.)\s+(?=[A-Z]|(?:group|grup|boundary|batas|kelompok|komponen|component|arsitektur|architecture)\b)/)
}

function naturalEdge(line) {
  const match = line.match(/^(.+?)\s+(memanggil|menggunakan|bergantung\s+pada|membaca|menulis|memublikasikan|berlangganan|mengonsumsi|calls?|uses?|depends?\s+on|reads?|writes?|publishes?|subscribes?|consumes?)\s+(.+)$/i)
  if (!match || !NATURAL_VERB.test(match[2])) return null
  const verb = match[2].toLowerCase().replace(/\s+/g, ' ')
  const map = {
    'memanggil': ['calls', 'calls'],
    'menggunakan': ['calls', 'uses'],
    'bergantung pada': ['depends', 'depends on'],
    'membaca': ['reads', 'reads'],
    'menulis': ['writes', 'writes'],
    'memublikasikan': ['publishes', 'publishes'],
    'berlangganan': ['subscribes', 'subscribes'],
    'mengonsumsi': ['subscribes', 'consumes'],
    'call': ['calls', 'calls'],
    'calls': ['calls', 'calls'],
    'use': ['calls', 'uses'],
    'uses': ['calls', 'uses'],
    'depend on': ['depends', 'depends on'],
    'depends on': ['depends', 'depends on'],
    'read': ['reads', 'reads'],
    'reads': ['reads', 'reads'],
    'write': ['writes', 'writes'],
    'writes': ['writes', 'writes'],
    'publish': ['publishes', 'publishes'],
    'publishes': ['publishes', 'publishes'],
    'subscribe': ['subscribes', 'subscribes'],
    'subscribes': ['subscribes', 'subscribes'],
    'consume': ['subscribes', 'consumes'],
    'consumes': ['subscribes', 'consumes'],
  }
  const [kind, baseLabel] = map[verb] ?? ['depends', verb]
  let target = match[3].trim()
  let label = baseLabel
  const protocol = target.match(/^(.+?)\s*:\s*(.+)$/)
  if (protocol) {
    target = protocol[1].trim()
    label = protocol[2].trim()
  }
  return { source: match[1].trim(), target, kind, label }
}

export function parseArchitecture({ requirement, title, language, theme, orientation, density }) {
  const builder = new IRBuilder({ diagramType: 'architecture', title, language, requirement })
  const components = new Map()
  const pendingGroups = []

  const addComponent = (raw, explicitKind) => {
    const { name, technology } = parseName(raw)
    if (!name) return null
    const key = name.toLowerCase()
    if (components.has(key)) return components.get(key)
    const existingId = builder.resolve(name)
    if (existingId) {
      const existing = builder.ir.nodes.find(node => node.id === existingId)
      components.set(key, existing)
      return existing
    }
    const node = builder.addNode({
      kind: explicitKind ?? inferKind(name),
      name,
      label: name,
      technology,
    })
    components.set(key, node)
    return node
  }

  const resolveMember = raw => {
    const { name } = parseName(raw)
    if (!name) return null
    const id = builder.resolve(name)
    if (id) return builder.ir.nodes.find(node => node.id === id) ?? null
    return addComponent(name)
  }

  const addConnection = (sourceRaw, targetRaw, label = '', explicitKind = '') => {
    const source = addComponent(sourceRaw)
    const target = addComponent(targetRaw)
    if (!source || !target || source.id === target.id) {
      if (source || target) builder.clarify(`Connection "${sourceRaw} → ${targetRaw}" has an undefined endpoint.`)
      return
    }
    let cleanLabel = oneLine(label, 80).replace(/[.,;]+$/, '')
    const kind = edgeKindFor(source, target, explicitKind, cleanLabel)
    if (!cleanLabel) cleanLabel = kind
    if (builder.ir.edges.some(edge => edge.source === source.id && edge.target === target.id && edge.kind === kind && edge.label === cleanLabel)) return
    builder.addEdge({ kind, source: source.id, target: target.id, label: cleanLabel })
  }

  const addList = value => {
    const items = splitTopLevel(value, /[,;]/)
      .map(item => String(item).trim())
      .filter(item => item && item.length <= 90 && !/^(?:dan|and|serta)$/i.test(item))
    if (items.length < 1) return
    for (const item of items) addComponent(item)
  }

  for (let rawLine of splitStatements(requirement)) {
    let line = oneLine(rawLine, 360).replace(/^[-*•]\s*/, '').trim()
    if (!line) continue
    if (/^(?:arsitektur|architecture)\b[^:]*:?\s*$/i.test(line)) continue

    const hadTitle = /^(?:arsitektur|architecture)\b[^:]*:/i.test(line)
    if (hadTitle) line = line.replace(/^.*?\b(?:arsitektur|architecture)\b[^:]*:\s*/i, '').trim()
    if (!line) continue

    const group = line.match(/^(?:group|grup|boundary|batas|kelompok|cluster|zona|zone)\s+(.+?)\s*[:{]\s*(.+?)\s*\}?$/i)
    if (group) {
      const members = splitTopLevel(group[2], /[,;]/).map(item => String(item).trim()).filter(Boolean)
      pendingGroups.push({ label: group[1].trim(), members })
      for (const member of members) resolveMember(member)
      continue
    }

    const natural = naturalEdge(line)
    if (natural) {
      addConnection(natural.source, natural.target, natural.label, natural.kind)
      continue
    }

    const declaration = line.match(/^(?:komponen|component|layanan|service|modul|module|database|db|cache|queue|broker|worker|storage|client|frontend|backend|gateway)\s*[:=]\s*(.+)$/i)
    if (declaration) {
      addList(declaration[1])
      continue
    }

    if (/(?:-->|->|→|⇒|=>)/.test(line)) {
      let arrowText = line.replace(/\s*--\s*([^->|]+?)\s*-->/g, ' ->|$1| ')
      const tokens = arrowText
        .split(/\s*(?:-->|->|→|⇒|=>)\s*/)
        .map(token => token.trim())
        .filter(Boolean)
      const parts = tokens.map(token => {
        const leading = token.match(/^\|([^|]+)\|\s*(.+)$/)
        return leading ? { raw: leading[2].trim(), label: leading[1].trim() } : { raw: token, label: '' }
      })
      for (let index = 0; index < parts.length - 1; index += 1) {
        let targetRaw = parts[index + 1].raw
        let label = parts[index + 1].label
        const protocol = targetRaw.match(/^(.+?)\s*:\s*(.+)$/)
        if (protocol) {
          targetRaw = protocol[1].trim()
          label = protocol[2].trim() || label
        }
        const bracket = targetRaw.match(/^(.+?)\s*\[([^\]]+)\]$/)
        if (bracket) {
          targetRaw = bracket[1].trim()
          label = bracket[2].trim() || label
        }
        addConnection(parts[index].raw, targetRaw, label)
      }
      continue
    }

    const declared = line.match(/^(?:komponen|component|layanan|service|modul|module|database|db|cache|queue|broker|worker|storage|client|frontend|backend|gateway)\s+(.+)$/i)
    if (declared) {
      addList(declared[1])
      continue
    }

    if (hadTitle && /,/.test(line)) {
      addList(line)
      continue
    }

    const listed = line.match(/\b(?:dengan|with|terdiri\s+dari|consists?\s+of)\s+(.+)$/i)
    if (listed && /,/.test(listed[1])) addList(listed[1])
  }

  for (const pending of pendingGroups) {
    const ids = pending.members.map(member => resolveMember(member)?.id).filter(Boolean)
    if (!ids.length) continue
    const groupId = `group-${builder.ir.groups.length + 1}`
    builder.addGroup({ id: groupId, label: pending.label, kind: 'boundary', node_ids: ids })
    for (const id of ids) {
      const node = builder.ir.nodes.find(candidate => candidate.id === id)
      if (node) node.group_id = groupId
    }
  }

  const uniqueNodes = [...new Map(builder.ir.nodes.map(node => [node.name.toLowerCase(), node])).values()]
  if (!uniqueNodes.length) {
    builder.clarify('No architecture components were found. List components and connections, for example "Web -> API Gateway -> Orders Service -> PostgreSQL".')
  } else if (!builder.ir.edges.length) {
    builder.clarify('Components were found but no dependencies or communication paths were declared.')
  }
  return builder.finish({ theme, orientation, density })
}
