/**
 * Deterministic PDF and page-image inspection.
 *
 * Poppler supplies page geometry, word boxes, fonts, and metadata. Pillow
 * supplies ink, whitespace, contrast, and colour metrics. No result is
 * inferred from a successful export alone.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, PDFName } from 'pdf-lib'
import { run, runChecked } from '../core/process.js'
import { expectedFragments } from '../core/models.js'
import { StudioError } from '../core/errors.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PAGE_METRICS = path.join(HERE, 'page_metrics.py')

function parseInfo(stdout) {
  const info = {}
  for (const line of stdout.split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index <= 0) continue
    info[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  return info
}

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function parseBbox(html) {
  const pages = []
  const pagePattern = /<page\s+width="([\d.]+)"\s+height="([\d.]+)">([\s\S]*?)<\/page>/gi
  let pageMatch
  while ((pageMatch = pagePattern.exec(html)) !== null) {
    const width = Number(pageMatch[1])
    const height = Number(pageMatch[2])
    const body = pageMatch[3]
    const words = []
    const wordPattern = /<word\s+xMin="([-\d.]+)"\s+yMin="([-\d.]+)"\s+xMax="([-\d.]+)"\s+yMax="([-\d.]+)">([\s\S]*?)<\/word>/gi
    let wordMatch
    while ((wordMatch = wordPattern.exec(body)) !== null) {
      words.push({
        text: decodeXml(wordMatch[5]),
        xMin: Number(wordMatch[1]), yMin: Number(wordMatch[2]),
        xMax: Number(wordMatch[3]), yMax: Number(wordMatch[4]),
      })
    }
    // Chromium emits an outlined text run twice (stroke + fill). Collapse
    // near-identical boxes at the same position so decorative outlines do not
    // create false clipping or collision findings.
    const deduped = []
    for (const word of words) {
      const duplicate = deduped.find(existing =>
        existing.text === word.text
        && overlapRatio(existing, word) > 0.7)
      if (!duplicate) {
        deduped.push(word)
        continue
      }
      const existingArea = (duplicate.xMax - duplicate.xMin) * (duplicate.yMax - duplicate.yMin)
      const wordArea = (word.xMax - word.xMin) * (word.yMax - word.yMin)
      if (wordArea < existingArea) deduped[deduped.indexOf(duplicate)] = word
    }
    pages.push({ width, height, words: deduped })
  }
  return pages
}

function parseFonts(stdout) {
  const fonts = []
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('name') || line.startsWith('---')) continue
    const match = line.match(/^\s*(.+?)\s+(CID TrueType|CID Type [0-9A-Za-z]+|Type 1C?|Type 3|TrueType)\s+(\S+)\s+(yes|no)\s+(yes|no)\s+(yes|no)\s+(\d+)\s+(\d+)\s*$/)
    if (match) {
      fonts.push({
        name: match[1].trim(), type: match[2], encoding: match[3],
        embedded: match[4] === 'yes', subset: match[5] === 'yes', unicode: match[6] === 'yes',
        object_id: `${match[7]} ${match[8]}`,
      })
    }
  }
  return fonts
}

function parseImages(stdout) {
  const rows = []
  for (const line of stdout.split(/\r?\n/)) {
    if (!/^\s*\d+\s+\d+\s+/.test(line)) continue
    const tokens = line.trim().split(/\s+/)
    if (tokens.length < 14) continue
    const page = Number(tokens[0])
    const xPpi = Number(tokens[tokens.length - 4])
    const yPpi = Number(tokens[tokens.length - 3])
    rows.push({ page, x_ppi: Number.isFinite(xPpi) ? xPpi : null, y_ppi: Number.isFinite(yPpi) ? yPpi : null, raw: line.trim() })
  }
  return rows
}

function normalizeForMatch(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, ' ')
    .trim()
}

function groupLines(words) {
  const lines = []
  for (const word of [...words].sort((a, b) => a.yMin - b.yMin || a.xMin - b.xMin)) {
    const line = lines.at(-1)
    if (line && Math.abs(line.yMin - word.yMin) < 1.4) {
      line.words.push(word)
      line.yMin = Math.min(line.yMin, word.yMin)
      line.yMax = Math.max(line.yMax, word.yMax)
      line.xMin = Math.min(line.xMin, word.xMin)
      line.xMax = Math.max(line.xMax, word.xMax)
    } else {
      lines.push({ yMin: word.yMin, yMax: word.yMax, xMin: word.xMin, xMax: word.xMax, words: [word] })
    }
  }
  return lines
}

function overlapRatio(a, b) {
  const x = Math.max(0, Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin))
  const y = Math.max(0, Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin))
  const intersection = x * y
  const smaller = Math.min((a.xMax - a.xMin) * (a.yMax - a.yMin), (b.xMax - b.xMin) * (b.yMax - b.yMin))
  return smaller > 0 ? intersection / smaller : 0
}

function detectCollisions(words) {
  const collisions = []
  const candidates = words.filter(word => word.text.trim().length > 1).slice(0, 900)
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i]
      const b = candidates[j]
      if (Math.abs(a.yMin - b.yMin) < 0.8 && Math.abs(a.xMin - b.xMin) < 0.8) continue
      if (overlapRatio(a, b) > 0.62 && a.text !== b.text) {
        collisions.push({
          text_a: a.text, text_b: b.text,
          x: Math.round(a.xMin), y: Math.round(a.yMin),
          page_component_hint: null,
          point: { x: Math.round((a.xMin + b.xMin) / 2), y: Math.round((a.yMin + b.yMin) / 2) },
        })
        if (collisions.length >= 30) return collisions
      }
    }
  }
  return collisions
}

async function pageImageMetrics(previews) {
  if (!previews?.length) return []
  try {
    const result = await run('python3', [PAGE_METRICS], {
      timeoutMs: 120000,
      input: JSON.stringify(previews.map(preview => preview.path)),
      maxBytes: 8 * 1024 * 1024,
    })
    if (result.code !== 0) throw new Error(result.stderr || 'metrik halaman gagal')
    return JSON.parse(result.stdout)
  } catch (error) {
    return previews.map(preview => ({ path: preview.path, error: error instanceof Error ? error.message : String(error) }))
  }
}

async function countAnnotations(pdfBytes) {
  try {
    const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false })
    let annotations = 0
    let links = 0
    for (const page of doc.getPages()) {
      const annots = page.node.Annots()
      if (!annots) continue
      const count = annots.size()
      annotations += count
      for (let index = 0; index < count; index += 1) {
        const dict = annots.lookup(index)
        const subtype = dict?.get?.(PDFName.of('Subtype'))
        if (subtype?.toString?.() === '/Link') links += 1
      }
    }
    return { annotations, links, available: true }
  } catch {
    return { annotations: null, links: null, available: false }
  }
}

/**
 * @param {object} args
 * @param {string} args.pdfPath
 * @param {object} args.document normalized IR
 * @param {Array} [args.previews]
 * @param {object} [args.layoutAudit]
 * @param {object} [args.render]
 */
export async function inspectPdf({ pdfPath, document, previews = [], layoutAudit = null, render = null }) {
  const errors = []
  const warnings = []
  let pdfBytes
  try {
    pdfBytes = await readFile(pdfPath)
  } catch (error) {
    throw new StudioError('inspection_failed', `Cannot read PDF: ${pdfPath}`, { cause: error })
  }
  const header = pdfBytes.subarray(0, 8).toString('ascii')
  const infoResult = await run('pdfinfo', [pdfPath], { timeoutMs: 30000 })
  if (infoResult.code !== 0) {
    throw new StudioError('invalid_pdf', 'pdfinfo tidak berhasil membaca PDF.', {
      details: { stderr: infoResult.stderr.slice(0, 1000), header },
    })
  }
  const info = parseInfo(infoResult.stdout)
  const pages = Number(info.Pages ?? 0)
  const expected = { width: document.page.width_pt, height: document.page.height_pt }
  const sizeMatch = String(info['Page size'] ?? '').match(/([\d.]+)\s*x\s*([\d.]+)\s*pts/)
  const dimensions = sizeMatch ? { width: Number(sizeMatch[1]), height: Number(sizeMatch[2]) } : null
  const dimensionDelta = dimensions ? { width: Math.abs(dimensions.width - expected.width), height: Math.abs(dimensions.height - expected.height) } : null

  const bboxResult = await run('pdftotext', ['-bbox', '-enc', 'UTF-8', pdfPath, '-'], { timeoutMs: 60000, maxBytes: 32 * 1024 * 1024 })
  const bboxPages = bboxResult.code === 0 ? parseBbox(bboxResult.stdout) : []
  if (bboxResult.code !== 0) warnings.push('pdftotext -bbox gagal, jadi pemeriksaan geometri hanya sebagian.')
  const textResult = await run('pdftotext', ['-enc', 'UTF-8', pdfPath, '-'], { timeoutMs: 60000, maxBytes: 32 * 1024 * 1024 })
  const layoutResult = await run('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, '-'], { timeoutMs: 60000, maxBytes: 32 * 1024 * 1024 })
  const fullText = textResult.code === 0 ? textResult.stdout : ''
  const layoutText = layoutResult.code === 0 ? layoutResult.stdout : ''
  const normalizedFullText = normalizeForMatch(fullText)
  const haystacks = [normalizedFullText, normalizeForMatch(layoutText)]
  const noSpaceHaystacks = haystacks.map(value => value.replace(/\s+/g, ''))
  const fontsResult = await run('pdffonts', [pdfPath], { timeoutMs: 30000 })
  const fonts = fontsResult.code === 0 ? parseFonts(fontsResult.stdout) : []
  const imagesResult = await run('pdfimages', ['-list', pdfPath], { timeoutMs: 30000 })
  const images = imagesResult.code === 0 ? parseImages(imagesResult.stdout) : []
  const annotations = await countAnnotations(pdfBytes)
  const imageMetrics = await pageImageMetrics(previews)
  const metricsByPage = new Map(imageMetrics.map((metric, index) => [index + 1, metric]))

  const allFragments = expectedFragments(document)
  // Chart axis labels are intentionally thinned/truncated by the renderer to
  // stay legible, so they are reported separately instead of failing
  // content completeness.
  const fragments = allFragments.filter(fragment => fragment.kind !== 'chart-category')
  const omittedChartLabels = allFragments.filter(fragment => fragment.kind === 'chart-category')
  const missing = []
  let matched = 0
  for (const fragment of fragments) {
    const normalized = normalizeForMatch(fragment.text)
    if (!normalized) continue
    const needle = normalized.length > 42 ? normalized.slice(0, 42) : normalized
    const needleNoSpaces = needle.replace(/\s+/g, '')
    const found = haystacks.some(value => value.includes(needle)) || noSpaceHaystacks.some(value => value.includes(needleNoSpaces))
    if (found) matched += 1
    else missing.push(fragment)
  }
  const completenessRatio = fragments.length ? matched / fragments.length : 1
  const omittedChartLabelsList = omittedChartLabels
    .filter(fragment => {
      const needle = normalizeForMatch(fragment.text).slice(0, 42)
      const needleNoSpaces = needle.replace(/\s+/g, '')
      return !haystacks.some(value => value.includes(needle)) && !noSpaceHaystacks.some(value => value.includes(needleNoSpaces))
    })
  if (omittedChartLabelsList.length) {
    warnings.push(`${omittedChartLabelsList.length} label sumbu grafik dipangkas agar tetap terbaca. Ini disengaja, bukan konten yang hilang.`)
  }

  const pagesInspection = []
  let totalBodyWords = 0
  let totalBodyChars = 0
  let nearEdgeBodyWords = 0
  let outsidePageWords = 0
  let collisions = 0
  let bodyInk = []
  let blankPages = []
  let overcrowdedPages = []
  let minBodyMargin = null
  const bodyHeights = []
  let maxLineWidth = 0
  let maxLineOverflow = false
  let totalLines = 0
  const pageMargins = document.page.margins
  for (let index = 0; index < Math.max(pages, bboxPages.length); index += 1) {
    const pageNumber = index + 1
    const bbox = bboxPages[index]
    const words = bbox?.words ?? []
    const pageWidth = bbox?.width ?? dimensions?.width ?? expected.width
    const pageHeight = bbox?.height ?? dimensions?.height ?? expected.height
    const outside = words.filter(word => word.xMin < -1 || word.yMin < -1 || word.xMax > pageWidth + 1.5 || word.yMax > pageHeight + 1.5)
    const nearEdge = words.filter(word => {
      if (pageNumber === 1) return false
      const inHeaderFooter = word.yMax < 48 || word.yMin > pageHeight - 48
      if (inHeaderFooter) return false
      return word.xMin < 18 || word.xMax > pageWidth - 18 || word.yMin < 18 || word.yMax > pageHeight - 18
    })
    const pageCollisions = detectCollisions(words)
    const lines = groupLines(words)
    const pageText = lines.map(line => line.words.map(word => word.text).join(' ')).join('\n')
    const bodyWords = words.filter(word => word.yMin > 44 && word.yMax < pageHeight - 44)
    const wordCount = words.length
    const charCount = pageText.replace(/\s/g, '').length
    const metric = metricsByPage.get(pageNumber) ?? null
    const isCover = pageNumber === 1
    if (!isCover) {
      totalBodyWords += wordCount
      totalBodyChars += charCount
      if (typeof metric?.ink_ratio === 'number') bodyInk.push(metric.ink_ratio)
      if (metric?.blank_candidate && wordCount < 10) blankPages.push(pageNumber)
      if (metric?.overcrowded_candidate) overcrowdedPages.push(pageNumber)
    }
    if (nearEdge.length) nearEdgeBodyWords += nearEdge.length
    if (outside.length) outsidePageWords += outside.length
    if (pageCollisions.length && !isCover) collisions += pageCollisions.length
    if (bodyWords.length && !isCover) {
      for (const word of bodyWords) {
        const height = word.yMax - word.yMin
        if (height >= 4 && height <= 42) bodyHeights.push(height)
      }
      for (const line of lines) {
        if (line.words.length < 2) continue
        const width = line.xMax - line.xMin
        if (width > maxLineWidth) maxLineWidth = width
      }
      totalLines += lines.length
      const contentWidth = pageWidth - pageMargins.left - pageMargins.right
      if (maxLineWidth > contentWidth + 2) maxLineOverflow = true
      const left = Math.min(...bodyWords.map(word => word.xMin))
      const right = Math.min(...bodyWords.map(word => pageWidth - word.xMax))
      const bottom = Math.min(...bodyWords.map(word => pageHeight - word.yMax))
      const top = Math.min(...bodyWords.map(word => word.yMin))
      const margin = Math.min(left, right, bottom, top)
      minBodyMargin = minBodyMargin === null ? margin : Math.min(minBodyMargin, margin)
    }
    pagesInspection.push({
      page_number: pageNumber,
      role: isCover ? 'cover' : 'body',
      width_pt: pageWidth,
      height_pt: pageHeight,
      words: wordCount,
      chars: charCount,
      text_excerpt: pageText.slice(0, 260),
      ink_ratio: metric?.ink_ratio ?? null,
      whitespace_ratio: metric?.whitespace_ratio ?? null,
      edge_ratio: metric?.edge_ratio ?? null,
      luma_stddev: metric?.luma_stddev ?? null,
      colorfulness: metric?.colorfulness ?? null,
      background: metric?.background ?? null,
      blank_candidate: Boolean(metric?.blank_candidate),
      overcrowded_candidate: Boolean(metric?.overcrowded_candidate),
      outside_page_words: outside.length,
      near_edge_body_words: nearEdge.length,
      near_edge_words: nearEdge.slice(0, 12).map(word => ({ text: word.text, x: Math.round(word.xMin), y: Math.round(word.yMin) })),
      collisions: pageCollisions.slice(0, 12),
      line_count: lines.length,
      min_body_margin_pt: minBodyMargin,
      preview_path: previews[index]?.path ?? null,
    })
  }

  const pageGeometryOk = Boolean(dimensions) && dimensionDelta.width <= 2 && dimensionDelta.height <= 2
  const textSearchable = normalizedFullText.length > 40 && totalBodyChars > 40
  const fontsEmbedded = fonts.length > 0 && fonts.every(font => font.embedded)
  const noCriticalClipping = outsidePageWords === 0 && nearEdgeBodyWords === 0
  const noCriticalCollisions = collisions === 0
  const noBlankPages = blankPages.length === 0
  const layoutAuditOk = !layoutAudit || ((layoutAudit.overflowing?.length ?? 0) === 0 && (layoutAudit.emptyImages?.length ?? 0) === 0)
  const noJavascript = !/\/JavaScript\b|\/JS\s*\(/i.test(pdfBytes.toString('latin1'))
  const gates = {
    file_valid: header.startsWith('%PDF-') && pages > 0 && info.Encrypted !== 'yes',
    page_geometry: pageGeometryOk,
    text_searchable: textSearchable,
    content_complete: missing.length === 0 && completenessRatio >= 0.995,
    fonts_embedded: fontsEmbedded,
    no_critical_clipping: noCriticalClipping,
    no_critical_collisions: noCriticalCollisions,
    no_unexpected_blank_pages: noBlankPages,
    layout_audit: layoutAuditOk,
    no_javascript: noJavascript,
  }
  for (const [name, passed] of Object.entries(gates)) if (!passed) errors.push(`Mandatory gate failed: ${name}`)
  if (missing.length) warnings.push(`${missing.length} expected content fragment(s) were not found in extracted text.`)
  if (overcrowdedPages.length) warnings.push(`Pages flagged as high ink density: ${overcrowdedPages.join(', ')}`)
  if (annotations.links === 0) warnings.push('Tidak ada anotasi tautan. Tautan yang bisa diklik mungkin tidak ada di dokumen ini.')
  const lowResolutionImages = images.filter(image => (image.x_ppi !== null && image.x_ppi < 100) || (image.y_ppi !== null && image.y_ppi < 100))
  if (lowResolutionImages.length) warnings.push(`${lowResolutionImages.length} raster image(s) are below 100 PPI.`)

  const inkMean = bodyInk.length ? bodyInk.reduce((sum, value) => sum + value, 0) / bodyInk.length : null
  const inkVariance = bodyInk.length > 1
    ? bodyInk.reduce((sum, value) => sum + (value - inkMean) ** 2, 0) / bodyInk.length
    : 0
  const pageCountOk = pages === (render?.page_count ?? pages)

  return {
    document_id: document.document_id,
    pdf_path: pdfPath,
    pdf_bytes: pdfBytes.byteLength,
    header,
    metadata: {
      title: info.Title ?? '', author: info.Author ?? '', subject: info.Subject ?? '',
      keywords: info.Keywords ?? '', creator: info.Creator ?? '', producer: info.Producer ?? '',
      creation_date: info.CreationDate ?? '', mod_date: info.ModDate ?? '',
      pdf_version: info['PDF version'] ?? '', tagged: info.Tagged === 'yes',
      encrypted: info.Encrypted === 'yes', page_size: info['Page size'] ?? '',
    },
    pages,
    dimensions,
    expected_dimensions: expected,
    dimension_delta: dimensionDelta,
    fonts,
    images,
    annotations,
    layout_audit: layoutAudit,
    content: {
      expected_fragments: fragments.length,
      matched_fragments: matched,
      missing_fragments: missing.slice(0, 40),
      omitted_chart_axis_labels: omittedChartLabelsList.slice(0, 20),
      completeness_ratio: Number(completenessRatio.toFixed(4)),
      body_words: totalBodyWords,
      body_chars: totalBodyChars,
    },
    typography: {
      body_fonts: [...new Set(fonts.map(font => font.name))],
      all_embedded: fontsEmbedded,
      font_count: fonts.length,
      estimated_body_font_pt: bodyHeights.length
        ? Number(([...bodyHeights].sort((a, b) => a - b)[Math.floor(bodyHeights.length / 2)]).toFixed(2))
        : null,
      max_line_width_pt: Number(maxLineWidth.toFixed(2)),
      max_line_overflow: maxLineOverflow,
      total_lines: totalLines,
    },
    visual: {
      page_metrics: pagesInspection,
      body_ink_mean: inkMean === null ? null : Number(inkMean.toFixed(4)),
      body_ink_variance: Number(inkVariance.toFixed(5)),
      blank_pages: blankPages,
      overcrowded_pages: overcrowdedPages,
      average_colorfulness: imageMetrics.length
        ? Number((imageMetrics.reduce((sum, page) => sum + (page.colorfulness ?? 0), 0) / imageMetrics.length).toFixed(4))
        : null,
      min_body_margin_pt: minBodyMargin === null ? null : Number(minBodyMargin.toFixed(2)),
    },
    checks: {
      pages_match_render: pageCountOk,
      near_edge_body_words: nearEdgeBodyWords,
      outside_page_words: outsidePageWords,
      collisions,
      low_resolution_images: lowResolutionImages.length,
    },
    gates,
    warnings,
    errors,
    score_inputs: {
      pages,
      body_pages: Math.max(0, pages - 1),
      completeness_ratio: completenessRatio,
      body_words: totalBodyWords,
      fonts_embedded: fontsEmbedded,
      no_critical_clipping: noCriticalClipping,
      no_critical_collisions: noCriticalCollisions,
      no_blank_pages: noBlankPages,
      outside_page_words: outsidePageWords,
      near_edge_body_words: nearEdgeBodyWords,
      collisions,
      dimensions_ok: pageGeometryOk,
      text_searchable: textSearchable,
      layout_audit_ok: layoutAuditOk,
      body_ink_mean: inkMean,
      body_ink_variance: inkVariance,
      min_body_margin_pt: minBodyMargin,
      page_count: pages,
      tagged: info.Tagged === 'yes',
    },
  }
}

export function gatesPass(gates) {
  return Object.values(gates ?? {}).every(Boolean)
}

export function failedGates(gates) {
  return Object.entries(gates ?? {}).filter(([, passed]) => !passed).map(([name]) => name)
}
