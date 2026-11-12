/**
 * Document Intermediate Representation (Document IR).
 *
 * The IR is the single source of truth for content, design intent, layout
 * hints, and quality policy. All renderers consume a validated normalized
 * document; no renderer invents content.
 */
import { createHash } from 'node:crypto'
import { StudioError } from './errors.js'

export const IR_VERSION = '1.0'

export const DOCUMENT_CATEGORIES = Object.freeze([
  'report',
  'proposal',
  'ebook',
  'presentation',
  'brochure',
  'academic',
  'company_profile',
  'catalog',
])

export const DESIGN_FAMILIES = Object.freeze([
  'modern_corporate',
  'premium_editorial',
  'minimalist_clean',
  'creative_bold',
  'technology_futuristic',
  'luxury_elegant',
  'academic_professional',
  'infographic_visual',
])

export const LANGUAGES = Object.freeze(['en', 'id'])

export const PAGE_SIZES = Object.freeze({
  A4: { widthPt: 595.28, heightPt: 841.89, label: 'A4' },
  A5: { widthPt: 419.53, heightPt: 595.28, label: 'A5' },
  Letter: { widthPt: 612, heightPt: 792, label: 'US Letter' },
  Presentation16x9: { widthPt: 960, heightPt: 540, label: '16:9 presentation' },
  Square: { widthPt: 595.28, heightPt: 595.28, label: 'Square' },
})

export const BLOCK_TYPES = Object.freeze([
  'heading', 'paragraph', 'list', 'table', 'image', 'chart', 'diagram',
  'kpi', 'quote', 'callout', 'timeline', 'equation', 'citation',
  'footnote', 'pagebreak', 'sectionbreak',
])

export const CHART_TYPES = Object.freeze([
  'bar', 'line', 'area', 'donut', 'pie', 'scatter', 'horizontal_bar',
  'stacked_bar',
])

export const DIAGRAM_TYPES = Object.freeze([
  'flow', 'cycle', 'layers', 'matrix', 'comparison', 'org',
])

const CATEGORY_ALIASES = new Map([
  ['business_report', 'report'], ['business report', 'report'], ['laporan', 'report'],
  ['business_proposal', 'proposal'], ['strategic_proposal', 'proposal'], ['proposal_bisnis', 'proposal'],
  ['e-book', 'ebook'], ['book', 'ebook'], ['buku', 'ebook'],
  ['deck', 'presentation'], ['investor_deck', 'presentation'], ['presentasi', 'presentation'],
  ['marketing', 'brochure'], ['marketing_brochure', 'brochure'], ['brosur', 'brochure'],
  ['research', 'academic'], ['academic_paper', 'academic'], ['akademik', 'academic'],
  ['company_profile', 'company_profile'], ['company profile', 'company_profile'],
  ['catalog', 'catalog'], ['katalog', 'catalog'],
])

const LANGUAGE_ALIASES = new Map([
  ['en', 'en'], ['english', 'en'], ['inggris', 'en'], ['en-us', 'en'], ['en-gb', 'en'],
  ['id', 'id'], ['indonesian', 'id'], ['indonesia', 'id'], ['bahasa indonesia', 'id'],
])

const CONTENT_MODES = new Set(['generate', 'transform', 'preserve'])
const SEVERITY_ORDER = Object.freeze({ minor: 1, major: 2, critical: 3 })
export { SEVERITY_ORDER }

const DEFAULT_MARGINS = Object.freeze({
  A4: { top: 64, right: 58, bottom: 64, left: 58 },
  A5: { top: 48, right: 42, bottom: 48, left: 42 },
  Letter: { top: 63, right: 60, bottom: 63, left: 60 },
  Presentation16x9: { top: 44, right: 52, bottom: 48, left: 52 },
  Square: { top: 54, right: 54, bottom: 54, left: 54 },
})

const MAX = Object.freeze({
  title: 240,
  subtitle: 360,
  sections: 48,
  blocksPerSection: 120,
  totalBlocks: 800,
  text: 40000,
  tableRows: 500,
  tableColumns: 16,
  listItems: 120,
  chartSeries: 12,
  chartPoints: 400,
  kpiItems: 12,
  citationText: 4000,
})

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/

/** @param {unknown} value */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** @param {unknown} value */
function text(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function limitedText(value, field, max, errors, required = false) {
  const out = text(value)
  if (required && out.length === 0) errors.push(`${field} wajib diisi`)
  if (out.length > max) errors.push(`${field} melebihi ${max} karakter`)
  return out
}

function slug(value) {
  return text(value).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'document'
}

function safeId(value, fallback) {
  const candidate = text(value)
  if (SAFE_ID.test(candidate)) return candidate
  return fallback
}

function normalizeCategory(value, errors) {
  const raw = text(value).toLowerCase()
  const category = CATEGORY_ALIASES.get(raw) ?? raw
  if (!DOCUMENT_CATEGORIES.includes(category)) {
    errors.push(`category harus salah satu dari: ${DOCUMENT_CATEGORIES.join(', ')}`)
    return 'report'
  }
  return category
}

function normalizeLanguage(value, errors) {
  const raw = text(value || 'en').toLowerCase()
  const language = LANGUAGE_ALIASES.get(raw) ?? raw
  if (!LANGUAGES.includes(language)) {
    errors.push(`language harus "en" atau "id"`)
    return 'en'
  }
  return language
}

function normalizePage(input, category, errors) {
  const page = isObject(input) ? input : {}
  let sizeKey = text(page.size || (category === 'presentation' ? 'Presentation16x9' : 'A4'))
  if (!PAGE_SIZES[sizeKey]) {
    const found = Object.keys(PAGE_SIZES).find(key => key.toLowerCase() === sizeKey.toLowerCase())
    if (!found) {
      errors.push(`page.size harus salah satu dari: ${Object.keys(PAGE_SIZES).join(', ')}`)
      sizeKey = 'A4'
    } else {
      sizeKey = found
    }
  }
  const base = PAGE_SIZES[sizeKey]
  let widthPt = Number(page.width_pt ?? base.widthPt)
  let heightPt = Number(page.height_pt ?? base.heightPt)
  if (!Number.isFinite(widthPt) || widthPt < 180 || widthPt > 3000) {
    errors.push('page.width_pt harus di antara 180 dan 3000')
    widthPt = base.widthPt
  }
  if (!Number.isFinite(heightPt) || heightPt < 180 || heightPt > 3000) {
    errors.push('page.height_pt harus di antara 180 dan 3000')
    heightPt = base.heightPt
  }
  const orientation = text(page.orientation || 'auto').toLowerCase()
  if (orientation === 'landscape' && heightPt > widthPt) [widthPt, heightPt] = [heightPt, widthPt]
  if (orientation === 'portrait' && widthPt > heightPt) [widthPt, heightPt] = [heightPt, widthPt]
  const defaults = DEFAULT_MARGINS[sizeKey] ?? DEFAULT_MARGINS.A4
  const inputMargins = isObject(page.margins) ? page.margins : {}
  const margins = {}
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const n = Number(inputMargins[side] ?? defaults[side])
    if (!Number.isFinite(n) || n < 12 || n > Math.min(widthPt, heightPt) * 0.25) {
      errors.push(`page.margins.${side} di luar rentang yang didukung`)
      margins[side] = defaults[side]
    } else {
      margins[side] = n
    }
  }
  return {
    size: sizeKey,
    width_pt: widthPt,
    height_pt: heightPt,
    orientation: widthPt > heightPt ? 'landscape' : 'portrait',
    margins,
  }
}

function normalizeTheme(input, errors) {
  if (!isObject(input)) return { family: null, variant: 'default', tokens: {} }
  let family = input.family ? text(input.family).toLowerCase().replace(/[\s-]+/g, '_') : null
  if (family && !DESIGN_FAMILIES.includes(family)) {
    errors.push(`theme.family harus salah satu dari: ${DESIGN_FAMILIES.join(', ')}`)
    family = null
  }
  return {
    family,
    variant: text(input.variant || 'default').toLowerCase() || 'default',
    tokens: isObject(input.tokens) ? structuredClone(input.tokens) : {},
  }
}

function normalizeBrand(input, errors) {
  if (!isObject(input)) return null
  const colors = isObject(input.colors) ? input.colors : {}
  const safeColors = {}
  for (const key of ['primary', 'secondary', 'accent', 'background', 'text']) {
    const value = text(colors[key])
    if (value && !/^#[0-9a-fA-F]{6}$/.test(value)) errors.push(`brand.colors.${key} harus warna hex 6 digit`)
    if (/^#[0-9a-fA-F]{6}$/.test(value)) safeColors[key] = value.toUpperCase()
  }
  return {
    organization: text(input.organization),
    logo_path: input.logo_path ? text(input.logo_path) : null,
    colors: safeColors,
    fonts: isObject(input.fonts) ? {
      heading: text(input.fonts.heading),
      body: text(input.fonts.body),
    } : {},
    watermark: text(input.watermark),
    contact: text(input.contact),
    website: text(input.website),
    restrictions: Array.isArray(input.restrictions) ? input.restrictions.map(v => text(v)).filter(Boolean).slice(0, 20) : [],
    reference_style: text(input.reference_style),
  }
}

function normalizeKpiItem(item, field, errors) {
  if (!isObject(item)) {
    errors.push(`${field} harus berupa objek`)
    return { label: 'Metrik', value: '-' }
  }
  return {
    label: limitedText(item.label, `${field}.label`, 80, errors, true),
    value: limitedText(item.value, `${field}.value`, 40, errors, true),
    unit: limitedText(item.unit, `${field}.unit`, 20, errors),
    delta: limitedText(item.delta, `${field}.delta`, 40, errors),
    note: limitedText(item.note, `${field}.note`, 180, errors),
    tone: ['positive', 'negative', 'neutral', 'accent'].includes(text(item.tone)) ? text(item.tone) : 'neutral',
  }
}

function validateSeries(series, field, errors) {
  if (!Array.isArray(series) || series.length === 0) {
    errors.push(`${field}.series harus larik yang tidak kosong`)
    return []
  }
  return series.slice(0, MAX.chartSeries).map((entry, index) => {
    if (!isObject(entry)) {
      errors.push(`${field}.series[${index}] harus berupa objek`)
      return { name: `Series ${index + 1}`, values: [] }
    }
    const values = Array.isArray(entry.values) ? entry.values.map(Number) : []
    if (values.length === 0 || values.some(n => !Number.isFinite(n))) {
      errors.push(`${field}.series[${index}].values harus berisi angka yang valid`)
    }
    if (values.length > MAX.chartPoints) errors.push(`${field}.series[${index}] punya terlalu banyak titik`)
    return {
      name: limitedText(entry.name, `${field}.series[${index}].name`, 80, errors, true),
      values: values.slice(0, MAX.chartPoints),
      color: entry.color ? text(entry.color) : undefined,
    }
  })
}

function normalizeChartData(data, chartType, field, errors) {
  const input = isObject(data) ? data : {}
  const output = { ...structuredClone(input) }
  if (chartType === 'scatter') {
    const points = Array.isArray(input.points) ? input.points : []
    if (points.length < 2) errors.push(`${field}.data.points butuh minimal dua titik`)
    output.points = points.slice(0, MAX.chartPoints).map((point, index) => {
      const x = Number(point?.x)
      const y = Number(point?.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) errors.push(`${field}.data.points[${index}] butuh angka x dan y`)
      return { x, y, label: text(point?.label) }
    })
    return output
  }
  if (chartType === 'pie' || chartType === 'donut') {
    const items = Array.isArray(input.items) ? input.items : []
    if (items.length < 2) errors.push(`${field}.data.items butuh minimal dua item`)
    if (items.length > 12) errors.push(`${field}.data.items mendukung paling banyak 12 item`)
    output.items = items.slice(0, 12).map((item, index) => {
      const value = Number(item?.value)
      if (!Number.isFinite(value) || value < 0) errors.push(`${field}.data.items[${index}].value harus angka nol atau lebih`)
      return {
        label: limitedText(item?.label, `${field}.data.items[${index}].label`, 80, errors, true),
        value,
        color: item?.color ? text(item.color) : undefined,
      }
    })
    if (output.items.reduce((sum, item) => sum + (Number.isFinite(item.value) ? item.value : 0), 0) <= 0) {
      errors.push(`${field}.data.items harus berjumlah positif`)
    }
    return output
  }
  const categories = Array.isArray(input.categories) ? input.categories.map(v => text(v)) : []
  if (categories.length < 2) errors.push(`${field}.data.categories butuh minimal dua kategori`)
  if (categories.length > MAX.chartPoints) errors.push(`${field}.data.categories punya terlalu banyak entri`)
  output.categories = categories.slice(0, MAX.chartPoints)
  output.series = validateSeries(input.series, field, errors)
  for (const [index, series] of output.series.entries()) {
    if (series.values.length !== output.categories.length) {
      errors.push(`${field}.data.series[${index}] punya ${series.values.length} nilai untuk ${output.categories.length} kategori`)
    }
  }
  if (chartType === 'stacked_bar') {
    const totals = output.categories.map((_, i) => output.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
    if (totals.some(total => total < 0)) errors.push(`${field}.data nilai bertumpuk tidak boleh menghasilkan total negatif`)
  }
  return output
}

function normalizeBlock(input, field, errors) {
  if (!isObject(input)) {
    errors.push(`${field} harus berupa objek`)
    return { type: 'paragraph', text: '' }
  }
  const type = text(input.type).toLowerCase()
  if (!BLOCK_TYPES.includes(type)) {
    errors.push(`${field}.type harus salah satu dari: ${BLOCK_TYPES.join(', ')}`)
    return { type: 'paragraph', text: '' }
  }
  const block = { ...structuredClone(input), type }
  switch (type) {
    case 'heading':
      block.level = Math.min(4, Math.max(1, Number(input.level) || 2))
      block.text = limitedText(input.text, `${field}.text`, 300, errors, true)
      block.kicker = limitedText(input.kicker, `${field}.kicker`, 80, errors)
      break
    case 'paragraph':
      block.text = limitedText(input.text, `${field}.text`, MAX.text, errors, true)
      block.lead = Boolean(input.lead)
      block.dropcap = Boolean(input.dropcap)
      break
    case 'list':
      block.ordered = Boolean(input.ordered)
      block.items = (Array.isArray(input.items) ? input.items : []).slice(0, MAX.listItems).map((item, index) => {
        if (isObject(item)) {
          return {
            title: limitedText(item.title, `${field}.items[${index}].title`, 160, errors),
            text: limitedText(item.text, `${field}.items[${index}].text`, 3000, errors),
          }
        }
        return { title: '', text: limitedText(item, `${field}.items[${index}]`, 3000, errors, true) }
      })
      if (block.items.length === 0) errors.push(`${field}.items tidak boleh kosong`)
      break
    case 'table': {
      const columns = Array.isArray(input.columns) ? input.columns : []
      block.columns = columns.slice(0, MAX.tableColumns).map((column, index) => {
        if (!isObject(column)) {
          errors.push(`${field}.columns[${index}] harus berupa objek`)
          return { key: `col${index}`, label: `Column ${index + 1}` }
        }
        const key = text(column.key || `col${index}`).replace(/[^A-Za-z0-9_]/g, '_')
        return {
          key,
          label: limitedText(column.label ?? key, `${field}.columns[${index}].label`, 120, errors, true),
          align: ['left', 'center', 'right'].includes(text(column.align)) ? text(column.align) : 'left',
          width: Math.min(60, Math.max(5, Number(column.width) || 0)) || undefined,
        }
      })
      if (block.columns.length === 0) errors.push(`${field}.columns tidak boleh kosong`)
      const rows = Array.isArray(input.rows) ? input.rows : []
      if (rows.length > MAX.tableRows) errors.push(`${field}.rows melebihi ${MAX.tableRows}`)
      block.rows = rows.slice(0, MAX.tableRows).map((row, index) => {
        if (!isObject(row)) {
          errors.push(`${field}.rows[${index}] harus berupa objek`)
          return {}
        }
        const clean = {}
        for (const column of block.columns) {
          clean[column.key] = limitedText(row[column.key], `${field}.rows[${index}].${column.key}`, 800, errors)
        }
        return clean
      })
      block.title = limitedText(input.title, `${field}.title`, 180, errors)
      block.caption = limitedText(input.caption, `${field}.caption`, 400, errors)
      block.compact = Boolean(input.compact)
      break
    }
    case 'image':
      block.src = limitedText(input.src, `${field}.src`, 1200, errors, true)
      block.alt = limitedText(input.alt, `${field}.alt`, 400, errors, true)
      block.caption = limitedText(input.caption, `${field}.caption`, 400, errors)
      block.variant = ['standard', 'full', 'portrait', 'logo'].includes(text(input.variant)) ? text(input.variant) : 'standard'
      block.fit = ['contain', 'cover'].includes(text(input.fit)) ? text(input.fit) : 'contain'
      break
    case 'chart': {
      const chartType = text(input.chart_type).toLowerCase().replace(/[\s-]+/g, '_')
      if (!CHART_TYPES.includes(chartType)) {
        errors.push(`${field}.chart_type harus salah satu dari: ${CHART_TYPES.join(', ')}`)
        block.chart_type = 'bar'
      } else {
        block.chart_type = chartType
      }
      block.title = limitedText(input.title, `${field}.title`, 180, errors, true)
      block.subtitle = limitedText(input.subtitle, `${field}.subtitle`, 260, errors)
      block.data = normalizeChartData(input.data, block.chart_type, field, errors)
      block.caption = limitedText(input.caption, `${field}.caption`, 400, errors)
      block.options = isObject(input.options) ? structuredClone(input.options) : {}
      break
    }
    case 'diagram':
      block.diagram_type = DIAGRAM_TYPES.includes(text(input.diagram_type)) ? text(input.diagram_type) : 'flow'
      block.title = limitedText(input.title, `${field}.title`, 180, errors, true)
      block.nodes = (Array.isArray(input.nodes) ? input.nodes : []).slice(0, 24).map((node, index) => ({
        id: safeId(node?.id, `n${index + 1}`),
        label: limitedText(node?.label, `${field}.nodes[${index}].label`, 80, errors, true),
        detail: limitedText(node?.detail, `${field}.nodes[${index}].detail`, 160, errors),
        value: text(node?.value).slice(0, 30),
      }))
      if (block.nodes.length < 2) errors.push(`${field}.nodes butuh minimal dua node`)
      block.edges = (Array.isArray(input.edges) ? input.edges : []).slice(0, 32).map((edge, index) => ({
        from: text(edge?.from),
        to: text(edge?.to),
        label: limitedText(edge?.label, `${field}.edges[${index}].label`, 40, errors),
      }))
      block.caption = limitedText(input.caption, `${field}.caption`, 400, errors)
      break
    case 'kpi':
      block.title = limitedText(input.title, `${field}.title`, 180, errors)
      block.items = (Array.isArray(input.items) ? input.items : []).slice(0, MAX.kpiItems)
        .map((item, index) => normalizeKpiItem(item, `${field}.items[${index}]`, errors))
      if (block.items.length === 0) errors.push(`${field}.items tidak boleh kosong`)
      break
    case 'quote':
      block.text = limitedText(input.text, `${field}.text`, 2000, errors, true)
      block.attribution = limitedText(input.attribution, `${field}.attribution`, 160, errors)
      block.role = limitedText(input.role, `${field}.role`, 160, errors)
      break
    case 'callout':
      block.title = limitedText(input.title, `${field}.title`, 160, errors)
      block.text = limitedText(input.text, `${field}.text`, 4000, errors, true)
      block.tone = ['info', 'warning', 'success', 'accent'].includes(text(input.tone)) ? text(input.tone) : 'info'
      break
    case 'timeline':
      block.title = limitedText(input.title, `${field}.title`, 180, errors)
      block.items = (Array.isArray(input.items) ? input.items : []).slice(0, 20).map((item, index) => ({
        date: limitedText(item?.date, `${field}.items[${index}].date`, 40, errors, true),
        title: limitedText(item?.title, `${field}.items[${index}].title`, 120, errors, true),
        text: limitedText(item?.text, `${field}.items[${index}].text`, 600, errors),
      }))
      if (block.items.length === 0) errors.push(`${field}.items tidak boleh kosong`)
      break
    case 'equation':
      block.plain = limitedText(input.plain ?? input.text, `${field}.plain`, 1200, errors, true)
      block.caption = limitedText(input.caption, `${field}.caption`, 300, errors)
      block.latex = limitedText(input.latex, `${field}.latex`, 1200, errors)
      break
    case 'citation':
      block.text = limitedText(input.text, `${field}.text`, MAX.citationText, errors, true)
      block.source = limitedText(input.source, `${field}.source`, 300, errors)
      block.url = limitedText(input.url, `${field}.url`, 1200, errors)
      block.accessed = limitedText(input.accessed, `${field}.accessed`, 40, errors)
      break
    case 'footnote':
      block.marker = limitedText(input.marker, `${field}.marker`, 8, errors)
      block.text = limitedText(input.text, `${field}.text`, 2000, errors, true)
      break
    case 'sectionbreak':
      block.title = limitedText(input.title, `${field}.title`, 240, errors)
      block.subtitle = limitedText(input.subtitle, `${field}.subtitle`, 360, errors)
      block.variant = text(input.variant || 'solid')
      break
    case 'pagebreak':
      break
    default:
      break
  }
  return block
}

function normalizeSections(input, errors) {
  const sections = Array.isArray(input) ? input : []
  if (sections.length === 0) errors.push('sections harus berisi minimal satu bagian')
  if (sections.length > MAX.sections) errors.push(`sections melebihi ${MAX.sections}`)
  let totalBlocks = 0
  return sections.slice(0, MAX.sections).map((section, sectionIndex) => {
    if (!isObject(section)) {
      errors.push(`sections[${sectionIndex}] harus berupa objek`)
      return { id: `sec-${sectionIndex + 1}`, title: '', blocks: [] }
    }
    const blocks = Array.isArray(section.blocks) ? section.blocks : []
    if (blocks.length > MAX.blocksPerSection) errors.push(`sections[${sectionIndex}].blocks melebihi ${MAX.blocksPerSection}`)
    totalBlocks += blocks.length
    const normalizedBlocks = blocks.slice(0, MAX.blocksPerSection).map((block, blockIndex) =>
      normalizeBlock(block, `sections[${sectionIndex}].blocks[${blockIndex}]`, errors))
    if (normalizedBlocks.length === 0 && !section.divider) errors.push(`sections[${sectionIndex}].blocks tidak boleh kosong`)
    return {
      id: safeId(section.id, `sec-${sectionIndex + 1}`),
      number: text(section.number).slice(0, 12),
      title: limitedText(section.title, `sections[${sectionIndex}].title`, 300, errors, !section.divider),
      subtitle: limitedText(section.subtitle, `sections[${sectionIndex}].subtitle`, 600, errors),
      kicker: limitedText(section.kicker, `sections[${sectionIndex}].kicker`, 80, errors),
      divider: Boolean(section.divider),
      page_break_before: section.page_break_before !== false,
      full_page: Boolean(section.full_page),
      layout: ['standard', 'two_column', 'sidebar', 'wide'].includes(text(section.layout)) ? text(section.layout) : 'standard',
      blocks: normalizedBlocks,
      component_ids: normalizedBlocks.map(block => block.id).filter(Boolean),
    }
  }).filter(Boolean).map((section, index, all) => {
    if (totalBlocks > MAX.totalBlocks) errors.push(`dokumen melebihi ${MAX.totalBlocks} blok total`)
    return section
  })
}

function assignIds(sections) {
  const seen = new Set()
  sections.forEach((section, sectionIndex) => {
    if (!section.id) section.id = `sec-${sectionIndex + 1}`
    let unique = section.id
    let suffix = 2
    while (seen.has(unique)) unique = `${section.id}-${suffix++}`
    section.id = unique
    seen.add(unique)
    section.blocks.forEach((block, blockIndex) => {
      if (!block.id) block.id = `${section.id}-b${String(blockIndex + 1).padStart(2, '0')}`
      block.id = safeId(block.id, `${section.id}-b${blockIndex + 1}`)
      unique = block.id
      suffix = 2
      while (seen.has(unique)) unique = `${block.id}-${suffix++}`
      block.id = unique
      seen.add(unique)
    })
    section.component_ids = section.blocks.map(block => block.id)
  })
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') {
    const clean = value.trim()
    if (clean) output.push(clean)
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, output)
  }
  return output
}

function dedupeCitations(input) {
  const list = Array.isArray(input) ? input : []
  const seen = new Set()
  return list.slice(0, 100).map((citation, index) => {
    if (!isObject(citation)) return null
    const textValue = text(citation.text || citation.title)
    if (!textValue) return null
    const key = textValue.toLowerCase()
    if (seen.has(key)) return null
    seen.add(key)
    return {
      id: safeId(citation.id, `cite-${index + 1}`),
      text: textValue.slice(0, MAX.citationText),
      source: text(citation.source).slice(0, 300),
      url: text(citation.url).slice(0, 1200),
      accessed: text(citation.accessed).slice(0, 40),
    }
  }).filter(Boolean)
}

/**
 * Validate and normalize a document request.
 *
 * @param {object} input raw document specification
 * @param {{allowWarnings?: boolean}} [options]
 * @returns {{document: object, errors: string[], warnings: string[]}}
 */
export function validateDocument(input, options = {}) {
  const errors = []
  const warnings = []
  if (!isObject(input)) {
    return { document: null, errors: ['document harus berupa objek'], warnings }
  }
  const title = limitedText(input.title, 'title', MAX.title, errors, true)
  const subtitle = limitedText(input.subtitle, 'subtitle', MAX.subtitle, errors)
  const category = normalizeCategory(input.category ?? input.document_type, errors)
  const language = normalizeLanguage(input.language, errors)
  const page = normalizePage(input.page, category, errors)
  const theme = normalizeTheme(input.theme, errors)
  const brand = normalizeBrand(input.brand, errors)
  const sections = normalizeSections(input.sections, errors)
  assignIds(sections)
  const contentMode = CONTENT_MODES.has(text(input.content_mode)) ? text(input.content_mode) : 'preserve'
  const citations = dedupeCitations(input.citations)
  const metadata = isObject(input.metadata) ? structuredClone(input.metadata) : {}
  const qualityInput = isObject(input.quality) ? input.quality : {}
  const targetScore = Number(qualityInput.target_score ?? 90)
  if (!Number.isFinite(targetScore) || targetScore < 50 || targetScore > 100) errors.push('quality.target_score harus di antara 50 dan 100')
  const maxRepairs = Number(qualityInput.max_repair_iterations ?? 3)
  if (!Number.isInteger(maxRepairs) || maxRepairs < 0 || maxRepairs > 3) errors.push('quality.max_repair_iterations harus bilangan bulat 0 sampai 3')
  if (!['page', 'flow'].includes(text(input.layout?.section_start))) {
    // A missing value is valid; an explicitly unknown value is not.
    if (input.layout?.section_start !== undefined) errors.push('layout.section_start harus "page" atau "flow"')
  }
  const synthetic = input.synthetic !== false
  if (synthetic) warnings.push('Dokumen ini ditandai sebagai konten sintetis atau demonstrasi. Jangan menyajikannya sebagai fakta.')
  if (!subtitle) warnings.push('Subjudul belum diisi, jadi sampul akan memakai perlakuan tipografi tanpa subjudul.')
  if (!metadata.author) warnings.push('Tidak ada penulis di metadata.')
  if (!isObject(input.brand) && input.brand !== undefined) warnings.push('brand harus berupa objek, jadi nilainya diabaikan.')
  const document = {
    ir_version: IR_VERSION,
    document_id: safeId(input.document_id, `doc-${slug(title)}-${createHash('sha1').update(JSON.stringify(input)).digest('hex').slice(0, 8)}`),
    document_version: Number(input.document_version) || 1,
    title,
    subtitle,
    eyebrow: limitedText(input.eyebrow, 'eyebrow', 100, errors),
    category,
    language,
    audience: limitedText(input.audience, 'audience', 300, errors),
    purpose: limitedText(input.purpose, 'purpose', 500, errors),
    tone: limitedText(input.tone, 'tone', 120, errors),
    content_mode: contentMode,
    synthetic,
    page,
    theme,
    brand,
    reference: isObject(input.reference) ? {
      fidelity: ['inspired', 'brand_matched', 'layout_guided'].includes(text(input.reference.fidelity)) ? text(input.reference.fidelity) : 'inspired',
      profile: isObject(input.reference.profile) ? structuredClone(input.reference.profile) : null,
      source: text(input.reference.source),
    } : null,
    cover: isObject(input.cover) ? structuredClone(input.cover) : {},
    sections,
    citations,
    assets: Array.isArray(input.assets) ? input.assets.slice(0, 80).map(asset => structuredClone(asset)) : [],
    metadata: {
      author: text(metadata.author),
      organization: text(metadata.organization),
      subject: text(metadata.subject || title),
      keywords: Array.isArray(metadata.keywords) ? metadata.keywords.map(v => text(v)).filter(Boolean).slice(0, 30) : [],
      created_at: text(metadata.created_at || new Date().toISOString()),
      locale: text(metadata.locale || (language === 'id' ? 'id-ID' : 'en-US')),
      ...structuredClone(metadata),
    },
    layout: {
      section_start: text(input.layout?.section_start || 'page'),
      density: ['compact', 'comfortable', 'generous'].includes(text(input.layout?.density)) ? text(input.layout?.density) : 'comfortable',
      header: input.layout?.header !== false,
      footer: input.layout?.footer !== false,
      repair_hints: isObject(input.layout?.repair_hints) ? structuredClone(input.layout.repair_hints) : {},
    },
    quality: {
      target_score: Number.isFinite(targetScore) ? targetScore : 90,
      max_repair_iterations: Number.isInteger(maxRepairs) ? maxRepairs : 3,
      visual_review: isObject(qualityInput.visual_review) ? structuredClone(qualityInput.visual_review) : null,
      gates: isObject(qualityInput.gates) ? structuredClone(qualityInput.gates) : {},
    },
  }
  if (sections.length === 0) warnings.push('Dokumen tidak punya bagian yang bisa dipakai.')
  return { document, errors, warnings }
}

/**
 * Validate strictly; throw a structured error on failure.
 * @param {object} input
 * @returns {{document: object, warnings: string[]}}
 */
export function requireValidDocument(input) {
  const result = validateDocument(input)
  if (result.errors.length > 0) {
    throw new StudioError('invalid_document', 'Validasi Document IR gagal.', {
      status: 'invalid',
      details: { errors: result.errors, warnings: result.warnings },
    })
  }
  return { document: result.document, warnings: result.warnings }
}

export function findSection(document, sectionId) {
  return document.sections.find(section => section.id === sectionId)
}

export function findBlock(document, blockId) {
  for (const section of document.sections) {
    const block = section.blocks.find(candidate => candidate.id === blockId)
    if (block) return { section, block }
  }
  return undefined
}

export function totalWordCount(document) {
  return collectStrings(document.sections).join(' ').split(/\s+/).filter(Boolean).length
}

/** Fragments used for deterministic content-completeness checks. */
export function expectedFragments(document) {
  const fragments = []
  const add = (value, componentId, kind) => {
    const clean = text(value).replace(/\s+/g, ' ')
    if (clean.length >= 3) fragments.push({ text: clean.slice(0, 90), component_id: componentId, kind })
  }
  for (const section of document.sections) {
    if (section.title) add(section.title, section.id, 'section-title')
    for (const block of section.blocks) {
      if (block.type === 'heading') add(block.text, block.id, 'heading')
      if (block.type === 'paragraph') {
        // A floated drop cap is extracted out of reading order by some PDF
        // text extractors. Check the remainder, which is the complete body of
        // the paragraph; the rendered drop cap is verified visually instead.
        if (block.dropcap && block.text.length > 2) add(block.text.slice(1), block.id, 'paragraph-dropcap-tail')
        else add(block.text, block.id, 'paragraph')
      }
      if (block.type === 'kpi') for (const item of block.items) { add(item.label, block.id, 'kpi-label'); add(item.value, block.id, 'kpi-value') }
      if (block.type === 'table') {
        if (block.title) add(block.title, block.id, 'table-title')
        for (const column of block.columns) add(column.label, block.id, 'table-column')
        if (block.rows.length > 0) for (const column of block.columns.slice(0, 4)) add(block.rows[0][column.key], block.id, 'table-cell')
        if (block.rows.length > 1) for (const column of block.columns.slice(0, 4)) add(block.rows.at(-1)[column.key], block.id, 'table-cell')
      }
      if (block.type === 'chart') {
        add(block.title, block.id, 'chart-title')
        for (const category of (block.data?.categories ?? []).slice(0, 4)) add(category, block.id, 'chart-category')
      }
      if (block.type === 'quote') add(block.text, block.id, 'quote')
      if (block.type === 'callout') add(block.text, block.id, 'callout')
      if (block.type === 'timeline') for (const item of block.items) add(item.title, block.id, 'timeline-title')
      if (block.type === 'equation') add(block.plain, block.id, 'equation')
      if (block.type === 'citation') add(block.text, block.id, 'citation')
      if (block.type === 'footnote') add(block.text, block.id, 'footnote')
    }
  }
  for (const citation of document.citations ?? []) add(citation.text, citation.id, 'citation')
  return fragments
}

/** Flatten visible text for editorial checks. */
export function documentText(document) {
  return collectStrings(document.sections).join('\n').replace(/\s+/g, ' ').trim()
}

export function summarizeDocument(document) {
  const counts = Object.fromEntries(BLOCK_TYPES.map(type => [type, 0]))
  for (const section of document.sections) for (const block of section.blocks) counts[block.type] = (counts[block.type] ?? 0) + 1
  return {
    document_id: document.document_id,
    title: document.title,
    category: document.category,
    language: document.language,
    page_size: document.page.size,
    sections: document.sections.length,
    blocks: Object.values(counts).reduce((sum, n) => sum + n, 0),
    block_counts: counts,
    words: totalWordCount(document),
    theme: document.theme.family,
    synthetic: document.synthetic,
  }
}

/** Create a shallow copy suitable for a repair iteration. */
export function forkDocument(document) {
  return structuredClone(document)
}
