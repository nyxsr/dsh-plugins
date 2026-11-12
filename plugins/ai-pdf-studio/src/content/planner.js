/**
 * Content architecture helpers.
 *
 * The engine never invents facts. It can structure supplied facts, preserve
 * source text, or transform a supplied draft. Missing content becomes an
 * explicit, labelled placeholder only when the caller opts in.
 */
import { StudioError } from '../core/errors.js'

function blank(value) {
  return value === undefined || value === null || String(value).trim() === ''
}

export function deriveBrief(input, template = null) {
  const outline = Array.isArray(input.outline) ? input.outline : []
  const plan = template?.section_plan ?? []
  return {
    objective: input.purpose ?? input.objective ?? '',
    category: input.category ?? template?.category ?? 'report',
    audience: input.audience ?? template?.default_audience ?? '',
    language: input.language === 'id' ? 'id' : 'en',
    tone: input.tone ?? 'jelas dan profesional',
    content_mode: input.content_mode ?? (input.source_text ? 'transform' : 'generate'),
    required_sections: plan.map(section => section.title),
    supplied_outline: outline.map(section => section.title ?? section.heading ?? ''),
    evidence_gaps: [
      ...(blank(input.purpose) ? ['tujuan belum diberikan'] : []),
      ...(blank(input.audience) ? ['audiens belum diberikan'] : []),
      ...(blank(input.source_text) && outline.length === 0 ? ['teks sumber atau outline belum diberikan'] : []),
    ],
    visual_candidates: inferVisualCandidates(outline, template),
  }
}

export function inferVisualCandidates(outline, template) {
  const candidates = []
  for (const section of outline) {
    const text = `${section.title ?? ''} ${section.purpose ?? ''}`.toLowerCase()
    if (/revenue|growth|trend|performance|kinerja|pertumbuhan/.test(text)) candidates.push({ section: section.title, suggestion: 'line or bar chart' })
    if (/share|segment|composition|distribution|pangsa/.test(text)) candidates.push({ section: section.title, suggestion: 'donut or stacked bar' })
    if (/timeline|roadmap|milestone|jadwal|tahapan/.test(text)) candidates.push({ section: section.title, suggestion: 'timeline' })
    if (/compare|versus|before|after|perbandingan/.test(text)) candidates.push({ section: section.title, suggestion: 'comparison diagram' })
  }
  for (const required of template?.required_blocks ?? []) {
    if (['chart', 'table', 'kpi', 'diagram'].includes(required) && !candidates.some(candidate => candidate.suggestion.includes(required))) {
      candidates.push({ section: 'kebutuhan template', suggestion: required })
    }
  }
  return candidates
}

/** Split supplied prose into sections without rewriting it. */
export function sectionsFromText(sourceText, { language = 'en', defaultTitle = 'Dokumen' } = {}) {
  const text = String(sourceText ?? '').replace(/\r\n?/g, '\n').trim()
  if (!text) throw new StudioError('content_required', 'Mode transform dan preserve butuh source_text.')
  const chunks = text.split(/\n\s*\n/).map(chunk => chunk.trim()).filter(Boolean)
  const sections = []
  let current = { title: defaultTitle, blocks: [] }
  for (const [index, chunk] of chunks.entries()) {
    const lines = chunk.split(/\n/).map(line => line.trim()).filter(Boolean)
    const first = lines[0] ?? ''
    const headingLike = lines.length === 1 && first.length < 90 && !/[.;:,]$/.test(first)
    const numbered = /^\d+(\.\d+)*\s+\S/.test(first)
    if (headingLike || numbered) {
      if (current.blocks.length) sections.push(current)
      current = { title: first.replace(/^\d+(\.\d+)*\s+/, '').slice(0, 240), blocks: [] }
      continue
    }
    if (lines.every(line => /^[•\-*–—]\s+/.test(line))) {
      current.blocks.push({
        type: 'list', id: `source-list-${sections.length + 1}-${current.blocks.length + 1}`,
        items: lines.map(line => ({ text: line.replace(/^[•\-*–—]\s+/, '') })),
      })
    } else {
      current.blocks.push({
        type: 'paragraph', id: `source-p-${sections.length + 1}-${current.blocks.length + 1}`,
        text: lines.join(' '), lead: current.blocks.length === 0,
      })
    }
  }
  if (current.blocks.length) sections.push(current)
  return sections.length ? sections : [{
    title: defaultTitle,
    blocks: [{ type: 'paragraph', id: 'source-p-1-1', text }],
  }]
}

function suppliedBlocks(section, options, sectionIndex) {
  const blocks = []
  if (section.summary) blocks.push({ type: 'paragraph', text: section.summary, lead: true, dropcap: Boolean(options.dropcap) })
  for (const paragraph of section.paragraphs ?? []) blocks.push({ type: 'paragraph', text: paragraph })
  if (section.points?.length) blocks.push({ type: 'list', ordered: Boolean(section.ordered), items: section.points })
  if (section.quote) blocks.push({ type: 'quote', ...section.quote })
  if (section.kpi?.length) blocks.push({ type: 'kpi', items: section.kpi, title: section.kpi_title })
  if (section.chart) blocks.push({ type: 'chart', ...section.chart })
  if (section.table) blocks.push({ type: 'table', ...section.table })
  if (section.callout) blocks.push({ type: 'callout', ...section.callout })
  if (section.timeline?.length) blocks.push({ type: 'timeline', items: section.timeline, title: section.timeline_title })
  if (section.diagram) blocks.push({ type: 'diagram', ...section.diagram })
  if (section.image) blocks.push({ type: 'image', ...section.image })
  return blocks.map((block, index) => ({ ...block, id: block.id ?? `sec-${sectionIndex + 1}-b${String(index + 1).padStart(2, '0')}` }))
}

/**
 * Build a document request from an outline of supplied facts.
 * Missing content is either an error or an explicit labelled placeholder.
 */
export function buildFromOutline(input, template = null) {
  const outline = input.outline ?? template?.section_plan ?? []
  if (!Array.isArray(outline) || outline.length === 0) {
    throw new StudioError('content_required', 'Mode generate butuh outline konten.')
  }
  const allowPlaceholders = Boolean(input.allow_placeholders)
  const sections = outline.map((section, sectionIndex) => {
    const title = section.title ?? section.heading ?? `Bagian ${sectionIndex + 1}`
    const blocks = suppliedBlocks(section, input, sectionIndex)
    if (blocks.length === 0) {
      if (!allowPlaceholders && !input.allow_placeholders) {
        throw new StudioError('content_required', `Section “${title}” has no supplied content. Provide facts/paragraphs or set allow_placeholders.`, {
          details: { section: title, section_index: sectionIndex },
        })
      }
      blocks.push({
        type: 'callout', tone: 'warning', title: input.language === 'id' ? 'Konten diperlukan' : 'Konten diperlukan',
        text: input.language === 'id'
          ? `Bagian “${title}” belum memiliki konten sumber. Placeholder ini harus diganti sebelum rilis.`
          : `Section “${title}” has no source content. Replace this labelled placeholder before release.`,
      })
    }
    const requirements = template?.section_plan?.[sectionIndex]?.blocks ?? []
    for (const required of requirements) {
      if (!blocks.some(block => block.type === required) && required === 'kpi' && section.kpi?.length) {
        blocks.push({ type: 'kpi', items: section.kpi })
      }
    }
    return {
      id: `sec-${sectionIndex + 1}`,
      title: String(title).slice(0, 240),
      kicker: section.kicker ?? '',
      subtitle: section.purpose ?? '',
      blocks,
    }
  })
  return {
    title: input.title ?? template?.name ?? 'Dokumen tanpa judul',
    subtitle: input.subtitle ?? '',
    eyebrow: input.eyebrow ?? '',
    category: input.category ?? template?.category ?? 'report',
    language: input.language === 'id' ? 'id' : 'en',
    audience: input.audience ?? template?.default_audience ?? '',
    purpose: input.purpose ?? template?.default_purpose ?? '',
    tone: input.tone ?? '',
    content_mode: 'generate',
    synthetic: input.synthetic !== false,
    page: input.page ?? { size: template?.page_size ?? 'A4' },
    theme: input.theme ?? { family: template?.theme ?? undefined },
    metadata: input.metadata ?? {},
    cover: input.cover ?? {},
    citations: input.citations ?? [],
    sections,
  }
}

/**
 * Prepare a Document IR request from one of the three content modes.
 * Full IR documents pass through unchanged.
 */
export function prepareContentRequest(input, template = null) {
  if (input.document) return input.document
  if (input.sections?.length) return input
  if (input.source_text) {
    const sections = sectionsFromText(input.source_text, { language: input.language, defaultTitle: input.title ?? 'Dokumen' })
    return {
      ...input,
      content_mode: input.content_mode === 'generate' ? 'transform' : (input.content_mode ?? 'preserve'),
      sections,
    }
  }
  return buildFromOutline(input, template)
}
