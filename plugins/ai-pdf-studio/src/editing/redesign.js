/**
 * PDF-to-Document-IR reconstruction and redesign.
 *
 * This is a heuristic, lossy reconstruction. Text is preserved; tables,
 * charts, images, footnotes, and complex layouts are not recoverable from a
 * text layer and are reported as losses rather than invented.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { run } from '../core/process.js'
import { StudioError } from '../core/errors.js'
import { resolveInputFile, resolveOutputDir, sanitizeFilename } from '../core/paths.js'
import { generatePdf } from '../core/pipeline.js'

function parseInfo(stdout) {
  const info = {}
  for (const line of stdout.split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index > 0) info[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  return info
}

function looksLikeHeading(line, next = '') {
  const clean = line.trim()
  if (clean.length < 3 || clean.length > 90) return false
  if (/^(page|halaman)\s+\d+/i.test(clean)) return false
  if (/^[•\-*–—]\s+/.test(clean)) return false
  if (/[.;:,]$/.test(clean)) return false
  if (/^\d+(\.\d+)*\s+\S/.test(clean)) return true
  if (/^[A-Z0-9\s&/–—-]{4,}$/.test(clean) && /[A-Z]/.test(clean)) return true
  if (next && next.trim().length > 70 && clean.split(/\s+/).length <= 12) return true
  return false
}

function cleanPageText(text) {
  return text.replace(/\u000c/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function repeatedLines(pages) {
  const counts = new Map()
  for (const page of pages) {
    const seen = new Set()
    for (const line of page.split(/\n/).map(value => value.trim()).filter(Boolean).slice(0, 4).concat(
      page.split(/\n/).map(value => value.trim()).filter(Boolean).slice(-4))) {
      const key = line.toLowerCase().replace(/\d+/g, '#')
      if (key.length < 4 || key.length > 100) continue
      if (seen.has(key)) continue
      seen.add(key)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.45))
  return new Set([...counts.entries()].filter(([, count]) => count >= threshold).map(([key]) => key))
}

function stripRepeated(lines, repeated) {
  const trimmed = [...lines]
  while (trimmed.length && repeated.has(trimmed[0].toLowerCase().replace(/\d+/g, '#'))) trimmed.shift()
  while (trimmed.length && repeated.has(trimmed.at(-1).toLowerCase().replace(/\d+/g, '#'))) trimmed.pop()
  return trimmed
}

function pageSize(document, info) {
  const match = String(info['Page size'] ?? '').match(/([\d.]+)\s*x\s*([\d.]+)\s*pts/)
  if (!match) return { size: 'A4' }
  const width = Number(match[1])
  const height = Number(match[2])
  const near = (a, b, tolerance = 3) => Math.abs(a - b) <= tolerance
  if (near(width, 595.28) && near(height, 841.89)) return { size: 'A4' }
  if (near(width, 419.53) && near(height, 595.28)) return { size: 'A5' }
  if (near(width, 612) && near(height, 792)) return { size: 'Letter' }
  if (near(width, 960) && near(height, 540)) return { size: 'Presentation16x9' }
  return { size: 'A4', width_pt: width, height_pt: height, orientation: width > height ? 'landscape' : 'portrait' }
}

function detectLanguage(text) {
  const idWords = (text.match(/\b(dan|yang|untuk|dengan|adalah|pada|dari|ini|tidak|dalam|akan|atau|kepada|sebagai)\b/gi) ?? []).length
  const enWords = (text.match(/\b(the|and|of|to|in|for|with|this|that|from|are|is|on|by|as)\b/gi) ?? []).length
  return idWords > enWords * 1.15 ? 'id' : 'en'
}

function buildSectionsFromPages(pages, repeated) {
  const chunks = []
  for (const [pageIndex, page] of pages.entries()) {
    const lines = stripRepeated(page.split(/\n/).map(value => value.trim()), repeated)
    let buffer = []
    const flush = () => {
      if (!buffer.length) return
      const text = buffer.join(' ').replace(/\s+/g, ' ').trim()
      if (text) chunks.push({ text, lines: [...buffer], page: pageIndex + 1 })
      buffer = []
    }
    for (const line of lines) {
      if (!line) { flush(); continue }
      if (/^[•\-*–—]\s+/.test(line)) {
        flush()
        buffer.push(line)
        continue
      }
      buffer.push(line)
    }
    flush()
  }
  const sections = []
  let current = { title: 'Konten hasil rekonstruksi', blocks: [], page: 1 }
  for (const [index, chunk] of chunks.entries()) {
    const next = chunks[index + 1]?.text ?? ''
    if (chunk.lines.length === 1 && looksLikeHeading(chunk.text, next)) {
      if (current.blocks.length) sections.push(current)
      current = { title: chunk.text.slice(0, 240), blocks: [], page: chunk.page }
      continue
    }
    if (chunk.lines.every(line => /^[•\-*–—]\s+/.test(line))) {
      current.blocks.push({
        type: 'list', id: `recon-list-${sections.length + 1}-${current.blocks.length + 1}`,
        items: chunk.lines.map(line => line.replace(/^[•\-*–—]\s+/, '').trim()).filter(Boolean).map(text => ({ text })),
      })
      continue
    }
    current.blocks.push({
      type: 'paragraph', id: `recon-p-${sections.length + 1}-${current.blocks.length + 1}`,
      text: chunk.text, lead: current.blocks.length === 0,
    })
  }
  if (current.blocks.length) sections.push(current)
  const usable = sections.filter(section => section.blocks.length > 0)
  return usable.length ? usable : [{ title: 'Konten hasil rekonstruksi', blocks: chunks.map((chunk, index) => ({ type: 'paragraph', id: `recon-p-1-${index + 1}`, text: chunk.text })) }]
}

/**
 * @param {object} request
 * @param {object} options
 */
export async function redesignPdf(request, options = {}) {
  const config = options.config
  const workspaceRoot = config.workspace_root
  const sourcePath = await resolveInputFile(workspaceRoot, request.pdf_path)
  const sourceBytes = await readFile(sourcePath)
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex').slice(0, 10)
  const info = parseInfo((await run('pdfinfo', [sourcePath], { timeoutMs: 30000 })).stdout)
  const pageCount = Number(info.Pages ?? 0)
  if (!pageCount) throw new StudioError('invalid_pdf', 'PDF sumber tidak punya halaman.')
  const textResult = await run('pdftotext', ['-layout', '-enc', 'UTF-8', sourcePath, '-'], { timeoutMs: 60000, maxBytes: 64 * 1024 * 1024 })
  if (textResult.code !== 0) throw new StudioError('extraction_failed', 'Tidak berhasil mengekstrak teks dari PDF sumber.', { details: { stderr: textResult.stderr.slice(0, 800) } })
  const rawText = textResult.stdout
  const pages = rawText.split(/\f/).map(cleanPageText)
  const totalChars = pages.reduce((sum, page) => sum + page.replace(/\s/g, '').length, 0)
  if (totalChars < 40) {
    const tesseract = await run('tesseract', ['--version'], { timeoutMs: 5000 }).catch(() => ({ code: -1 }))
    throw new StudioError('ocr_not_supported', 'PDF sumber tidak punya lapisan teks yang bisa dipakai. Redesign PDF hasil pindai butuh OCR, dan OCR belum terpasang.', {
      status: 'unsupported',
      details: {
        pages: pageCount, extracted_characters: totalChars,
        ocr_available: tesseract.code === 0,
        remedy: 'Pakai PDF berbasis teks, atau jalankan OCR terpisah sebelum redesign.',
      },
    })
  }
  const repeated = repeatedLines(pages)
  const reconstructed = buildSectionsFromPages(pages, repeated)
  const metadataTitle = String(info.Title ?? '').trim()
  const firstChunk = reconstructed[0]?.blocks?.[0]?.type === 'paragraph' ? reconstructed[0].blocks[0].text : ''
  const title = String(request.title || metadataTitle || firstChunk.split(/[.\n]/)[0] || 'Dokumen hasil rekonstruksi').slice(0, 160)
  if (reconstructed[0]?.title === 'Konten hasil rekonstruksi' && reconstructed[0].blocks.length > 1 && reconstructed[0].blocks[0]?.text === firstChunk && firstChunk.length < 180) {
    reconstructed[0].blocks.shift()
  }
  const language = request.language ?? detectLanguage(rawText)
  const page = request.page_size ? { size: request.page_size } : pageSize(reconstructed, info)
  const document = {
    document_id: request.document_id ?? `redesign-${sourceHash}`,
    title,
    subtitle: request.subtitle ?? 'Direkonstruksi dari PDF yang sudah ada. Tata letak dan aset visual tidak dipertahankan.',
    eyebrow: request.eyebrow ?? 'Redesign PDF',
    category: request.category ?? 'report',
    language,
    audience: request.audience ?? 'Pembaca dokumen hasil rekonstruksi',
    purpose: request.purpose ?? 'Pertahankan makna sumber sambil memakai sistem visual baru',
    content_mode: 'preserve',
    synthetic: false,
    page,
    theme: { family: request.theme_family ?? undefined },
    metadata: {
      author: info.Author || request.author || 'Sumber rekonstruksi',
      organization: request.organization ?? '',
      subject: info.Subject || title,
      keywords: ['redesign', 'reconstructed'],
      created_at: new Date().toISOString(),
    },
    citations: [],
    sections: [
      {
        title: 'Reconstruction notice', kicker: 'Kesetiaan pada sumber',
        blocks: [{
          type: 'callout', id: 'reconstruction-notice', tone: 'warning', title: 'Rekonstruksi yang tidak persis',
          text: `This document was reconstructed from ${pageCount} page(s) of an existing PDF. Text was preserved, but tables, charts, images, footnotes, and exact layout could not be recovered from the text layer. Review the source against this document before release.`,
        }],
      },
      ...reconstructed.map((section, index) => ({
        ...section,
        id: `recon-sec-${index + 1}`,
        number: String(index + 2).padStart(2, '0'),
        blocks: section.blocks.map((block, blockIndex) => ({ ...block, id: block.id ?? `recon-${index + 1}-${blockIndex + 1}` })),
      })),
    ],
  }
  const outputDir = await resolveOutputDir({
    workspaceRoot, outputRoot: config.output_root,
    outputDir: request.output_dir ?? path.join(config.output_root, `redesign-${sanitizeFilename(title)}`),
    documentId: document.document_id,
  })
  await mkdir(outputDir, { recursive: true })
  const extractedTextPath = path.join(outputDir, 'source-extracted.txt')
  await writeFile(extractedTextPath, rawText, 'utf8')
  const result = await generatePdf({
    document,
    output_dir: outputDir,
    visual_review: request.visual_review,
  }, { config, workspaceRoot })
  const reconstruction = {
    source_pdf: sourcePath,
    source_pages: pageCount,
    source_title: metadataTitle,
    extracted_characters: totalChars,
    extracted_text_path: extractedTextPath,
    reconstructed_sections: document.sections.length,
    reconstructed_blocks: document.sections.reduce((sum, section) => sum + section.blocks.length, 0),
    repeated_lines_removed: repeated.size,
    detected_language: language,
    method: 'pdftotext text layer + deterministic heading/paragraph heuristics',
    lossy: true,
    unsupported_elements: ['tables', 'charts', 'raster images', 'vector artwork', 'footnote placement', 'multi-column order', 'font dan warna yang persis'],
    limitations: [
      'Tidak ada OCR yang dijalankan. Halaman pindai tanpa teks tidak bisa direkonstruksi.',
      'Text order in multi-column layouts may be imperfect.',
      'Judul hasil rekonstruksi masih tebakan, jadi perlu ditinjau.',
      'Tidak ada sitasi sumber yang dikarang. Tambahkan sumber secara manual bila perlu.',
    ],
  }
  await writeFile(path.join(outputDir, 'reconstruction-report.json'), JSON.stringify(reconstruction, null, 2))
  return {
    ...result,
    reconstruction_report_path: path.join(outputDir, 'reconstruction-report.json'),
    reconstruction,
  }
}
