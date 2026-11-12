/**
 * Semantic HTML component renderer.
 *
 * All document text is escaped. Only validated, local images can enter the
 * HTML, and every block carries a stable data-component-id for tracing visual
 * defects back to the IR.
 */
import { renderChart, renderDiagram } from '../visuals/charts.js'
import { resolveAsset } from '../visuals/assets.js'
import { StudioError } from '../core/errors.js'

const CATEGORY_LABELS = {
  report: ['Business report', 'Laporan bisnis'],
  proposal: ['Strategic proposal', 'Proposal strategis'],
  ebook: ['Learning edition', 'Edisi pembelajaran'],
  presentation: ['Investor presentation', 'Presentasi investor'],
  brochure: ['Product brochure', 'Brosur produk'],
  academic: ['Research paper', 'Makalah riset'],
  company_profile: ['Company profile', 'Profil perusahaan'],
  catalog: ['Product catalogue', 'Katalog produk'],
}

const CATEGORY_INDEX = {
  report: '01', proposal: '02', ebook: '03', presentation: '04',
  brochure: '05', academic: '06', company_profile: '07', catalog: '08',
}

const UI = {
  en: {
    preparedFor: 'Prepared for', date: 'Date', synthetic: 'Synthetic demonstration',
    confidential: 'Internal / demonstration', contents: 'Contents', references: 'References',
    syntheticNote: 'Dokumen demonstrasi · data sintetis · bukan klaim fakta',
    draft: 'Draft', page: 'Page',
  },
  id: {
    preparedFor: 'Disiapkan untuk', date: 'Tanggal', synthetic: 'Demonstrasi sintetis',
    confidential: 'Internal / demonstrasi', contents: 'Daftar isi', references: 'Referensi',
    syntheticNote: 'Dokumen demonstrasi · data sintetis · bukan klaim faktual',
    draft: 'Draf', page: 'Halaman',
  },
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br>')
}

function locale(document) {
  return document.language === 'id' ? 'id-ID' : 'en-US'
}

function ui(document) {
  return UI[document.language] ?? UI.en
}

function categoryLabel(document) {
  return (CATEGORY_LABELS[document.category] ?? CATEGORY_LABELS.report)[document.language === 'id' ? 1 : 0]
}

export function formatDate(document) {
  const raw = document.metadata?.date || document.metadata?.created_at
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return String(raw)
  return new Intl.DateTimeFormat(locale(document), { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function initials(value) {
  return String(value ?? 'AI PDF Studio').split(/\s+/).filter(Boolean).slice(0, 3).map(word => word[0]).join('').toUpperCase()
}

function coverStats(document) {
  if (Array.isArray(document.cover?.stats) && document.cover.stats.length) {
    return document.cover.stats.slice(0, 3).map(item => ({
      value: String(item.value ?? ''), label: String(item.label ?? ''),
    }))
  }
  const stats = []
  for (const section of document.sections) {
    for (const block of section.blocks) {
      if (block.type === 'kpi') {
        for (const item of block.items) {
          stats.push({ value: `${item.value}${item.unit ? ` ${item.unit}` : ''}`, label: item.label })
          if (stats.length === 3) return stats
        }
      }
    }
  }
  return stats
}

function coverMeta(document) {
  const t = ui(document)
  const org = document.metadata?.organization || document.brand?.organization || ''
  return {
    org,
    preparedFor: document.audience || document.cover?.prepared_for || '-',
    date: formatDate(document) || '-',
    status: document.synthetic ? t.synthetic : (document.cover?.status || t.confidential),
  }
}

/**
 * Render a cover as a standalone HTML document (no header/footer).
 */
export async function renderCover(document, theme, design, options = {}) {
  const variant = document.cover?.kind || theme.layout.cover
  const t = ui(document)
  const meta = coverMeta(document)
  const stats = coverStats(document)
  const brand = document.brand
  let logo = ''
  if (brand?.logo_path) {
    const asset = await resolveAsset(brand.logo_path, options)
    logo = `<img src="${asset.src}" alt="${escapeAttr(brand.organization || 'Organization logo')}">`
  }
  const org = brand?.organization || meta.org
  const index = document.cover?.index || CATEGORY_INDEX[document.category] || '01'
  const category = categoryLabel(document)
  const eyebrow = document.eyebrow || (document.metadata?.organization || org) || category
  const statsHtml = stats.length
    ? `<div class="cover-stats">${stats.map(item => `<div class="cover-stat"><div class="cover-stat-value">${escapeHtml(item.value)}</div><div class="cover-stat-label">${escapeHtml(item.label)}</div></div>`).join('')}</div>`
    : ''
  const art = `
    <div class="cover-art" aria-hidden="true">
      <div class="cover-grid"></div>
      <div class="cover-orbit"></div>
      <div class="cover-band"></div>
      <div class="cover-rule"></div>
      <div class="cover-dot"></div>
      <div class="cover-index">${escapeHtml(index)}</div>
      <div class="cover-monogram">${escapeHtml(initials(org || document.title))}</div>
      <div class="cover-art-label">${escapeHtml(category)}</div>
    </div>`
  const cover = `<section class="cover cover--${escapeAttr(variant)}" role="img" aria-label="${document.language === 'id' ? 'Sampul' : 'Cover'}: ${escapeAttr(document.title)}">
    ${art}
    <div class="cover-top">
      <div class="cover-brand">${logo || `<span class="cover-brand-mark">${escapeHtml(initials(org || document.title))}</span>`}<span>${escapeHtml(org || 'AI PDF Studio')}</span></div>
      <div class="cover-eyebrow">${escapeHtml(eyebrow)}</div>
    </div>
    <div class="cover-main">
      <div class="cover-kicker">${escapeHtml(document.cover?.kicker || category)}</div>
      <h1 class="cover-title">${nl2br(document.title)}</h1>
      ${document.subtitle ? `<p class="cover-subtitle">${nl2br(document.subtitle)}</p>` : ''}
      ${statsHtml}
    </div>
    <div class="cover-meta">
      <div>${escapeHtml(t.preparedFor)}<strong>${escapeHtml(meta.preparedFor)}</strong></div>
      <div>${escapeHtml(t.date)}<strong>${escapeHtml(meta.date)}</strong></div>
      <div>${escapeHtml(meta.status)}<strong>${escapeHtml(org || 'AI PDF Studio')}</strong></div>
    </div>
  </section>`
  return pageHtml(document, theme, design, cover, options, { cover: true })
}

function tableHtml(block, theme) {
  const columns = block.columns ?? []
  const widthTotal = columns.reduce((sum, column) => sum + (column.width || 0), 0)
  const colgroup = columns.some(column => column.width)
    ? `<colgroup>${columns.map(column => `<col style="width:${widthTotal ? ((column.width || 10) / widthTotal * 100).toFixed(2) : (100 / columns.length).toFixed(2)}%">`).join('')}</colgroup>`
    : ''
  const head = `<thead><tr>${columns.map(column => `<th scope="col" class="${column.align === 'right' ? 'num' : column.align === 'center' ? 'center' : ''}">${escapeHtml(column.label)}</th>`).join('')}</tr></thead>`
  const body = `<tbody>${block.rows.map(row => `<tr>${columns.map(column => {
    const align = column.align === 'right' ? 'num' : column.align === 'center' ? 'center' : ''
    return `<td class="${align}">${nl2br(row[column.key] ?? '')}</td>`
  }).join('')}</tr>`).join('')}</tbody>`
  return `<figure class="table-figure" data-component-id="${escapeAttr(block.id)}">
    ${block.title ? `<div class="table-title">${escapeHtml(block.title)}</div>` : ''}
    <div class="table-scroll"><table class="table ${block.compact ? 'table--compact' : ''}">${colgroup}${head}${body}</table></div>
    ${block.caption ? `<figcaption class="table-caption">${escapeHtml(block.caption)}</figcaption>` : ''}
  </figure>`
}

function chartHtml(block, theme) {
  const svg = renderChart(block, theme)
  return `<figure class="figure chart-figure" data-component-id="${escapeAttr(block.id)}">
    <div class="chart-head">
      <div class="chart-title">${escapeHtml(block.title)}</div>
      ${block.subtitle ? `<div class="chart-subtitle">${escapeHtml(block.subtitle)}</div>` : ''}
    </div>
    ${svg}
    ${block.caption ? `<figcaption class="chart-caption">${escapeHtml(block.caption)}</figcaption>` : ''}
  </figure>`
}

function diagramHtml(block, theme) {
  const svg = renderDiagram(block, theme)
  return `<figure class="figure chart-figure" data-component-id="${escapeAttr(block.id)}">
    <div class="chart-head"><div class="chart-title">${escapeHtml(block.title)}</div><div class="chart-subtitle">${escapeHtml(block.diagram_type.replace(/_/g, ' '))}</div></div>
    ${svg}
    ${block.caption ? `<figcaption class="chart-caption">${escapeHtml(block.caption)}</figcaption>` : ''}
  </figure>`
}

/**
 * Render one typed block.
 * @param {object} block
 * @param {object} context
 */
export async function renderBlock(block, context) {
  const { theme, document, options } = context
  const cid = escapeAttr(block.id)
  switch (block.type) {
    case 'heading':
      return `<div class="block" data-component-id="${cid}"><h${Math.min(4, block.level + 1)} class="heading heading--${block.level}" id="${cid}">${block.kicker ? `<span class="heading-kicker">${escapeHtml(block.kicker)}</span>` : ''}${nl2br(block.text)}</h${Math.min(4, block.level + 1)}></div>`
    case 'paragraph':
      return `<p class="block paragraph ${block.lead ? 'paragraph--lead' : ''} ${block.dropcap ? 'paragraph--dropcap' : ''}" data-component-id="${cid}">${nl2br(block.text)}</p>`
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul'
      return `<${tag} class="block list" data-component-id="${cid}">${block.items.map(item => `<li>${item.title ? `<span class="list-item-title">${escapeHtml(item.title)}</span>${item.text ? ' · ' : ''}` : ''}${item.text ? `<span class="list-item-text">${nl2br(item.text)}</span>` : ''}</li>`).join('')}</${tag}>`
    }
    case 'table':
      return tableHtml(block, theme)
    case 'image': {
      const asset = await resolveAsset(block.src, options)
      return `<figure class="block figure figure--image figure--${escapeAttr(block.variant)} figure--keep" data-component-id="${cid}">
        <img src="${asset.src}" alt="${escapeAttr(block.alt)}" style="object-fit:${block.fit === 'cover' ? 'cover' : 'contain'}">
        ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}
      </figure>`
    }
    case 'chart':
      return chartHtml(block, theme)
    case 'diagram':
      return diagramHtml(block, theme)
    case 'kpi':
      return `<div class="block" data-component-id="${cid}">${block.title ? `<div class="kpi-title">${escapeHtml(block.title)}</div>` : ''}<div class="kpi-band">${block.items.map(item => `<div class="kpi-card"><div class="kpi-label">${escapeHtml(item.label)}</div><div class="kpi-value">${escapeHtml(item.value)}${item.unit ? `<span class="kpi-unit">${escapeHtml(item.unit)}</span>` : ''}</div>${item.delta ? `<div class="kpi-delta kpi-delta--${escapeAttr(item.tone)}">${escapeHtml(item.delta)}</div>` : ''}${item.note ? `<div class="kpi-note">${escapeHtml(item.note)}</div>` : ''}</div>`).join('')}</div></div>`
    case 'quote':
      return `<figure class="block quote" data-component-id="${cid}"><blockquote class="quote-text">${nl2br(block.text)}</blockquote>${block.attribution ? `<figcaption class="quote-attribution">${escapeHtml(block.attribution)}${block.role ? ` <span class="quote-role">· ${escapeHtml(block.role)}</span>` : ''}</figcaption>` : ''}</figure>`
    case 'callout':
      return `<aside class="block callout callout--${escapeAttr(block.tone)}" data-component-id="${cid}">${block.title ? `<div class="callout-title">${escapeHtml(block.title)}</div>` : ''}<div class="callout-text">${nl2br(block.text)}</div></aside>`
    case 'timeline':
      return `<div class="block" data-component-id="${cid}">${block.title ? `<div class="kpi-title">${escapeHtml(block.title)}</div>` : ''}<div class="timeline">${block.items.map(item => `<div class="timeline-item"><div class="timeline-date">${escapeHtml(item.date)}</div><div class="timeline-title">${escapeHtml(item.title)}</div>${item.text ? `<div class="timeline-text">${nl2br(item.text)}</div>` : ''}</div>`).join('')}</div></div>`
    case 'equation':
      return `<figure class="block" data-component-id="${cid}"><div class="equation">${escapeHtml(block.plain)}</div>${block.caption ? `<figcaption class="equation-caption">${escapeHtml(block.caption)}</figcaption>` : ''}</figure>`
    case 'citation':
      return `<div class="block citation" data-component-id="${cid}">${escapeHtml(block.text)}${block.source ? ` <span class="citation-source">${escapeHtml(block.source)}</span>` : ''}${block.url ? ` <a class="citation-url" href="${escapeAttr(block.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(block.url)}</a>` : ''}${block.accessed ? ` <span class="citation-accessed">${document.language === 'id' ? 'Diakses' : 'Accessed'} ${escapeHtml(block.accessed)}.</span>` : ''}</div>`
    case 'footnote':
      return `<div class="block footnote" data-component-id="${cid}"><span class="footnote-marker">${escapeHtml(block.marker || '†')}</span>${nl2br(block.text)}</div>`
    case 'pagebreak':
      return `<div class="pagebreak" data-component-id="${cid}" aria-hidden="true"></div>`
    case 'sectionbreak':
      return `<section class="sectionbreak" data-component-id="${cid}"><div class="sectionbreak-title">${escapeHtml(block.title)}</div>${block.subtitle ? `<div class="sectionbreak-subtitle">${escapeHtml(block.subtitle)}</div>` : ''}</section>`
    default:
      throw new StudioError('unsupported_block', `Unsupported block type: ${block.type}`, { details: { component_id: block.id } })
  }
}

function chooseLayout(section) {
  // Multi-column paged-media in Chromium can insert an early page break and
  // leave the remainder of the first page blank. Only use it when a section
  // explicitly requests it and the author has checked the result.
  if (section.layout && section.layout !== 'standard') return section.layout
  return 'standard'
}

function stripLeadingNumber(value) {
  return String(value ?? '').replace(/^\s*\d{1,2}\s*[·.\-–—]\s*/, '')
}

function dividerHtml(section, document, theme, index) {
  const number = section.number || String(index + 1).padStart(2, '0')
  return `<section class="divider" data-section-id="${escapeAttr(section.id)}">
    <div class="divider-top"><span>${escapeHtml(categoryLabel(document))}</span><span>${escapeHtml(document.title)}</span></div>
    <div class="divider-main">
      <div class="divider-number">${escapeHtml(number)}</div>
      ${section.kicker ? `<div class="section-kicker">${escapeHtml(stripLeadingNumber(section.kicker))}</div>` : ''}
      <div class="divider-title">${escapeHtml(section.title || '')}</div>
      ${section.subtitle ? `<div class="divider-subtitle">${escapeHtml(section.subtitle)}</div>` : ''}
    </div>
    <div class="divider-bottom"><span>${escapeHtml(document.metadata?.organization || 'AI PDF Studio')}</span><span>${escapeHtml(formatDate(document))}</span></div>
  </section>`
}

async function sectionHtml(section, document, theme, design, options, index, total) {
  if (section.divider) return dividerHtml(section, document, theme, index)
  const blocks = []
  for (const block of section.blocks) blocks.push(await renderBlock(block, { theme, document, options }))
  const layout = chooseLayout(section)
  const layoutClass = layout === 'two_column' ? 'blocks--two_column' : layout === 'sidebar' ? 'blocks--sidebar' : layout === 'wide' ? 'blocks--wide' : ''
  const number = section.number || String(index + 1).padStart(2, '0')
  const flow = section.page_break_before === false || document.layout.section_start === 'flow'
  const hasDisclosure = section.blocks.some(block => /synthetic|sintetis|demonstration|demonstrasi/i.test(`${block.title ?? ''} ${block.text ?? ''} ${block.caption ?? ''}`))
  return `<section class="section ${flow ? 'section--flow' : ''}" data-section-id="${escapeAttr(section.id)}">
    <div class="section-head">
      <div class="section-number">${escapeHtml(number)}</div>
      ${section.kicker ? `<div class="section-kicker">${escapeHtml(stripLeadingNumber(section.kicker))}</div>` : ''}
      <h2 class="section-title">${escapeHtml(section.title)}</h2>
      ${section.subtitle ? `<p class="section-subtitle">${escapeHtml(section.subtitle)}</p>` : ''}
    </div>
    <div class="blocks ${layoutClass}">${blocks.join('\n')}</div>
    ${document.synthetic && index === total - 1 && !hasDisclosure ? `<div class="synthetic-note" data-component-id="doc-synthetic-note">${escapeHtml(ui(document).syntheticNote)}</div>` : ''}
  </section>`
}

/** Build the final body HTML (cover excluded). */
export async function renderBody(document, theme, design, options = {}) {
  const sections = []
  let total = document.sections.length
  for (const [index, section] of document.sections.entries()) {
    sections.push(await sectionHtml(section, document, theme, design, options, index, total))
  }
  const hasReferenceSection = document.sections.some(section =>
    section.blocks.some(block => block.type === 'citation')
    || /reference|referensi|bibliography|daftar pustaka/i.test(section.title))
  if (document.citations?.length && !hasReferenceSection) {
    const refs = document.citations.map(citation => renderBlock({
      type: 'citation', id: citation.id, text: citation.text, source: citation.source,
      url: citation.url, accessed: citation.accessed,
    }, { theme, document, options }))
    const refsHtml = (await Promise.all(refs)).join('')
    total += 1
    sections.push(`<section class="section" data-section-id="auto-references">
      <div class="section-head"><div class="section-number">${String(total).padStart(2, '0')}</div><h2 class="section-title">${escapeHtml(ui(document).references)}</h2></div>
      <div class="blocks">${refsHtml}</div>
    </section>`)
  }
  const body = `<main class="body-shell" data-document-id="${escapeAttr(document.document_id)}">${sections.join('\n')}</main>`
  return pageHtml(document, theme, design, body, options, { cover: false })
}

export function headerFooterTemplates(document, theme, design) {
  const colors = theme.colors
  const leftPt = document.page.margins.left
  const rightPt = document.page.margins.right
  const leftPx = Math.round(leftPt * 4 / 3)
  const rightPx = Math.round(rightPt * 4 / 3)
  const mono = theme.fonts.mono.replace(/"/g, "'")
  const org = document.metadata?.organization || document.brand?.organization || 'AI PDF Studio'
  const title = document.title.replace(/\s+/g, ' ').slice(0, 62)
  const status = document.synthetic ? ui(document).synthetic : (document.cover?.status || '')
  const header = `<div style="box-sizing:border-box;width:100%;padding:0 ${leftPx}px;font-family:${escapeAttr(mono)};font-size:6.6px;letter-spacing:.09em;text-transform:uppercase;color:${colors.muted};display:flex;justify-content:space-between;align-items:center;">
    <span style="max-width:58%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escapeHtml(org)} · ${escapeHtml(title)}</span>
    <span style="color:${colors.accent}">${escapeHtml(categoryLabel(document))}</span>
  </div>`
  const footer = `<div style="box-sizing:border-box;width:100%;padding:0 ${leftPx}px;font-family:${escapeAttr(mono)};font-size:6.6px;letter-spacing:.06em;color:${colors.muted};display:flex;justify-content:space-between;align-items:center;border-top:0.4px solid ${colors.line};padding-top:2.5px;">
    <span>${escapeHtml(status || org)}</span>
    <span style="color:${colors.ink}"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`
  return { header, footer }
}

function pageHtml(document, theme, design, content, options = {}, meta = {}) {
  const keywords = (document.metadata?.keywords ?? []).join(', ')
  const title = document.title
  return `<!doctype html>
<html lang="${escapeAttr(document.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="author" content="${escapeAttr(document.metadata?.author ?? '')}">
<meta name="description" content="${escapeAttr(document.metadata?.subject ?? document.subtitle ?? '')}">
<meta name="keywords" content="${escapeAttr(keywords)}">
<meta name="generator" content="AI PDF Studio Ultimate">
<meta name="dcterms.created" content="${escapeAttr(document.metadata?.created_at ?? '')}">
<style>${options.styles ?? ''}${meta.cover ? '\n@page { margin: 0 !important; }' : ''}</style>
</head>
<body data-document-id="${escapeAttr(document.document_id)}" data-theme="${escapeAttr(theme.key)}">
${content}
${document.brand?.watermark && !meta.cover ? `<div class="brand-watermark" aria-hidden="true" style="position:fixed;right:18pt;bottom:72pt;font-family:${escapeAttr(theme.fonts.mono.replace(/"/g, "'"))};font-size:7pt;letter-spacing:.16em;text-transform:uppercase;color:${theme.colors.muted};opacity:.18;transform:rotate(-90deg);transform-origin:right bottom;z-index:0">${escapeHtml(document.brand.watermark)}</div>` : ''}
</body>
</html>`
}
