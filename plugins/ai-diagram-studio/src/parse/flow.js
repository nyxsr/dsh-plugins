/** Flowchart and activity-diagram extraction with explicit branch labels. */
import { oneLine } from '../core/text.js'
import { IRBuilder, stripLeadingNumber } from './common.js'

const START = /^(?:start|mulai|begin|awal)$/i
const END = /^(?:end|final|selesai|finish|done|berakhir|akhir)$/i
const YES = /^(?:yes|ya|setuju|disetujui|approved|valid|lolos|berhasil)$/i
const NO = /^(?:no|tidak|not|tolak|ditolak|rejected|invalid|gagal|else|sebaliknya)\b/i

function labelKind(label, diagramType) {
  const text = oneLine(label, 160).toLowerCase()
  if (START.test(text)) return diagramType === 'uml_activity' ? 'initial' : 'start'
  if (END.test(text)) return diagramType === 'uml_activity' ? 'final' : 'end'
  if (/\?\s*$/.test(text) || /^(?:decision|keputusan|choose|pilih)\b/.test(text)) return 'decision'
  if (diagramType === 'uml_activity') return 'action'
  if (/^(?:input|masukan|terima|receive)\b/.test(text)) return 'input'
  if (/^(?:output|keluaran|kirim|send|tampilkan)\b/.test(text)) return 'output'
  if (/^(?:subprocess|subproses|sub\s*process)\b/.test(text)) return 'subprocess'
  return 'process'
}

function decisionLabel(condition) {
  const text = oneLine(condition, 150)
    .replace(/^(?:apakah|whether|is|are|does|do)\s+/i, '')
    .replace(/[?:]+$/g, '')
    .trim()
  if (!text) return 'Decision?'
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}?`
}

function cleanAction(value) {
  return oneLine(value, 160)
    .replace(/^(?:maka|then)\s+/i, '')
    .replace(/[.;]+$/g, '')
    .trim()
}

export function parseFlow({ requirement, title, language, theme, orientation, density, activity = false }) {
  const diagramType = activity ? 'uml_activity' : 'flowchart'
  const builder = new IRBuilder({ diagramType, title, language, requirement })
  const yesWord = language === 'id' ? 'Ya' : 'Yes'
  const noWord = language === 'id' ? 'Tidak' : 'No'
  const sources = { requirement, builder, diagramType, yesWord, noWord, activity }

  const text = String(requirement ?? '')
  const arrowParsed = parseArrowSyntax(text, sources)
  if (!arrowParsed) parseNarrative(text, sources)

  if (!builder.ir.nodes.length) {
    builder.clarify('No flowchart steps were found. Describe the steps, decisions, and end state, or use arrow notation such as "Start -> Review -> End".')
    return builder.finish({ theme, orientation, density })
  }

  ensureStartAndEnd(sources)
  labelDecisionBranches(sources)
  return builder.finish({ theme, orientation, density })
}

function parseArrowSyntax(text, { builder, diagramType, yesWord, noWord }) {
  const arrowLines = String(text).split(/\r?\n|;/).filter(line => /(?:->|→|⇒|-->)/.test(line))
  if (!arrowLines.length) return false
  const aliases = new Map()
  let lastDecision = null
  let any = false

  const ensure = (raw, hint) => {
    let token = oneLine(raw, 160)
    if (!token) return null
    let label = token
    let explicitKind = hint
    let leadingLabel = null
    const branchPrefix = token.match(/^(yes|ya|no|tidak)\s*:\s*/i)
    if (branchPrefix) {
      leadingLabel = branchPrefix[1]
      token = token.slice(branchPrefix[0].length)
      label = token
    }
    if (token.startsWith('|')) {
      const end = token.indexOf('|', 1)
      if (end > 0) {
        explicitKind = explicitKind ?? 'edge-label'
        token = token.slice(end + 1).trim()
        label = token
      }
    }
    const shaped = token.match(/^(?:(?:\w+)\s*)?(\(\(|\[|\{)(.+?)(\)\)|\]|\})$/s)
    if (shaped) {
      label = shaped[2].trim()
      if (shaped[1] === '{') explicitKind = 'decision'
      if (shaped[1] === '((') explicitKind = START.test(label) ? (diagramType === 'uml_activity' ? 'initial' : 'start') : END.test(label) ? (diagramType === 'uml_activity' ? 'final' : 'end') : explicitKind
    }
    label = label.replace(/^['"`]|['"`]$/g, '').trim()
    if (!label) return { node: null, leadingLabel }
    const aliasKey = label.toLowerCase()
    let nodeId = aliases.get(aliasKey) ?? builder.resolve(label)
    let node = nodeId ? builder.ir.nodes.find(candidate => candidate.id === nodeId) : null
    if (!node) {
      const kind = explicitKind && explicitKind !== 'edge-label' ? explicitKind : labelKind(label, diagramType)
      node = builder.addNode({ kind, name: label, label })
    }
    aliases.set(aliasKey, node.id)
    if (labelKind(label, diagramType) === 'decision' || node.kind === 'decision') {
      lastDecision = node.id
    }
    return { node, leadingLabel }
  }

  for (const line of arrowLines) {
    if (/^\s*(?:flowchart|graph|diagram)\b/i.test(line) && !/(?:->|→)/.test(line)) continue
    const prepared = line
      .replace(/^\s*(?:flowchart|graph|diagram|alur|activity)\b[^:]*:\s*/i, '')
      .replace(/--\s*([^->\n]+?)\s*-->/g, ' ->|$1| ')
      .replace(/-->|=>/g, ' -> ')
    const tokens = prepared.split(/\s*(?:->|→|⇒)\s*/).map(token => token.trim()).filter(Boolean)
    if (!tokens.length) continue
    const first = ensure(tokens[0])
    if (!first.node) continue
    any = true
    let previous = first.node
    if (first.leadingLabel && lastDecision) {
      const source = builder.ir.nodes.find(node => node.id === lastDecision)
      if (source) {
        builder.addEdge({
          source: lastDecision,
          target: previous.id,
          kind: 'flow',
          label: YES.test(first.leadingLabel) ? yesWord : noWord,
        })
      }
    }
    for (let index = 1; index < tokens.length; index += 1) {
      const current = ensure(tokens[index])
      if (!current.node) continue
      let edgeLabel = current.leadingLabel ?? ''
      if (YES.test(edgeLabel)) edgeLabel = yesWord
      else if (NO.test(edgeLabel)) edgeLabel = noWord
      const trailing = tokens[index - 1].match(/\|([^|]+)\|\s*$/)
      if (!edgeLabel && trailing) edgeLabel = trailing[1].trim()
      builder.addEdge({
        source: previous.id,
        target: current.node.id,
        kind: 'flow',
        label: edgeLabel,
        guard: previous.kind === 'decision' ? edgeLabel : '',
      })
      previous = current.node
    }
  }
  return any
}

function parseNarrative(text, sources) {
  const { builder, yesWord, noWord, activity } = sources
  let body = String(text)
  const colon = body.indexOf(':')
  if (colon > 0 && /(?:flow|alur|diagram|activity|proses)/i.test(body.slice(0, colon))) {
    body = body.slice(colon + 1)
  }
  const segments = body
    .replace(/\r/g, '')
    .replace(/\b(?:kemudian|lalu|selanjutnya|setelah\s+itu|then|next|after\s+that)\b/gi, ';')
    .replace(/,\s*(?=(?:jika|if|apakah|whether)\b)/gi, ';')
    .replace(/[.!?]\s+/g, ';')
    .replace(/,\s*/g, ';')
    .split(/[;\n]+/)
    .map(segment => stripLeadingNumber(segment).replace(/^[,.\s]+|[,.\s]+$/g, ''))
    .filter(Boolean)

  let start = null
  let end = null
  let previous = null
  let pendingLabel = ''
  let lastDecision = null
  const rejectionEnds = []

  const ensureSimple = (label, kind) => {
    let node = builder.ir.nodes.find(candidate => candidate.name.toLowerCase() === label.toLowerCase())
    if (!node) node = builder.addNode({ kind: kind ?? labelKind(label, activity ? 'uml_activity' : 'flowchart'), name: label, label })
    return node
  }

  const ensureEnd = () => {
    if (!end) end = ensureSimple(activity ? 'Final' : 'End', activity ? 'final' : 'end')
    return end
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    if (!segment) continue
    if (START.test(segment)) {
      start = ensureSimple(segment, activity ? 'initial' : 'start')
      previous = start
      pendingLabel = ''
      continue
    }
    if (END.test(segment)) {
      end = ensureSimple(segment, activity ? 'final' : 'end')
      if (previous && previous.id !== end.id) {
        builder.addEdge({ source: previous.id, target: end.id, kind: 'flow', label: pendingLabel })
      }
      previous = end
      pendingLabel = ''
      continue
    }
    const negBranch = segment.match(/^(?:jika\s+tidak|if\s+not|else|sebaliknya)\s+(.+)$/i)
    if (negBranch && lastDecision) {
      const placeholder = rejectionEnds.findLastIndex(item => item.source === lastDecision)
      if (placeholder >= 0) rejectionEnds.splice(placeholder, 1)
      const noNode = ensureSimple(cleanAction(negBranch[1]), activity ? 'action' : labelKind(cleanAction(negBranch[1]), 'flowchart'))
      builder.addEdge({ source: lastDecision, target: noNode.id, kind: 'flow', label: noWord, guard: noWord })
      rejectionEnds.push({ source: noNode.id, label: '' })
      previous = noNode
      pendingLabel = ''
      continue
    }
    const ifMatch = segment.match(/^(?:jika|if|apakah|whether)\s+(.+?)(?:\s*[,:]\s*|\s+(?:maka|then)\s+)(.+)$/i)
    const ifStatus = segment.match(/^(?:jika|if)\s+(disetujui|ditolak|valid|tidak\s+valid|lengkap|berhasil|gagal|ada|tidak\s+ada)\s+(.+)$/i)
    const ifOnly = segment.match(/^(?:jika|if|apakah|whether)\s+(.+)$/i)
    if (ifMatch || ifStatus || ifOnly) {
      let condition = (ifMatch?.[1] ?? ifStatus?.[1] ?? ifOnly?.[1] ?? '')
      let yesAction = cleanAction(ifMatch?.[2] ?? ifStatus?.[2] ?? '')
      const lookahead = segments[index + 1]
      let noAction = ''
      let consume = 0
      if (lookahead) {
        const nextIf = lookahead.match(/^(?:jika|if|apakah|whether|else|sebaliknya|jika\s+tidak|if\s+not|otherwise)\s*(.*?)(?:\s*[,:]\s*|\s+(?:maka|then)\s+)(.+)$/i)
        if (nextIf && (NO.test(nextIf[1].trim()) || NO.test(lookahead.split(/\s+/)[1] ?? ''))) {
          noAction = cleanAction(nextIf[2])
          consume = 1
        }
      }
      condition = condition.replace(/\b(?:maka|then)\s*$/i, '').trim()
      if (NO.test(condition)) {
        // A preceding decision already handled the negative branch.
        continue
      }
      const decision = ensureSimple(decisionLabel(condition), 'decision')
      if (!previous) {
        start = ensureSimple(activity ? 'Initial' : 'Start', activity ? 'initial' : 'start')
        previous = start
      }
      builder.addEdge({ source: previous.id, target: decision.id, kind: 'flow', label: pendingLabel })
      lastDecision = decision.id
      if (yesAction) {
        const yesNode = ensureSimple(yesAction, activity ? 'action' : labelKind(yesAction, 'flowchart'))
        builder.addEdge({ source: decision.id, target: yesNode.id, kind: 'flow', label: yesWord, guard: yesWord })
        previous = yesNode
      } else {
        previous = decision
        pendingLabel = yesWord
      }
      if (noAction) {
        const noNode = ensureSimple(noAction, activity ? 'action' : labelKind(noAction, 'flowchart'))
        builder.addEdge({ source: decision.id, target: noNode.id, kind: 'flow', label: noWord, guard: noWord })
        rejectionEnds.push({ source: noNode.id, label: '' })
      } else {
        rejectionEnds.push({ source: decision.id, label: noWord })
      }
      index += consume
      continue
    }
    const loop = segment.match(/^(?:ulangi|repeat|retry|kembali\s+ke|back\s+to|loop\s+to)\s+(.+)$/i)
    if (loop) {
      const targetLabel = cleanAction(loop[1])
      const target = builder.resolve(targetLabel)
      if (target) {
        builder.addEdge({ source: previous?.id ?? lastDecision, target, kind: 'flow', label: language(sources) === 'id' ? 'Ulangi' : 'Repeat' })
        builder.assume(`A loop edge back to "${targetLabel}" was created from the retry instruction.`)
      } else {
        builder.clarify(`The retry target "${targetLabel}" could not be matched to an earlier step.`)
      }
      continue
    }
    const node = ensureSimple(segment, activity ? 'action' : labelKind(segment, 'flowchart'))
    if (!previous) {
      start = ensureSimple(activity ? 'Initial' : 'Start', activity ? 'initial' : 'start')
      previous = start
    }
    if (previous.id !== node.id) {
      builder.addEdge({ source: previous.id, target: node.id, kind: 'flow', label: pendingLabel })
    }
    previous = node
    pendingLabel = ''
  }

  if (!start) start = ensureSimple(activity ? 'Initial' : 'Start', activity ? 'initial' : 'start')
  if (!end) end = ensureEnd()
  if (previous && previous.id !== end.id) {
    builder.addEdge({ source: previous.id, target: end.id, kind: 'flow', label: pendingLabel })
  }
  for (const rejection of rejectionEnds) {
    if (rejection.source !== end.id) {
      builder.addEdge({ source: rejection.source, target: end.id, kind: 'flow', label: rejection.label })
    }
  }
}

function language({ builder }) {
  return builder.ir.language
}

function ensureStartAndEnd({ builder, activity, yesWord, noWord }) {
  const starts = builder.ir.nodes.filter(node => node.kind === 'start' || node.kind === 'initial')
  const ends = builder.ir.nodes.filter(node => node.kind === 'end' || node.kind === 'final')
  const connected = new Set(builder.ir.edges.flatMap(edge => [edge.source, edge.target]))
  if (!starts.length) {
    const start = builder.addNode({ kind: activity ? 'initial' : 'start', name: activity ? 'Initial' : 'Start', label: activity ? 'Initial' : 'Start' })
    const first = builder.ir.nodes.find(node => node.id !== start.id && node.kind !== 'note')
    if (first) builder.addEdge({ source: start.id, target: first.id, kind: 'flow' })
  }
  if (!ends.length) {
    const end = builder.addNode({ kind: activity ? 'final' : 'end', name: activity ? 'Final' : 'End', label: activity ? 'Final' : 'End' })
    for (const node of builder.ir.nodes) {
      if (node.id === end.id) continue
      if (['start', 'initial', 'end', 'final'].includes(node.kind)) continue
      const outgoing = builder.ir.edges.filter(edge => edge.source === node.id)
      if (!outgoing.length) {
        builder.addEdge({ source: node.id, target: end.id, kind: 'flow' })
        connected.add(node.id)
        connected.add(end.id)
      }
    }
  }
  // Nodes that never participate in a path are anchored to the start.
  const startNode = builder.ir.nodes.find(node => node.kind === 'start' || node.kind === 'initial')
  for (const node of builder.ir.nodes) {
    if (node.id === startNode?.id) continue
    if (['start', 'initial', 'note'].includes(node.kind)) continue
    if (!connected.has(node.id)) builder.addEdge({ source: startNode.id, target: node.id, kind: 'flow' })
  }
  const endNode = builder.ir.nodes.find(node => node.kind === 'end' || node.kind === 'final')
  for (const node of builder.ir.nodes) {
    if (node.id === endNode?.id || node.id === startNode?.id) continue
    if (['end', 'final', 'note'].includes(node.kind)) continue
    const outgoing = builder.ir.edges.filter(edge => edge.source === node.id)
    if (!outgoing.length) builder.addEdge({ source: node.id, target: endNode.id, kind: 'flow' })
  }
}

function labelDecisionBranches({ builder, yesWord, noWord }) {
  for (const node of builder.ir.nodes.filter(candidate => candidate.kind === 'decision')) {
    const outgoing = builder.ir.edges.filter(edge => edge.source === node.id)
    if (outgoing.length >= 2) {
      const unlabeled = outgoing.filter(edge => !edge.label && !edge.guard)
      if (unlabeled.length) {
        unlabeled.forEach((edge, index) => {
          edge.label = index === 0 ? yesWord : noWord
          edge.guard = edge.label
        })
        builder.assume(`Unlabeled branches from decision "${node.name}" were labeled ${yesWord}/${noWord}; verify the branch conditions.`)
      }
    }
  }
}
