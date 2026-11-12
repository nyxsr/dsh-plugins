/** UML sequence-diagram extraction with participants, messages and frames. */
import { oneLine } from '../core/text.js'
import { IRBuilder, cleanName, splitTopLevel } from './common.js'

const ARROWS = ['-->>', '->>', '-->', '->', '→', '⇒', '=>', '<<--']
const FRAME_KINDS = new Set(['alt', 'opt', 'loop', 'par', 'break', 'critical'])
const ROLE_WORDS = /^(actor|aktor|participant|peserta|boundary|batas|control|kontrol|entity|entitas|database|db|note)\s+/i

function roleKind(raw) {
  const match = String(raw ?? '').trim().match(/^(actor|aktor|participant|peserta|boundary|batas|control|kontrol|entity|entitas|database|db)\b/i)
  if (!match) return 'participant'
  const role = match[1].toLowerCase()
  if (role === 'actor' || role === 'aktor') return 'actor'
  if (role === 'database' || role === 'db') return 'database'
  if (role === 'boundary' || role === 'batas') return 'boundary'
  if (role === 'control' || role === 'kontrol') return 'control'
  if (role === 'entity' || role === 'entitas') return 'entity'
  return 'participant'
}

function participantName(raw) {
  return oneLine(String(raw ?? '').replace(ROLE_WORDS, '').replace(/\s+as\s+.+$/i, ''), 80)
    .replace(/^["'`]|["'`]$/g, '')
    .trim()
}

function messageKind(arrow) {
  if (/-->>|-->|<<--/.test(arrow)) return 'return'
  if (/->>/.test(arrow)) return 'async'
  return 'sync'
}

function frameKind(value) {
  const token = String(value ?? '').trim().toLowerCase().split(/\s+/)[0]
  if (token === 'else') return null
  return FRAME_KINDS.has(token) ? token : null
}

export function parseSequence({ requirement, title, language, theme, orientation, density }) {
  const builder = new IRBuilder({ diagramType: 'sequence', title, language, requirement })
  const text = String(requirement ?? '')
  const participants = new Map()
  const alias = new Map()
  let order = 0
  const frames = []
  const stack = []

  const addParticipant = (raw, kind) => {
    const name = participantName(raw)
    if (!name) return null
    if (alias.has(name.toLowerCase())) return alias.get(name.toLowerCase())
    const key = name.toLowerCase()
    if (participants.has(key)) return participants.get(key)
    const node = builder.addNode({ kind: kind ?? 'participant', name, label: name })
    participants.set(key, node)
    alias.set(key, node)
    return node
  }
  const resolveParticipant = (raw, kind) => {
    const name = participantName(raw)
    const id = builder.resolve(name)
    if (id) return builder.ir.nodes.find(node => node.id === id)
    const node = addParticipant(name, kind ?? 'participant')
    if (node) builder.assume(`Participant "${node.name}" was inferred from a message because it was not declared.`)
    return node
  }

  const frameFor = () => (stack.length ? stack.at(-1) : null)

  const addMessage = (sourceRaw, targetRaw, textValue, kind) => {
    const source = resolveParticipant(sourceRaw)
    const target = resolveParticipant(targetRaw)
    if (!source || !target) return null
    order += 1
    const resolvedKind = source.id === target.id ? 'self' : kind
    const edge = builder.addEdge({
      kind: resolvedKind,
      source: source.id,
      target: target.id,
      text: textValue,
      label: textValue,
      order,
    })
    const frame = frameFor()
    if (frame && edge) frame.message_ids.push(edge.id)
    return edge
  }

  // Participant declarations, aliases, and lists. Declarations may follow a
  // diagram title on the same line, so inspect semicolon-delimited segments.
  for (let segment of text.split(/\r?\n|;|\.\s+(?=[A-Za-z])/)) {
    segment = segment.trim().replace(/^.*?\b(?:diagram|sequence)\b[^:]*:\s*/i, '')
    const found = segment.match(/^(actor|aktor|participant|peserta|boundary|batas|control|kontrol|entity|entitas|database|db)\s+(.+)$/i)
    if (!found) continue
    const declaration = found[2].trim()
    if (/^(?:-->|->|→|⇒|=>)/.test(declaration)) continue
    const asMatch = declaration.match(/^([^,]+?)\s+as\s+([A-Za-z_]\w*)$/i)
    const names = splitTopLevel(asMatch ? asMatch[1] : declaration, /[,;]/)
    for (const item of names) {
      const node = addParticipant(item, roleKind(found[1]))
      if (node && asMatch && names.length === 1) alias.set(asMatch[2].toLowerCase(), node)
    }
  }
  const list = text.match(/\bparticipants?\s*[:=]\s*([^.;\n]+)/i)
  if (list) {
    for (const item of splitTopLevel(list[1], /[,;]/)) addParticipant(item)
  }

  const lines = text.replace(/\r/g, '').split(/\n|;|\.\s+(?=[A-Za-z])/)
  for (const rawLine of lines) {
    let line = oneLine(rawLine, 320).replace(/^[-*•]\s*/, '')
    if (!line) continue
    const frameMatch = line.match(/^(alt|opt|loop|par|break|critical|else|end)\b\s*(.*)$/i)
    if (frameMatch) {
      const keyword = frameMatch[1].toLowerCase()
      const label = frameMatch[2].replace(/^(?:if|when|jika)\s+/i, '').trim()
      if (keyword === 'end') {
        if (stack.length) stack.pop()
        else builder.clarify('An "end" closed no open sequence frame.')
        continue
      }
      if (keyword === 'else') {
        const frame = frameFor()
        if (frame) frame.label = `${frame.label}${frame.label ? ' / ' : ''}else ${label}`.trim()
        else builder.clarify('An "else" appeared outside an alternative frame.')
        continue
      }
      const kind = frameKind(keyword)
      const frame = { id: `frame-${frames.length + 1}`, kind, label, message_ids: [] }
      frames.push(frame)
      stack.push(frame)
      continue
    }
    if (/^(?:note|activate|deactivate|destroy|create)\b/i.test(line)) {
      builder.assume(`Sequence directive "${line.split(/\s+/)[0]}" is not represented in the canonical IR.`)
      continue
    }

    const arrow = line.match(/^(.+?)\s*(-->>|->>|-->|->|→|⇒|=>|<<--)\s*(.+?)\s*:\s*(.+)$/)
    if (arrow) {
      addMessage(arrow[1], arrow[3], arrow[4].trim(), messageKind(arrow[2]))
      continue
    }
    const noText = line.match(/^(.+?)\s*(-->>|->>|-->|->|→|⇒|=>)\s*(.+)$/)
    if (noText) {
      addMessage(noText[1], noText[3], '', messageKind(noText[2]))
      builder.assume('A sequence message without a label was kept with an empty label.')
      continue
    }
    const send = line.match(/^(.+?)\s+(?:mengirim(?:kan)?|kirim|sends?|posts?)\s+(?:pesan\s+)?["“]?(.+?)["”]?\s+(?:ke|to)\s+(.+)$/i)
    if (send) {
      addMessage(send[1], send[3], send[2].trim(), 'sync')
      continue
    }
    const reply = line.match(/^(.+?)\s+(?:mengembalikan|membalas|returns?|replies?)\s+(.+?)\s+(?:ke|to)\s+(.+)$/i)
    if (reply) {
      addMessage(reply[1], reply[3], reply[2].trim(), 'return')
      continue
    }
    const call = line.match(/^(.+?)\s+(?:memanggil|calls?|invokes?)\s+(.+)$/i)
    if (call) {
      addMessage(call[1], call[2], 'call', 'sync')
    }
  }
  while (stack.length) stack.pop()

  for (const frame of frames) {
    if (!frame.message_ids.length) builder.clarify(`Sequence frame "${frame.label || frame.kind}" contains no messages.`)
    builder.addFrame(frame)
  }

  if (!builder.ir.nodes.length) {
    builder.clarify('No sequence participants were found. Declare participants and messages, for example "User -> API: request".')
  } else if (!builder.ir.edges.length) {
    builder.clarify('Participants were found but no messages were declared.')
  }
  return builder.finish({ theme, orientation, density })
}
