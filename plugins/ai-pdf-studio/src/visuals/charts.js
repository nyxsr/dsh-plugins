/**
 * Dependency-free SVG chart and diagram engine.
 *
 * Charts are vector assets, validated before rendering, and use explicit
 * theme colors so the PDF remains legible without external JavaScript.
 */

const W = 720
const H = 310

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function formatNumber(value, options = {}) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  const compact = options.compact !== false
  let out
  if (compact && abs >= 1_000_000_000) out = `${(n / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`
  else if (compact && abs >= 1_000_000) out = `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  else if (compact && abs >= 10_000) out = `${(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`
  else out = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)
  return `${out}${options.suffix ?? ''}`
}

function niceMax(value) {
  const n = Math.max(0, Number(value) || 0)
  if (n === 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(n))
  const normalized = n / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 1.5 ? 1.5 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 3 ? 3 : normalized <= 4 ? 4 : normalized <= 5 ? 5 : normalized <= 7.5 ? 7.5 : 10
  return nice * magnitude
}

function svgOpen(title, desc, height = H) {
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${height}" role="img" aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg">
    <title>${esc(title)}</title><desc>${esc(desc)}</desc>`
}

function labelFont(theme, size = 9) {
  return `font-family="${esc(theme.fonts.mono.replace(/"/g, "'"))}" font-size="${size}"`
}

function truncate(value, max = 18) {
  const raw = String(value ?? '')
  return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw
}

function axisGrid({ x0, y0, x1, y1, max, min = 0, theme, ticks = 4, format = v => formatNumber(v) }) {
  const parts = []
  for (let i = 0; i <= ticks; i += 1) {
    const t = i / ticks
    const y = y1 - t * (y1 - y0)
    const value = min + t * (max - min)
    parts.push(`<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x1}" y2="${y.toFixed(1)}" stroke="${theme.colors.line}" stroke-width="0.7"/>`)
    parts.push(`<text x="${x0 - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end" ${labelFont(theme, 7.2)} fill="${theme.colors.muted}">${esc(format(value))}</text>`)
  }
  return parts.join('')
}

function xLabels(categories, { x0, x1, y, theme, maxChars = 18 }) {
  const count = categories.length
  const step = count > 1 ? (x1 - x0) / (count - 1) : 0
  const every = Math.max(1, Math.ceil(count / 8))
  return categories.map((category, index) => {
    if (index % every !== 0 && index !== count - 1) return ''
    const x = x0 + step * index
    return `<text x="${x.toFixed(1)}" y="${y + 14}" text-anchor="middle" ${labelFont(theme, 7.2)} fill="${theme.colors.muted}">${esc(truncate(category, maxChars))}</text>`
  }).join('')
}

function legend(series, { x, y, theme, max = 4 }) {
  return series.slice(0, max).map((entry, index) => {
    const row = Math.floor(index / 2)
    const col = index % 2
    const lx = x + col * 150
    const ly = y + row * 16
    return `<rect x="${lx}" y="${ly - 6}" width="7" height="7" fill="${entry.color}"/>
      <text x="${lx + 12}" y="${ly}" ${labelFont(theme, 7.6)} fill="${theme.colors.muted}">${esc(truncate(entry.name, 20))}</text>`
  }).join('')
}

export function chartSummary(block) {
  const data = block.data ?? {}
  if (block.chart_type === 'donut' || block.chart_type === 'pie') {
    return (data.items ?? []).map(item => `${item.label}: ${formatNumber(item.value)}`).join(', ')
  }
  if (block.chart_type === 'scatter') {
    return `${(data.points ?? []).length} observations plotted.`
  }
  return (data.series ?? []).map(series => `${series.name}: ${(series.values ?? []).map(value => formatNumber(value)).join(', ')}`).join(', ')
}

export function renderChart(block, theme) {
  const palette = theme.layout.chartPalette
  switch (block.chart_type) {
    case 'line': return lineChart(block, theme, false)
    case 'area': return lineChart(block, theme, true)
    case 'donut': return donutChart(block, theme, true)
    case 'pie': return donutChart(block, theme, false)
    case 'scatter': return scatterChart(block, theme)
    case 'horizontal_bar': return horizontalBarChart(block, theme)
    case 'stacked_bar': return stackedBarChart(block, theme)
    case 'bar':
    default: return barChart(block, theme)
  }
}

function barChart(block, theme) {
  const categories = block.data.categories ?? []
  const series = (block.data.series ?? []).map((entry, index) => ({
    ...entry, color: entry.color || theme.layout.chartPalette[index % theme.layout.chartPalette.length],
  }))
  const values = series.flatMap(entry => entry.values)
  const max = niceMax(Math.max(1, ...values))
  const x0 = 48
  const x1 = 700
  const y0 = 22
  const y1 = 258
  const groupWidth = (x1 - x0) / Math.max(1, categories.length)
  const barWidth = Math.max(4, Math.min(34, (groupWidth - 8) / Math.max(1, series.length)))
  const bars = []
  categories.forEach((category, categoryIndex) => {
    const groupX = x0 + groupWidth * categoryIndex + groupWidth / 2
    series.forEach((entry, seriesIndex) => {
      const value = Number(entry.values[categoryIndex]) || 0
      const h = Math.max(0, (value / max) * (y1 - y0))
      const x = groupX - (barWidth * series.length) / 2 + seriesIndex * barWidth
      bars.push(`<rect x="${x.toFixed(1)}" y="${(y1 - h).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${entry.color}"/>`)
      if (categories.length * series.length <= 18 && h > 12) {
        bars.push(`<text x="${(x + barWidth / 2).toFixed(1)}" y="${(y1 - h - 4).toFixed(1)}" text-anchor="middle" ${labelFont(theme, 6.8)} fill="${theme.colors.muted}">${esc(formatNumber(value))}</text>`)
      }
    })
  })
  return `${svgOpen(block.title, chartSummary(block))}
    ${axisGrid({ x0, y0, x1, y1, max, theme })}
    ${bars.join('')}
    ${xLabels(categories, { x0: x0 + groupWidth / 2, x1: x1 - groupWidth / 2, y: y1, theme })}
    ${series.length > 1 ? legend(series, { x: 50, y: 292, theme }) : ''}
    <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="${theme.colors.ink}" stroke-width="1"/>
  </svg>`
}

function lineChart(block, theme, area) {
  const categories = block.data.categories ?? []
  const series = (block.data.series ?? []).map((entry, index) => ({
    ...entry, color: entry.color || theme.layout.chartPalette[index % theme.layout.chartPalette.length],
  }))
  const allValues = series.flatMap(entry => entry.values)
  const minRaw = Math.min(0, ...allValues)
  const maxRaw = Math.max(1, ...allValues)
  const max = niceMax(maxRaw)
  const min = minRaw < 0 ? -niceMax(Math.abs(minRaw)) : 0
  const x0 = 52
  const x1 = 698
  const y0 = 22
  const y1 = 256
  const step = categories.length > 1 ? (x1 - x0) / (categories.length - 1) : 0
  const yOf = value => y1 - ((Number(value) - min) / (max - min || 1)) * (y1 - y0)
  const paths = series.map(entry => {
    const points = entry.values.map((value, index) => [x0 + step * index, yOf(value)])
    const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const areaPath = area ? `${line} L${x1.toFixed(1)},${y1} L${x0.toFixed(1)},${y1} Z` : ''
    const dots = points.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8" fill="${theme.colors.bg}" stroke="${entry.color}" stroke-width="2"/>`).join('')
    return `${area ? `<path d="${areaPath}" fill="${entry.color}" opacity="0.14"/>` : ''}
      <path d="${line}" fill="none" stroke="${entry.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}`
  }).join('')
  return `${svgOpen(block.title, chartSummary(block))}
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.colors.accent}" stop-opacity=".18"/><stop offset="1" stop-color="${theme.colors.accent}" stop-opacity="0"/></linearGradient></defs>
    ${axisGrid({ x0, y0, x1, y1, min, max, theme })}
    ${paths}
    ${xLabels(categories, { x0, x1, y: y1, theme })}
    ${legend(series, { x: 54, y: 292, theme })}
    <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="${theme.colors.ink}" stroke-width="1"/>
  </svg>`
}

function stackedBarChart(block, theme) {
  const categories = block.data.categories ?? []
  const series = (block.data.series ?? []).map((entry, index) => ({
    ...entry, color: entry.color || theme.layout.chartPalette[index % theme.layout.chartPalette.length],
  }))
  const totals = categories.map((_, index) => series.reduce((sum, entry) => sum + Math.max(0, Number(entry.values[index]) || 0), 0))
  const max = niceMax(Math.max(1, ...totals))
  const x0 = 50
  const x1 = 700
  const y0 = 22
  const y1 = 256
  const groupWidth = (x1 - x0) / Math.max(1, categories.length)
  const barWidth = Math.min(46, groupWidth * 0.56)
  const bars = []
  categories.forEach((category, index) => {
    let cursor = y1
    const x = x0 + groupWidth * index + groupWidth / 2 - barWidth / 2
    series.forEach(entry => {
      const value = Math.max(0, Number(entry.values[index]) || 0)
      const h = (value / max) * (y1 - y0)
      cursor -= h
      bars.push(`<rect x="${x.toFixed(1)}" y="${cursor.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" fill="${entry.color}"/>`)
    })
  })
  return `${svgOpen(block.title, chartSummary(block))}
    ${axisGrid({ x0, y0, x1, y1, max, theme })}
    ${bars.join('')}
    ${xLabels(categories, { x0: x0 + groupWidth / 2, x1: x1 - groupWidth / 2, y: y1, theme })}
    ${legend(series, { x: 54, y: 292, theme })}
  </svg>`
}

function horizontalBarChart(block, theme) {
  const categories = block.data.categories ?? []
  const series = (block.data.series ?? []).map((entry, index) => ({
    ...entry, color: entry.color || theme.layout.chartPalette[index % theme.layout.chartPalette.length],
  }))
  const values = series.flatMap(entry => entry.values)
  const max = niceMax(Math.max(1, ...values))
  const x0 = 150
  const x1 = 690
  const top = 26
  const rowHeight = Math.min(42, (270 - top) / Math.max(1, categories.length))
  const barHeight = Math.max(8, rowHeight * 0.48)
  const bars = []
  categories.forEach((category, index) => {
    const y = top + index * rowHeight
    const value = Number(series[0]?.values[index]) || 0
    const width = (value / max) * (x1 - x0)
    bars.push(`<text x="${x0 - 10}" y="${y + barHeight / 2 + 3}" text-anchor="end" ${labelFont(theme, 8)} fill="${theme.colors.ink}">${esc(truncate(category, 24))}</text>`)
    bars.push(`<rect x="${x0}" y="${y}" width="${Math.max(1, width).toFixed(1)}" height="${barHeight.toFixed(1)}" rx="1.5" fill="${series[0]?.color ?? theme.colors.accent}"/>`)
    bars.push(`<text x="${(x0 + width + 7).toFixed(1)}" y="${y + barHeight / 2 + 3}" ${labelFont(theme, 7.4)} fill="${theme.colors.muted}">${esc(formatNumber(value))}</text>`)
  })
  return `${svgOpen(block.title, chartSummary(block))}
    ${bars.join('')}
    <line x1="${x0}" y1="20" x2="${x0}" y2="278" stroke="${theme.colors.line}" stroke-width="1"/>
  </svg>`
}

function donutChart(block, theme, donut) {
  const items = (block.data.items ?? []).map((item, index) => ({
    ...item, color: item.color || theme.layout.chartPalette[index % theme.layout.chartPalette.length],
  }))
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.value) || 0), 0) || 1
  const cx = donut ? 218 : 220
  const cy = 150
  const radius = 92
  const inner = donut ? 58 : 0
  let angle = -Math.PI / 2
  const slices = items.map(item => {
    const share = Math.max(0, Number(item.value) || 0) / total
    const end = angle + share * Math.PI * 2
    const large = share > 0.5 ? 1 : 0
    const x1 = cx + Math.cos(angle) * radius
    const y1 = cy + Math.sin(angle) * radius
    const x2 = cx + Math.cos(end) * radius
    const y2 = cy + Math.sin(end) * radius
    let path
    if (donut) {
      const ix1 = cx + Math.cos(angle) * inner
      const iy1 = cy + Math.sin(angle) * inner
      const ix2 = cx + Math.cos(end) * inner
      const iy2 = cy + Math.sin(end) * inner
      path = `M${x1.toFixed(1)},${y1.toFixed(1)} A${radius},${radius} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix2.toFixed(1)},${iy2.toFixed(1)} A${inner},${inner} 0 ${large} 0 ${ix1.toFixed(1)},${iy1.toFixed(1)} Z`
    } else {
      path = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${radius},${radius} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`
    }
    angle = end
    return `<path d="${path}" fill="${item.color}" stroke="${theme.colors.bg}" stroke-width="1.4"/>`
  }).join('')
  const legendRows = items.map((item, index) => {
    const y = 66 + index * 27
    return `<rect x="390" y="${y - 8}" width="9" height="9" fill="${item.color}"/>
      <text x="407" y="${y}" ${labelFont(theme, 8.4)} fill="${theme.colors.ink}">${esc(truncate(item.label, 24))}</text>
      <text x="688" y="${y}" text-anchor="end" ${labelFont(theme, 8.4)} fill="${theme.colors.muted}">${esc(formatNumber(item.value))} · ${esc((Math.max(0, Number(item.value) || 0) / total * 100).toFixed(0))}%</text>`
  }).join('')
  return `${svgOpen(block.title, chartSummary(block))}
    ${slices}
    ${donut ? `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-family="${esc(theme.fonts.display.replace(/"/g, "'"))}" font-size="20" font-weight="700" fill="${theme.colors.ink}">${esc(formatNumber(total))}</text>
    <text x="${cx}" y="${cy + 15}" text-anchor="middle" ${labelFont(theme, 6.8)} fill="${theme.colors.muted}">TOTAL</text>` : ''}
    ${legendRows}
  </svg>`
}

function scatterChart(block, theme) {
  const points = (block.data.points ?? []).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const xMin = Math.min(...xs, 0)
  const xMax = Math.max(...xs, 1)
  const yMin = Math.min(...ys, 0)
  const yMax = Math.max(...ys, 1)
  const x0 = 54
  const x1 = 690
  const y0 = 24
  const y1 = 252
  const px = value => x0 + ((value - xMin) / (xMax - xMin || 1)) * (x1 - x0)
  const py = value => y1 - ((value - yMin) / (yMax - yMin || 1)) * (y1 - y0)
  const dots = points.map(point =>
    `<circle cx="${px(point.x).toFixed(1)}" cy="${py(point.y).toFixed(1)}" r="3.4" fill="${theme.colors.accent}" fill-opacity=".78" stroke="${theme.colors.bg}" stroke-width="1"/>`).join('')
  return `${svgOpen(block.title, chartSummary(block))}
    ${axisGrid({ x0, y0, x1, y1, min: yMin, max: yMax, theme, format: value => formatNumber(value) })}
    ${dots}
    <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="${theme.colors.ink}" stroke-width="1"/>
    <text x="${(x0 + x1) / 2}" y="292" text-anchor="middle" ${labelFont(theme, 7.4)} fill="${theme.colors.muted}">${esc(block.options?.x_label ?? 'X')}</text>
    <text x="14" y="${(y0 + y1) / 2}" text-anchor="middle" transform="rotate(-90 14 ${(y0 + y1) / 2})" ${labelFont(theme, 7.4)} fill="${theme.colors.muted}">${esc(block.options?.y_label ?? 'Y')}</text>
  </svg>`
}

/** Diagram renderer. All diagrams are original vector compositions. */
export function renderDiagram(block, theme) {
  const nodes = block.nodes ?? []
  switch (block.diagram_type) {
    case 'cycle': return cycleDiagram(block, theme)
    case 'layers': return layerDiagram(block, theme)
    case 'matrix': return matrixDiagram(block, theme)
    case 'comparison': return comparisonDiagram(block, theme)
    case 'org': return orgDiagram(block, theme)
    case 'flow':
    default: return flowDiagram(block, theme)
  }
}

function flowDiagram(block, theme) {
  const nodes = (block.nodes ?? []).slice(0, 5)
  const count = nodes.length
  const gap = 18
  const boxW = Math.min(160, (W - 40 - gap * (count - 1)) / count)
  const totalW = boxW * count + gap * (count - 1)
  const startX = (W - totalW) / 2
  const boxH = 92
  const y = 70
  const parts = []
  nodes.forEach((node, index) => {
    const x = startX + index * (boxW + gap)
    const color = theme.layout.chartPalette[index % theme.layout.chartPalette.length]
    parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${boxW}" height="${boxH}" rx="3" fill="${index === 0 ? color : theme.colors.surface}" stroke="${color}" stroke-width="1.2"/>`)
    parts.push(`<text x="${(x + 12).toFixed(1)}" y="${y + 24}" ${labelFont(theme, 6.6)} fill="${index === 0 ? theme.colors.bg : color}">${String(index + 1).padStart(2, '0')}</text>`)
    parts.push(`<text x="${(x + 12).toFixed(1)}" y="${y + 45}" ${labelFont(theme, 9.2)} font-weight="600" fill="${index === 0 ? theme.colors.bg : theme.colors.ink}">${esc(truncate(node.label, 18))}</text>`)
    if (node.detail) {
      const words = String(node.detail).split(/\s+/)
      const lines = []
      let current = ''
      for (const word of words) {
        if ((current + ' ' + word).trim().length > 22 && current) { lines.push(current); current = word } else current = `${current} ${word}`.trim()
      }
      if (current) lines.push(current)
      lines.slice(0, 2).forEach((line, lineIndex) => {
        parts.push(`<text x="${(x + 12).toFixed(1)}" y="${y + 62 + lineIndex * 11}" ${labelFont(theme, 6.6)} fill="${index === 0 ? theme.colors.coverMuted : theme.colors.muted}">${esc(line)}</text>`)
      })
    }
    if (index < count - 1) {
      const ax = x + boxW + 3
      const ay = y + boxH / 2
      parts.push(`<path d="M${ax},${ay} L${ax + gap - 6},${ay}" stroke="${theme.colors.accent}" stroke-width="1.4" marker-end="url(#arrow)"/>`)
    }
  })
  return `${svgOpen(block.title, nodes.map(n => n.label).join(' → '), 230)}
    <defs><marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${theme.colors.accent}"/></marker></defs>
    ${parts.join('')}
  </svg>`
}

function cycleDiagram(block, theme) {
  const nodes = (block.nodes ?? []).slice(0, 6)
  const cx = W / 2
  const cy = 132
  const radius = 92
  const parts = nodes.map((node, index) => {
    const angle = -Math.PI / 2 + (index / nodes.length) * Math.PI * 2
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const color = theme.layout.chartPalette[index % theme.layout.chartPalette.length]
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="40" fill="${color}"/>
      <text x="${x.toFixed(1)}" y="${(y - 2).toFixed(1)}" text-anchor="middle" ${labelFont(theme, 7.2)} fill="${theme.colors.bg}">${esc(truncate(node.label, 13))}</text>
      <text x="${x.toFixed(1)}" y="${(y + 11).toFixed(1)}" text-anchor="middle" ${labelFont(theme, 6.2)} fill="${theme.colors.bg}">${String(index + 1).padStart(2, '0')}</text>`
  }).join('')
  return `${svgOpen(block.title, nodes.map(n => n.label).join(' → '), 270)}
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${theme.colors.line}" stroke-width="1" stroke-dasharray="4 4"/>
    ${parts}
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-family="${esc(theme.fonts.display.replace(/"/g, "'"))}" font-size="14" font-weight="700" fill="${theme.colors.ink}">${esc(block.options?.center_label ?? 'CYCLE')}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" ${labelFont(theme, 6.4)} fill="${theme.colors.muted}">${esc(block.subtitle ?? 'continuous loop')}</text>
  </svg>`
}

function layerDiagram(block, theme) {
  const nodes = (block.nodes ?? []).slice(0, 5)
  const parts = nodes.map((node, index) => {
    const inset = index * 28
    const y = 30 + index * 49
    const color = theme.layout.chartPalette[index % theme.layout.chartPalette.length]
    return `<rect x="${(60 + inset).toFixed(1)}" y="${y}" width="${(600 - inset * 2).toFixed(1)}" height="38" rx="2" fill="${color}" opacity="${0.92 - index * 0.1}"/>
      <text x="${(76 + inset).toFixed(1)}" y="${y + 24}" ${labelFont(theme, 8.4)} font-weight="600" fill="${theme.colors.bg}">${esc(truncate(node.label, 42))}</text>
      ${node.value ? `<text x="${(644 - inset).toFixed(1)}" y="${y + 24}" text-anchor="end" ${labelFont(theme, 7.6)} fill="${theme.colors.bg}">${esc(node.value)}</text>` : ''}`
  }).join('')
  return `${svgOpen(block.title, nodes.map(n => n.label).join(' / '), 290)}${parts}</svg>`
}

function matrixDiagram(block, theme) {
  const nodes = (block.nodes ?? []).slice(0, 4)
  const labels = block.options?.axis_labels ?? ['High impact', 'Low impact', 'Low effort', 'High effort']
  const cells = nodes.map((node, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const x = 180 + col * 255
    const y = 38 + row * 112
    const color = theme.layout.chartPalette[index % theme.layout.chartPalette.length]
    return `<rect x="${x}" y="${y}" width="245" height="102" fill="${color}" opacity=".13" stroke="${color}" stroke-width="1"/>
      <text x="${x + 14}" y="${y + 26}" ${labelFont(theme, 6.6)} fill="${color}">${String(index + 1).padStart(2, '0')}</text>
      <text x="${x + 14}" y="${y + 48}" ${labelFont(theme, 9.4)} font-weight="600" fill="${theme.colors.ink}">${esc(truncate(node.label, 30))}</text>
      <text x="${x + 14}" y="${y + 66}" ${labelFont(theme, 6.8)} fill="${theme.colors.muted}">${esc(truncate(node.detail, 38))}</text>`
  }).join('')
  return `${svgOpen(block.title, nodes.map(n => n.label).join(', '), 268)}
    <text x="92" y="32" text-anchor="middle" ${labelFont(theme, 7)} fill="${theme.colors.muted}">${esc(labels[0])}</text>
    <text x="92" y="246" text-anchor="middle" ${labelFont(theme, 7)} fill="${theme.colors.muted}">${esc(labels[1])}</text>
    <text x="148" y="264" text-anchor="middle" ${labelFont(theme, 7)} fill="${theme.colors.muted}">${esc(labels[2])}</text>
    <text x="678" y="264" text-anchor="middle" ${labelFont(theme, 7)} fill="${theme.colors.muted}">${esc(labels[3])}</text>
    ${cells}
  </svg>`
}

function comparisonDiagram(block, theme) {
  const nodes = (block.nodes ?? []).slice(0, 2)
  const colors = [theme.colors.muted, theme.colors.accent]
  const parts = nodes.map((node, index) => {
    const x = 84 + index * 292
    const words = String(node.detail ?? '').split(/\s+/)
    const lines = []
    let current = ''
    for (const word of words) {
      if ((current + ' ' + word).trim().length > 34 && current) { lines.push(current); current = word } else current = `${current} ${word}`.trim()
    }
    if (current) lines.push(current)
    return `<rect x="${x}" y="46" width="252" height="184" rx="3" fill="${index === 1 ? theme.colors.accent : theme.colors.surface}" opacity="${index === 1 ? 0.12 : 0.7}" stroke="${colors[index]}" stroke-width="1.2"/>
      <text x="${x + 18}" y="76" ${labelFont(theme, 7)} fill="${colors[index]}">${index === 0 ? 'BEFORE' : 'AFTER'}</text>
      <text x="${x + 18}" y="104" font-family="${esc(theme.fonts.heading.replace(/"/g, "'"))}" font-size="17" font-weight="700" fill="${theme.colors.ink}">${esc(truncate(node.label, 26))}</text>
      ${lines.slice(0, 5).map((line, lineIndex) => `<text x="${x + 18}" y="${128 + lineIndex * 16}" ${labelFont(theme, 7.4)} fill="${theme.colors.muted}">${esc(line)}</text>`).join('')}`
  }).join('')
  return `${svgOpen(block.title, nodes.map(n => `${n.label}: ${n.detail ?? ''}`).join(' vs '), 260)}
    <path d="M356,138 L388,138 M380,132 L388,138 L380,144" stroke="${theme.colors.accent}" stroke-width="1.6" fill="none"/>
    ${parts}
  </svg>`
}

function orgDiagram(block, theme) {
  const nodes = (block.nodes ?? []).slice(0, 7)
  const root = nodes[0]
  const children = nodes.slice(1)
  const childW = Math.min(150, (W - 80) / Math.max(1, children.length))
  const totalW = childW * children.length + 14 * Math.max(0, children.length - 1)
  const startX = (W - totalW) / 2
  const parts = [`<rect x="${(W / 2 - 92).toFixed(1)}" y="26" width="184" height="54" rx="2" fill="${theme.colors.ink}"/>
    <text x="${W / 2}" y="50" text-anchor="middle" ${labelFont(theme, 8.4)} font-weight="600" fill="${theme.colors.bg}">${esc(truncate(root?.label ?? 'Organization', 26))}</text>
    <text x="${W / 2}" y="66" text-anchor="middle" ${labelFont(theme, 6.4)} fill="${theme.colors.coverMuted}">${esc(truncate(root?.detail ?? '', 34))}</text>`]
  children.forEach((node, index) => {
    const x = startX + index * (childW + 14)
    const color = theme.layout.chartPalette[(index + 1) % theme.layout.chartPalette.length]
    parts.push(`<path d="M${W / 2},80 L${W / 2},100 L${(x + childW / 2).toFixed(1)},100 L${(x + childW / 2).toFixed(1)},122" stroke="${theme.colors.line}" stroke-width="1" fill="none"/>`)
    parts.push(`<rect x="${x.toFixed(1)}" y="122" width="${childW}" height="58" rx="2" fill="${theme.colors.surface}" stroke="${color}" stroke-width="1"/>`)
    parts.push(`<text x="${(x + 10).toFixed(1)}" y="145" ${labelFont(theme, 7.6)} font-weight="600" fill="${theme.colors.ink}">${esc(truncate(node.label, 20))}</text>`)
    parts.push(`<text x="${(x + 10).toFixed(1)}" y="161" ${labelFont(theme, 6.2)} fill="${theme.colors.muted}">${esc(truncate(node.detail ?? node.value ?? '', 26))}</text>`)
  })
  return `${svgOpen(block.title, nodes.map(n => n.label).join(', '), 230)}${parts.join('')}</svg>`
}
