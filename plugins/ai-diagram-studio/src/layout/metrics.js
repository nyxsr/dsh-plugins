/** Deterministic node metrics shared by the layout engine and SVG renderer. */
import { textWidth, wrapText } from '../core/text.js'

const DENSITIES = {
  compact: { gap: 30, layerGap: 48, pad: 18, font: 11.5, title: 20, line: 1.28, row: 21 },
  comfortable: { gap: 46, layerGap: 68, pad: 26, font: 12.5, title: 23, line: 1.34, row: 23 },
  spacious: { gap: 64, layerGap: 92, pad: 36, font: 13.5, title: 25, line: 1.38, row: 25 },
}

export function resolveDensity(value, diagramType = 'erd') {
  if (value && value !== 'auto' && DENSITIES[value]) return { name: value, ...DENSITIES[value] }
  const name = diagramType === 'erd' || diagramType === 'uml_class' ? 'comfortable' : 'comfortable'
  return { name, ...DENSITIES[name] }
}

export function densityTable() {
  return DENSITIES
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function wrap(value, width, size, maxLines = 4, weight = 400) {
  return wrapText(value, Math.max(24, width), size, maxLines, weight)
}

function memberVisibility(value) {
  return ['+', '-', '#', '~'].includes(value) ? value : ''
}

function formatAttribute(attribute, index) {
  const visibility = memberVisibility(attribute.visibility)
  const key = attribute.primary_key ? 'PK' : attribute.foreign_key ? 'FK' : attribute.unique ? 'UQ' : ''
  const type = attribute.type ? `: ${attribute.type}` : ''
  return {
    id: attribute.id ?? `attr-${index}`,
    name: attribute.name,
    type: attribute.type ?? '',
    key,
    unique: Boolean(attribute.unique),
    nullable: attribute.nullable !== false,
    text: `${visibility ? `${visibility} ` : ''}${attribute.name}${type}`,
    visibility,
  }
}

function formatMethod(method, index) {
  const visibility = memberVisibility(method.visibility)
  const params = Array.isArray(method.parameters) ? method.parameters.join(', ') : method.parameters ?? ''
  const returns = method.returns ? `: ${method.returns}` : ''
  const flags = [method.static ? '{static}' : '', method.abstract ? '{abstract}' : ''].filter(Boolean).join(' ')
  return {
    id: method.id ?? `method-${index}`,
    name: method.name,
    text: `${visibility ? `${visibility} ` : ''}${method.name}(${params})${returns}`,
    flags,
    visibility,
  }
}

function measureERD(node, d) {
  const fs = d.font + 0.5
  const headerFs = d.font + 2
  const attrs = Array.isArray(node.attributes) ? node.attributes.map(formatAttribute) : []
  const nameWidth = textWidth(node.name, headerFs, 650)
  const attrWidth = attrs.reduce((max, attribute) => {
    const keyWidth = attribute.key ? 38 : 4
    return Math.max(max, textWidth(attribute.name, fs, 500) + textWidth(attribute.type, fs - 1) + keyWidth + 24)
  }, 0)
  const w = clamp(Math.max(190, nameWidth + 48, attrWidth + 34), 190, 380)
  const titleLines = wrap(node.name, w - 32, headerFs, 2, 650)
  const headerH = titleLines.length * headerFs * 1.3 + 26
  const h = headerH + Math.max(1, attrs.length) * d.row + 14
  return { w, h, headerH, fs, headerFs, titleLines, attrs, row: d.row, kind: node.kind }
}

function measureClass(node, d) {
  const fs = d.font
  const headerFs = d.font + 1.5
  const attributes = (node.attributes ?? []).map(formatAttribute)
  const methods = (node.methods ?? []).map(formatMethod)
  const memberWidth = [...attributes, ...methods].reduce((max, member) => Math.max(max, textWidth(member.text, fs)), 0)
  const w = clamp(Math.max(220, textWidth(node.name, headerFs, 650) + 46, memberWidth + 52), 220, 380)
  const titleLines = wrap(node.name, w - 28, headerFs, 2, 650)
  const stereotypeH = node.stereotype || ['interface', 'abstract', 'enum'].includes(node.kind) ? 20 : 0
  const headerH = titleLines.length * headerFs * 1.35 + 24 + stereotypeH
  const attrH = Math.max(1, attributes.length) * d.row + 10
  const methodH = Math.max(1, methods.length) * d.row + 10
  return {
    w,
    h: headerH + attrH + methodH,
    headerH,
    attrH,
    methodH,
    row: d.row,
    fs,
    headerFs,
    titleLines,
    attributes,
    methods,
    stereotype: node.stereotype || (node.kind === 'interface' ? '«interface»' : node.kind === 'abstract' ? '«abstract»' : node.kind === 'enum' ? '«enumeration»' : ''),
  }
}

function measureFlow(node, d) {
  const fs = d.font
  const kind = node.kind
  if (kind === 'decision') {
    const w = clamp(190, 170, 260)
    const lines = wrap(node.label || node.name, w - 64, fs, 3, 550)
    return { w, h: Math.max(96, 44 + lines.length * (fs + 4)), fs, lines, kind }
  }
  if (kind === 'connector') return { w: 58, h: 58, fs, lines: [], kind }
  if (kind === 'initial') return { w: 30, h: 30, fs, lines: [], kind }
  if (kind === 'final') return { w: 36, h: 36, fs, lines: [], kind }
  if (kind === 'choice') {
    const w = 120
    const lines = wrap(node.label || node.name, w - 40, fs, 2, 550)
    return { w, h: Math.max(86, 38 + lines.length * (fs + 4)), fs, lines, kind }
  }
  if (kind === 'start' || kind === 'end' || kind === 'terminator') {
    const w = clamp(Math.max(116, textWidth(node.label || node.name, fs, 600) + 44), 116, 230)
    const lines = wrap(node.label || node.name, w - 36, fs, 2, 600)
    return { w, h: Math.max(48, 26 + lines.length * (fs + 3)), fs, lines, kind }
  }
  const w = clamp(Math.max(156, textWidth(node.label || node.name, fs, 550) + 44), 156, 250)
  const lines = wrap(node.label || node.name, w - 32, fs, 4, 550)
  return { w, h: Math.max(64, 28 + lines.length * (fs + 5)), fs, lines, kind }
}

function measureState(node, d) {
  const fs = d.font
  if (node.kind === 'initial') return { w: 30, h: 30, fs, lines: [], kind: node.kind }
  if (node.kind === 'final') return { w: 36, h: 36, fs, lines: [], kind: node.kind }
  if (node.kind === 'choice') {
    const lines = wrap(node.label || node.name, 84, fs, 2, 550)
    return { w: 112, h: 82, fs, lines, kind: node.kind }
  }
  const w = clamp(Math.max(160, textWidth(node.label || node.name, fs, 550) + 46), 160, 260)
  const lines = wrap(node.label || node.name, w - 34, fs, 3, 550)
  return { w, h: Math.max(62, 28 + lines.length * (fs + 5)), fs, lines, kind: node.kind }
}

function measureUsecase(node, d) {
  const fs = d.font
  if (node.kind === 'actor') {
    const lines = wrap(node.label || node.name, 110, fs, 3, 600)
    return { w: 116, h: 112 + lines.length * (fs + 2), fs, lines, kind: 'actor' }
  }
  const w = clamp(Math.max(176, textWidth(node.label || node.name, fs, 550) * 1.35), 176, 270)
  const lines = wrap(node.label || node.name, w * 0.72, fs, 3, 550)
  return { w, h: Math.max(82, lines.length * (fs + 5) + 44), fs, lines, kind: node.kind }
}

function measureArchitecture(node, d) {
  const fs = d.font
  const lines = wrap(node.label || node.name, 220, fs, 2, 600)
  const technology = node.technology ? wrap(node.technology, 210, fs - 1, 1) : []
  const w = clamp(Math.max(178, textWidth(node.label || node.name, fs, 600) + 58, technology.length ? textWidth(technology[0], fs - 1) + 58 : 0), 178, 260)
  return { w, h: technology.length ? 88 : 76, fs, lines, technology, kind: node.kind }
}

function measureSequence(node, d) {
  const fs = d.font
  const lines = wrap(node.label || node.name, 150, fs, 2, 600)
  const w = clamp(Math.max(120, textWidth(node.label || node.name, fs, 600) + 38), 120, 190)
  return { w, h: 48 + (lines.length - 1) * (fs + 2), fs, lines, kind: node.kind }
}

export function measureNode(node, diagramType, density = 'auto') {
  const d = typeof density === 'object' ? density : resolveDensity(density, diagramType)
  switch (diagramType) {
    case 'erd': return measureERD(node, d)
    case 'uml_class': return measureClass(node, d)
    case 'flowchart':
    case 'uml_activity': return measureFlow(node, d)
    case 'uml_state': return measureState(node, d)
    case 'uml_usecase': return measureUsecase(node, d)
    case 'architecture': return measureArchitecture(node, d)
    case 'sequence': return measureSequence(node, d)
    default: return measureFlow(node, d)
  }
}

export function estimateTextLines(text, width, fontSize, maxLines = 3, weight = 500) {
  return wrap(text, width, fontSize, maxLines, weight)
}
