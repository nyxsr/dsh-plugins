/** Native SVG renderer. It consumes the canonical IR + layout, never semantics. */
import { xmlEscape, textWidth } from '../core/text.js'
import { getTheme, nodeFill } from './themes.js'

const esc = value => xmlEscape(String(value ?? ''))
const num = value => Math.round(Number(value) * 100) / 100
const SANS = "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"

function text(x, y, value, options = {}) {
  const {
    size = 12, weight = 400, fill = '#0f172a', anchor = 'start', family = SANS,
    opacity = 1, letterSpacing = 0, style = '',
  } = options
  return `<text x="${num(x)}" y="${num(y)}" font-size="${num(size)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="${family}" opacity="${opacity}"${letterSpacing ? ` letter-spacing="${letterSpacing}"` : ''}${style ? ` style="${style}"` : ''}>${esc(value)}</text>`
}

function lines(values, x, y, options = {}) {
  const { lineHeight = 16, ...rest } = options
  return values.map((value, index) => text(x, y + index * lineHeight, value, rest)).join('')
}

function pathFromPoints(points, radius = 12) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${num(points[0].x)} ${num(points[0].y)}`
  let d = `M ${num(points[0].x)} ${num(points[0].y)}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1]
    const current = points[index]
    const next = points[index + 1]
    const inLength = Math.hypot(current.x - prev.x, current.y - prev.y)
    const outLength = Math.hypot(next.x - current.x, next.y - current.y)
    const r = Math.min(radius, inLength / 2, outLength / 2)
    if (r < 1) {
      d += ` L ${num(current.x)} ${num(current.y)}`
      continue
    }
    const inUnit = { x: (current.x - prev.x) / inLength, y: (current.y - prev.y) / inLength }
    const outUnit = { x: (next.x - current.x) / outLength, y: (next.y - current.y) / outLength }
    d += ` L ${num(current.x - inUnit.x * r)} ${num(current.y - inUnit.y * r)}`
    d += ` Q ${num(current.x)} ${num(current.y)} ${num(current.x + outUnit.x * r)} ${num(current.y + outUnit.y * r)}`
  }
  const last = points.at(-1)
  d += ` L ${num(last.x)} ${num(last.y)}`
  return d
}

function markerDefs(theme) {
  const line = theme.line
  const panel = theme.panel
  return `<defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 Z" fill="${line}"/></marker>
    <marker id="arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M1,1 L9,5 L1,9" fill="none" stroke="${line}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker>
    <marker id="triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M1,1 L11,6 L1,11 Z" fill="${panel}" stroke="${line}" stroke-width="1.4"/></marker>
    <marker id="diamond-filled" viewBox="0 0 14 14" refX="0" refY="7" markerWidth="13" markerHeight="13" orient="auto" markerUnits="strokeWidth"><path d="M0,7 L6,1 L13,7 L6,13 Z" fill="${line}" stroke="${line}" stroke-width="1"/></marker>
    <marker id="diamond-open" viewBox="0 0 14 14" refX="0" refY="7" markerWidth="13" markerHeight="13" orient="auto" markerUnits="strokeWidth"><path d="M0,7 L6,1 L13,7 L6,13 Z" fill="${panel}" stroke="${line}" stroke-width="1.2"/></marker>
    <filter id="label-bg" x="-20%" y="-40%" width="140%" height="180%"><feFlood flood-color="${theme.background}" flood-opacity="0.92"/><feComposite in="SourceGraphic"/></filter>
  </defs>`
}

function defaultCard(cardinality) {
  return { one: '1', zero_or_one: '0..1', many: 'N', one_or_more: '1..N' }[cardinality] ?? ''
}

function cardinalityLabel(cardinality, optional) {
  const base = defaultCard(cardinality)
  if (!base) return optional ? '0..1' : ''
  if (optional && base === '1') return '0..1'
  return base
}

function crowFoot(x, y, angle, cardinality, optional, theme, label) {
  const base = cardinality ?? 'one'
  const rad = (angle + 180) * Math.PI / 180
  const perp = (angle + 90) * Math.PI / 180
  const lx = x + Math.cos(rad) * 16 + Math.cos(perp) * 11
  const ly = y + Math.sin(rad) * 16 + Math.sin(perp) * 11
  let shape = ''
  if (base === 'many' || base === 'one_or_more') {
    shape += `<path d="M 0 0 L -13 -9 M 0 0 L -13 0 M 0 0 L -13 9" fill="none" stroke="${theme.line}" stroke-width="1.5" stroke-linecap="round"/>`
  }
  if (base === 'one' || base === 'zero_or_one' || base === 'one_or_more') {
    shape += `<path d="M -12 -9 L -12 9" stroke="${theme.line}" stroke-width="1.6" stroke-linecap="round"/>`
  }
  if (base === 'zero_or_one' || optional) {
    shape += `<circle cx="-20" cy="0" r="4.5" fill="${theme.background}" stroke="${theme.line}" stroke-width="1.4"/>`
  }
  const textValue = label ? cardinalityLabel(base, optional) : ''
  return `<g transform="translate(${num(x)} ${num(y)}) rotate(${num(angle)})">${shape}</g>${textValue ? text(lx, ly, textValue, { size: 9.5, weight: 650, fill: theme.muted, anchor: 'middle', style: 'paint-order: stroke; stroke: ' + theme.background + '; stroke-width: 3px' }) : ''}`
}

function header(ir, layout, theme) {
  const h = layout.header
  const titleLines = h.titleLines
  const revision = ir.revision ? `Revision ${ir.revision}` : ''
  return `<g>
    <rect x="0" y="0" width="${num(layout.width)}" height="${num(h.height)}" fill="${theme.headerBand}"/>
    <rect x="0" y="${num(h.height - 4)}" width="${num(layout.width)}" height="4" fill="${theme.accent}"/>
    ${lines(titleLines, 32, 42, { size: 25, weight: 700, fill: theme.headerText, lineHeight: 32 })}
    ${h.subtitle ? text(32, h.height - 15, h.subtitle.toUpperCase(), { size: 10.5, weight: 700, fill: theme.headerText, opacity: 0.82, letterSpacing: 1.6 }) : ''}
    ${revision ? text(layout.width - 32, 36, revision, { size: 11, weight: 600, fill: theme.headerText, anchor: 'end', opacity: 0.82 }) : ''}
  </g>`
}

function footer(ir, layout, theme) {
  return `<g>
    <line x1="32" y1="${num(layout.height - 42)}" x2="${num(layout.width - 32)}" y2="${num(layout.height - 42)}" stroke="${theme.groupBorder}" stroke-width="1" opacity="0.5"/>
    ${text(32, layout.height - 20, `AI Diagram Studio · revision ${ir.revision ?? 1}`, { size: 9.5, fill: theme.muted })}
    ${text(layout.width - 32, layout.height - 20, 'Semantic IR → deterministic SVG', { size: 9.5, fill: theme.muted, anchor: 'end' })}
  </g>`
}

function renderGroups(layout, theme) {
  return layout.groups.map(group => `<g>
    <rect x="${num(group.x)}" y="${num(group.y)}" width="${num(group.w)}" height="${num(group.h)}" rx="12" fill="${theme.groupFill}" fill-opacity="0.5" stroke="${theme.groupBorder}" stroke-width="1.2" stroke-dasharray="7 5"/>
    ${text(group.x + 12, group.y + 19, group.label, { size: 11, weight: 700, fill: theme.muted, letterSpacing: 0.3 })}
  </g>`).join('')
}

function renderNode(node, diagramType, theme) {
  const fill = nodeFill(theme, node.kind)
  const common = `fill="${fill}" stroke="${theme.border}" stroke-width="1.4"`
  const titleY = 21
  const title = lines(node.titleLines ?? [node.name], 14, titleY, { size: node.headerFs ?? 14, weight: 650, fill: theme.text, lineHeight: (node.headerFs ?? 14) * 1.3 })
  switch (diagramType) {
    case 'erd': {
      const rows = node.attrs ?? []
      let body = ''
      rows.forEach((attr, index) => {
        const rowY = node.headerH + index * (node.row ?? 23)
        if (index % 2 === 1) body += `<rect x="1" y="${num(rowY)}" width="${num(node.w - 2)}" height="${num(node.row ?? 23)}" fill="${theme.panelAlt}" opacity="0.7"/>`
        if (attr.key) body += `<rect x="10" y="${num(rowY + 5)}" width="24" height="14" rx="3" fill="${theme.accent}"/><text x="22" y="${num(rowY + 15.3)}" font-size="8.2" font-weight="700" fill="${theme.accentText}" text-anchor="middle" font-family="${SANS}">${esc(attr.key)}</text>`
        body += text(attr.key ? 42 : 14, rowY + 16, attr.name, { size: node.fs, weight: attr.primary_key ? 650 : 450, fill: theme.text, family: MONO })
        if (attr.type) body += text(node.w - 12, rowY + 16, attr.type, { size: node.fs - 1, fill: theme.muted, anchor: 'end', family: MONO })
      })
      if (!rows.length) body += text(14, node.headerH + 17, 'no attributes', { size: node.fs, fill: theme.muted, style: 'font-style: italic' })
      return `<g><rect x="0" y="0" width="${num(node.w)}" height="${num(node.h)}" rx="9" ${common}/>
        <path d="M 0 9 Q 0 0 9 0 H ${num(node.w - 9)} Q ${num(node.w)} 0 ${num(node.w)} 9 V ${num(node.headerH)} H 0 Z" fill="${theme.headerBand}" opacity="${theme.name === 'monochrome' ? '1' : '0.1'}"/>
        <line x1="0" y1="${num(node.headerH)}" x2="${num(node.w)}" y2="${num(node.headerH)}" stroke="${theme.border}" stroke-width="1.2"/>
        ${lines(node.titleLines, 14, titleY, { size: node.headerFs, weight: 700, fill: theme.text, lineHeight: node.headerFs * 1.3 })}${body}
        ${node.kind === 'associative_entity' ? `<rect x="4" y="4" width="${num(node.w - 8)}" height="${num(node.h - 8)}" rx="7" fill="none" stroke="${theme.border}" stroke-width="0.9" stroke-dasharray="4 3"/>` : ''}
      </g>`
    }
    case 'uml_class':
      return `<g><rect x="0" y="0" width="${num(node.w)}" height="${num(node.h)}" rx="4" ${common}/>
        <rect x="0" y="0" width="${num(node.w)}" height="${num(node.headerH)}" rx="4" fill="${theme.headerBand}" opacity="${theme.name === 'monochrome' ? '1' : '0.09'}"/>
        ${node.stereotype ? text(node.w / 2, 16, node.stereotype, { size: node.fs - 1.5, weight: 600, fill: theme.muted, anchor: 'middle', style: 'font-style: italic' }) : ''}
        ${lines(node.titleLines, node.w / 2, 34, { size: node.headerFs, weight: 700, fill: theme.text, anchor: 'middle', lineHeight: node.headerFs * 1.3 })}
        <line x1="0" y1="${num(node.headerH)}" x2="${num(node.w)}" y2="${num(node.headerH)}" stroke="${theme.border}"/>
        ${(node.attributes ?? []).map((member, index) => text(12, node.headerH + 18 + index * (node.row ?? 23), member.text, { size: node.fs, fill: theme.text, family: MONO })).join('')}
        <line x1="0" y1="${num(node.headerH + node.attrH)}" x2="${num(node.w)}" y2="${num(node.headerH + node.attrH)}" stroke="${theme.border}"/>
        ${(node.methods ?? []).map((member, index) => text(12, node.headerH + node.attrH + 18 + index * (node.row ?? 23), member.text, { size: node.fs, fill: theme.text, family: MONO })).join('')}
      </g>`
    case 'sequence':
      return `<g><rect x="0" y="0" width="${num(node.w)}" height="${num(node.h)}" rx="4" ${common}/>
        <rect x="0" y="0" width="4" height="${num(node.h)}" fill="${theme.accent}"/>
        ${lines(node.lines, node.w / 2, node.h / 2 - (node.lines.length - 1) * (node.fs + 2) / 2 + node.fs / 3, { size: node.fs, weight: 650, fill: theme.text, anchor: 'middle', lineHeight: node.fs + 2 })}
      </g>`
    case 'uml_usecase':
      if (node.kind === 'actor') {
        const cx = node.w / 2
        return `<g><circle cx="${num(cx)}" cy="19" r="10" fill="${fill}" stroke="${theme.border}" stroke-width="1.6"/>
          <path d="M ${num(cx)} 29 V 56 M ${num(cx - 17)} 39 H ${num(cx + 17)} M ${num(cx)} 56 L ${num(cx - 14)} 81 M ${num(cx)} 56 L ${num(cx + 14)} 81" stroke="${theme.border}" stroke-width="1.6" stroke-linecap="round"/>
          ${lines(node.lines, cx, 98, { size: node.fs, weight: 650, fill: theme.text, anchor: 'middle', lineHeight: node.fs + 2 })}
        </g>`
      }
      if (node.kind === 'note') return `<g><path d="M0,0 H${num(node.w - 14)} L${num(node.w)},14 V${num(node.h)} H0 Z" fill="${theme.note}" stroke="${theme.noteBorder}" stroke-width="1.2"/>${lines(node.lines, 12, 24, { size: node.fs, fill: theme.text, lineHeight: node.fs + 3 })}</g>`
      return `<g><ellipse cx="${num(node.w / 2)}" cy="${num(node.h / 2)}" rx="${num(node.w / 2 - 1)}" ry="${num(node.h / 2 - 1)}" ${common}/>
        ${lines(node.lines, node.w / 2, node.h / 2 - (node.lines.length - 1) * (node.fs + 4) / 2 + node.fs / 3, { size: node.fs, weight: 600, fill: theme.text, anchor: 'middle', lineHeight: node.fs + 4 })}
      </g>`
    case 'flowchart':
    case 'uml_activity':
    case 'uml_state': {
      if (node.kind === 'initial' || node.kind === 'final') {
        const cx = node.w / 2
        const cy = node.h / 2
        return node.kind === 'initial'
          ? `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(node.w / 2 - 1)}" fill="${theme.text}"/>`
          : `<g><circle cx="${num(cx)}" cy="${num(cy)}" r="${num(node.w / 2 - 1)}" fill="none" stroke="${theme.text}" stroke-width="1.6"/><circle cx="${num(cx)}" cy="${num(cy)}" r="${num(node.w / 2 - 6)}" fill="${theme.text}"/></g>`
      }
      if (node.kind === 'decision' || node.kind === 'choice' || node.kind === 'merge') {
        return `<g><path d="M${num(node.w / 2)} 1 L${num(node.w - 1)} ${num(node.h / 2)} L${num(node.w / 2)} ${num(node.h - 1)} L1 ${num(node.h / 2)} Z" ${common}/>
          ${lines(node.lines, node.w / 2, node.h / 2 - (node.lines.length - 1) * (node.fs + 3) / 2 + node.fs / 3, { size: node.fs, weight: 600, fill: theme.text, anchor: 'middle', lineHeight: node.fs + 3 })}
        </g>`
      }
      if (node.kind === 'connector') return `<circle cx="${num(node.w / 2)}" cy="${num(node.h / 2)}" r="${num(node.w / 2 - 1)}" ${common}/>`
      if (node.kind === 'fork' || node.kind === 'join') return `<rect x="0" y="${num(node.h / 2 - 4)}" width="${num(node.w)}" height="8" rx="2" fill="${theme.text}"/>`
      if (node.kind === 'start' || node.kind === 'end' || node.kind === 'terminator') return `<g><rect x="0" y="0" width="${num(node.w)}" height="${num(node.h)}" rx="${num(node.h / 2)}" ${common}/>
        ${lines(node.lines, node.w / 2, node.h / 2 - (node.lines.length - 1) * (node.fs + 3) / 2 + node.fs / 3, { size: node.fs, weight: 650, fill: theme.text, anchor: 'middle', lineHeight: node.fs + 3 })}
      </g>`
      if (node.kind === 'input' || node.kind === 'output') return `<g><path d="M14,0 H${num(node.w)} L${num(node.w - 14)},${num(node.h)} H0 Z" ${common}/>
        ${lines(node.lines, node.w / 2, node.h / 2 - (node.lines.length - 1) * (node.fs + 4) / 2 + node.fs / 3, { size: node.fs, weight: 550, fill: theme.text, anchor: 'middle', lineHeight: node.fs + 4 })}
      </g>`
      if (node.kind === 'document') return `<g><path d="M0,0 H${num(node.w)} V${num(node.h - 12)} C${num(node.w * 0.75)},${num(node.h - 26)} ${num(node.w * 0.25)},${num(node.h + 2)} 0,${num(node.h - 12)} Z" ${common}/>
        ${lines(node.lines, node.w / 2, node.h / 2 - (node.lines.length - 1) * (node.fs + 4) / 2, { size: node.fs, weight: 550, fill: theme.text, anchor: 'middle', lineHeight: node.fs + 4 })}
      </g>`
      if (node.kind === 'subprocess') return `<g><rect x="0" y="0" width="${num(node.w)}" height="${num(node.h)}" rx="4" ${common}/><rect x="5" y="5" width="${num(node.w - 10)}" height="${num(node.h - 10)}" rx="2" fill="none" stroke="${theme.border}" stroke-width="0.9"/>${lines(node.lines, node.w / 2, node.h / 2 - (node.lines.length - 1) * (node.fs + 4) / 2, { size: node.fs, weight: 550, fill: theme.text, anchor: 'middle', lineHeight: node.fs + 4 })}</g>`
      if (node.kind === 'note') return `<g><path d="M0,0 H${num(node.w - 14)} L${num(node.w)},14 V${num(node.h)} H0 Z" fill="${theme.note}" stroke="${theme.noteBorder}" stroke-width="1.2"/>${lines(node.lines, 12, 24, { size: node.fs, fill: theme.text, lineHeight: node.fs + 3 })}</g>`
      const radius = node.kind === 'action' ? 12 : 6
      return `<g><rect x="0" y="0" width="${num(node.w)}" height="${num(node.h)}" rx="${radius}" ${common}/>
        ${lines(node.lines, node.w / 2, node.h / 2 - (node.lines.length - 1) * (node.fs + 4) / 2 + node.fs / 3, { size: node.fs, weight: 550, fill: theme.text, anchor: 'middle', lineHeight: node.fs + 4 })}
      </g>`
    }
    case 'architecture': {
      const glyph = node.kind === 'database'
        ? `<ellipse cx="18" cy="24" rx="9" ry="4" fill="none" stroke="${theme.accent}" stroke-width="1.5"/><path d="M9 24 V38 A9 4 0 0 0 27 38 V24" fill="none" stroke="${theme.accent}" stroke-width="1.5"/>`
        : node.kind === 'queue'
          ? `<path d="M10 24 H27 M10 31 H27 M10 38 H27" stroke="${theme.accent}" stroke-width="1.7" stroke-linecap="round"/>`
          : node.kind === 'cache'
            ? `<circle cx="18" cy="31" r="9" fill="none" stroke="${theme.accent}" stroke-width="1.5"/><path d="M13 31 H23 M18 26 V36" stroke="${theme.accent}" stroke-width="1.4"/>`
            : `<rect x="10" y="23" width="16" height="16" rx="3" fill="none" stroke="${theme.accent}" stroke-width="1.5"/>`
      return `<g><rect x="0" y="0" width="${num(node.w)}" height="${num(node.h)}" rx="7" ${common}/>
        <path d="M 7 0 H ${num(node.w - 7)} Q ${num(node.w)} 0 ${num(node.w)} 7 V 4 H 0 V 7 Q 0 0 7 0 Z" fill="${theme.accent}"/>
        ${glyph}
        ${lines(node.lines, 36, 30, { size: node.fs, weight: 650, fill: theme.text, lineHeight: node.fs + 3 })}
        ${(node.technology ?? []).map((value, index) => text(36, 50 + index * 13, value, { size: node.fs - 1.2, fill: theme.muted })).join('')}
        ${text(node.w - 10, node.h - 10, node.kind.toUpperCase(), { size: 7.2, weight: 700, fill: theme.muted, anchor: 'end', letterSpacing: 0.6, opacity: 0.8 })}
      </g>`
    }
    default:
      return `<g><rect x="0" y="0" width="${num(node.w)}" height="${num(node.h)}" rx="8" ${common}/>${title}</g>`
  }
}

function edgeMarker(edge, diagramType) {
  if (diagramType === 'erd') return { start: '', end: '' }
  if (diagramType === 'uml_class') {
    switch (edge.kind) {
      case 'inheritance':
      case 'realization': return { start: '', end: 'url(#triangle)' }
      case 'composition': return { start: 'url(#diamond-filled)', end: '' }
      case 'aggregation': return { start: 'url(#diamond-open)', end: '' }
      case 'dependency': return { start: '', end: 'url(#arrow-open)' }
      default: return { start: '', end: '' }
    }
  }
  if (diagramType === 'uml_usecase') {
    if (edge.kind === 'generalization') return { start: '', end: 'url(#triangle)' }
    if (edge.kind === 'include' || edge.kind === 'extend') return { start: '', end: 'url(#arrow-open)' }
    return { start: '', end: '' }
  }
  if (diagramType === 'architecture') return { start: '', end: edge.kind === 'depends' ? 'url(#arrow-open)' : 'url(#arrow)' }
  if (diagramType === 'sequence') return { start: '', end: edge.kind === 'return' || edge.kind === 'async' ? 'url(#arrow-open)' : 'url(#arrow)' }
  return { start: '', end: 'url(#arrow)' }
}

function edgeDash(edge, diagramType) {
  if (edge.dashed) return '6 4'
  if (diagramType === 'sequence' && edge.kind === 'return') return '6 4'
  if (diagramType === 'uml_class' && ['dependency', 'realization'].includes(edge.kind)) return '6 4'
  if (diagramType === 'uml_usecase' && ['include', 'extend'].includes(edge.kind)) return '6 4'
  return ''
}

function renderEdge(edge, diagramType, theme) {
  if (!edge.points?.length) return ''
  const markers = edgeMarker(edge, diagramType)
  const dash = edgeDash(edge, diagramType)
  const d = pathFromPoints(edge.points)
  let output = `<path d="${d}" fill="none" stroke="${theme.line}" stroke-width="${diagramType === 'sequence' ? 1.35 : 1.5}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}${markers.start ? ` marker-start="${markers.start}"` : ''}${markers.end ? ` marker-end="${markers.end}"` : ''}/>`
  return output
}

function endpointBadge(edge, which, value, theme) {
  if (!value) return ''
  const points = edge.points
  const point = which === 'source' ? points[0] : points.at(-1)
  const toward = which === 'source' ? points[1] ?? point : points.at(-2) ?? point
  const dx = toward.x - point.x
  const dy = toward.y - point.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const x = point.x + ux * 26 - uy * 12
  const y = point.y + uy * 26 + ux * 12
  return `<text x="${num(x)}" y="${num(y)}" font-size="10" font-weight="650" fill="${theme.muted}" text-anchor="middle" font-family="${SANS}" stroke="${theme.background}" stroke-width="3.2" paint-order="stroke">${esc(value)}</text>`
}

function renderEdgeDecorations(edge, diagramType, theme) {
  if (!edge.points?.length) return ''
  let output = ''
  if (diagramType === 'erd') {
    const start = edge.points[0]
    const next = edge.points[1] ?? start
    const end = edge.points.at(-1)
    const prev = edge.points.at(-2) ?? end
    const startAngle = Math.atan2(start.y - next.y, start.x - next.x) * 180 / Math.PI
    const endAngle = Math.atan2(end.y - prev.y, end.x - prev.x) * 180 / Math.PI
    output += crowFoot(start.x, start.y, startAngle, edge.cardinality?.source, edge.cardinality?.source_optional, theme, true)
    output += crowFoot(end.x, end.y, endAngle, edge.cardinality?.target, edge.cardinality?.target_optional, theme, true)
  }
  if (diagramType === 'uml_class' && !['inheritance', 'realization'].includes(edge.kind)) {
    output += endpointBadge(edge, 'source', cardinalityLabel(edge.cardinality?.source, edge.cardinality?.source_optional), theme)
    output += endpointBadge(edge, 'target', cardinalityLabel(edge.cardinality?.target, edge.cardinality?.target_optional), theme)
  }
  return output
}

function renderEdgeLabel(edge, theme) {
  if (!edge.labelLines?.length) return ''
  const width = Math.max(...edge.labelLines.map(line => textWidth(line, 10.5, 550))) + 12
  const height = edge.labelLines.length * 13 + 6
  return `<g><rect x="${num(edge.labelX - width / 2)}" y="${num(edge.labelY - 11)}" width="${num(width)}" height="${num(height)}" rx="4" fill="${theme.background}" fill-opacity="0.94" stroke="${theme.groupBorder}" stroke-width="0.6" stroke-opacity="0.45"/>
    ${lines(edge.labelLines, edge.labelX, edge.labelY, { size: 10.5, weight: 550, fill: theme.muted, anchor: 'middle', lineHeight: 13 })}
  </g>`
}

function renderSequenceExtras(ir, layout, theme) {
  const lifelines = layout.lifelines.map(line => `<line x1="${num(line.x)}" y1="${num(line.y)}" x2="${num(line.x)}" y2="${num(line.bottom)}" stroke="${theme.line}" stroke-width="1" stroke-dasharray="5 5" opacity="0.65"/>`).join('')
  const activations = (layout.activations ?? []).map(bar => `<rect x="${num(bar.x - 5)}" y="${num(bar.y)}" width="10" height="${num(Math.max(18, bar.h))}" fill="${theme.panel}" stroke="${theme.border}" stroke-width="1.2" opacity="0.96"/>`).join('')
  const frames = (layout.frames ?? []).map((frame, index) => {
    const tab = Math.min(frame.w - 2, Math.max(110, textWidth(`${frame.kind.toUpperCase()} ${frame.label}`, 10, 700) * 1.85 + 34))
    return `<g><rect x="${num(frame.x)}" y="${num(frame.y)}" width="${num(frame.w)}" height="${num(frame.h)}" rx="3" fill="none" stroke="${theme.border}" stroke-width="1.2"/>
      <path d="M${num(frame.x)} ${num(frame.y)} H${num(frame.x + tab)} V${num(frame.y + 22)} H${num(frame.x)} Z" fill="${theme.panelAlt}" stroke="${theme.border}" stroke-width="1.1"/>
      ${text(frame.x + 9, frame.y + 15, `${frame.kind.toUpperCase()} ${frame.label}`, { size: 9.5, weight: 700, fill: theme.text })}
      <path d="M${num(frame.x)} ${num(frame.y + 22)} H${num(frame.x + tab)}" stroke="${theme.border}" stroke-width="1.1"/>
    </g>`
  }).join('')
  return `${frames}${lifelines}${activations}`
}

export function renderSVG(ir) {
  if (!ir?.layout) throw new Error('renderSVG requires a layout')
  const layout = ir.layout
  const theme = getTheme(ir.style?.theme)
  const diagramType = ir.diagram_type
  const groups = renderGroups(layout, theme)
  const edges = layout.edges.map(edge => renderEdge(edge, diagramType, theme)).join('')
  const sequenceExtras = diagramType === 'sequence' ? renderSequenceExtras(ir, layout, theme) : ''
  const nodes = layout.nodes.map(node => `<g transform="translate(${num(node.x)} ${num(node.y)})">${renderNode(node, diagramType, theme)}</g>`).join('')
  const decorations = layout.edges.map(edge => renderEdgeDecorations(edge, diagramType, theme)).join('')
  const labels = layout.edges.map(edge => renderEdgeLabel(edge, theme)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(layout.width)}" height="${num(layout.height)}" viewBox="0 0 ${num(layout.width)} ${num(layout.height)}" role="img" aria-labelledby="diagram-title diagram-desc">
  <title id="diagram-title">${esc(ir.title)}</title>
  <desc id="diagram-desc">${esc(`${layout.header.subtitle} generated from a validated semantic model.`)}</desc>
  ${markerDefs(theme)}
  <rect width="${num(layout.width)}" height="${num(layout.height)}" fill="${theme.background}"/>
  ${header(ir, layout, theme)}
  ${groups}
  ${sequenceExtras}
  ${edges}
  ${nodes}
  ${decorations}
  ${labels}
  ${footer(ir, layout, theme)}
</svg>`
}

export function renderSVGDocument(htmlTitle, svg) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(htmlTitle)}</title><style>html,body{margin:0;padding:0;background:#ffffff;}svg{display:block;}</style></head><body>${svg}</body></html>`
}
