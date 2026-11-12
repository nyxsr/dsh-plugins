/**
 * PDF editing operations backed by pdf-lib and Poppler.
 *
 * Editing is not claimed to be lossless: content streams may be rewritten,
 * form fields and complex annotations can be affected, and extracted images
 * are the encoded image objects, not necessarily the original design assets.
 */
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { run, runChecked } from '../core/process.js'
import { StudioError } from '../core/errors.js'
import { resolveInputFile, assertInside, sanitizeFilename } from '../core/paths.js'

function colorFromHex(hex, fallback = [0.1, 0.1, 0.1]) {
  const value = String(hex ?? '').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return rgb(...fallback)
  return rgb(parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255)
}

async function embedTextFont(pdf, bold = false) {
  const candidates = bold
    ? ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']
    : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf']
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        return { font: await pdf.embedFont(await readFile(candidate), { subset: true }), embedded: true, family: path.basename(candidate) }
      } catch { /* fall through */ }
    }
  }
  return { font: await pdf.embedFont(bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica), embedded: false, family: 'Helvetica' }
}

function pageNumberSet(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return null
  return new Set(pages.map(Number).filter(value => Number.isInteger(value) && value > 0))
}

function metadataFrom(doc) {
  return {
    title: doc.getTitle(), author: doc.getAuthor(), subject: doc.getSubject(),
    keywords: doc.getKeywords(), creator: doc.getCreator(), producer: doc.getProducer(),
    creationDate: doc.getCreationDate(), modificationDate: doc.getModificationDate(),
  }
}

function applyMetadata(doc, metadata) {
  if (!metadata) return
  if (metadata.title !== undefined) doc.setTitle(String(metadata.title).slice(0, 500))
  if (metadata.author !== undefined) doc.setAuthor(String(metadata.author).slice(0, 500))
  if (metadata.subject !== undefined) doc.setSubject(String(metadata.subject).slice(0, 1000))
  if (metadata.keywords !== undefined) {
    const keywords = Array.isArray(metadata.keywords) ? metadata.keywords.map(String) : String(metadata.keywords).split(',').map(value => value.trim()).filter(Boolean)
    doc.setKeywords(keywords.slice(0, 50))
  }
  if (metadata.creator !== undefined) doc.setCreator(String(metadata.creator).slice(0, 200))
  if (metadata.producer !== undefined) doc.setProducer(String(metadata.producer).slice(0, 200))
  if (metadata.created_at) {
    const date = new Date(metadata.created_at)
    if (!Number.isNaN(date.getTime())) doc.setCreationDate(date)
  }
  doc.setModificationDate(new Date())
}

async function writePdf(doc, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true })
  const temp = `${outputPath}.tmp-${process.pid}`
  await writeFile(temp, await doc.save({ useObjectStreams: true, addDefaultPage: false }))
  await rename(temp, outputPath)
}

async function loadPdf(filePath) {
  try {
    return await PDFDocument.load(await readFile(filePath), { updateMetadata: false })
  } catch (error) {
    throw new StudioError('invalid_pdf', `Cannot open PDF for editing: ${path.basename(filePath)}`, {
      cause: error, details: { file: filePath },
    })
  }
}

async function extractText(pdfPath, outputDir, stem) {
  const output = path.join(outputDir, `${stem}.txt`)
  const result = await run('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, output], { timeoutMs: 60000 })
  if (result.code !== 0) throw new StudioError('extract_text_failed', 'pdftotext tidak berhasil mengekstrak teks.', { details: { stderr: result.stderr.slice(0, 800) } })
  const text = await readFile(output, 'utf8')
  return { path: output, characters: text.length, preview: text.slice(0, 600), text }
}

async function extractImages(pdfPath, outputDir, stem) {
  const imageDir = path.join(outputDir, `${stem}-images`)
  await mkdir(imageDir, { recursive: true })
  const prefix = path.join(imageDir, 'image')
  const result = await run('pdfimages', ['-png', pdfPath, prefix], { timeoutMs: 90000 })
  if (result.code !== 0) throw new StudioError('extract_images_failed', 'pdfimages tidak berhasil mengekstrak gambar.', { details: { stderr: result.stderr.slice(0, 800) } })
  const files = (await readdir(imageDir)).filter(file => /^image-\d+\.png$/.test(file)).sort().map(file => path.join(imageDir, file))
  return { dir: imageDir, paths: files, count: files.length }
}

async function drawTextOverlay(pdf, pagesSelection, text, options = {}) {
  const size = Number(options.size ?? 9)
  const { font } = await embedTextFont(pdf, Boolean(options.bold))
  const color = colorFromHex(options.color ?? '#666666')
  const opacity = Math.max(0.02, Math.min(1, Number(options.opacity ?? 0.18)))
  const pages = pdf.getPages()
  for (const [index, page] of pages.entries()) {
    if (pagesSelection && !pagesSelection.has(index + 1)) continue
    const { width, height } = page.getSize()
    if (options.mode === 'watermark') {
      const textWidth = font.widthOfTextAtSize(text, size)
      page.drawText(text, {
        x: Math.max(12, (width - textWidth) / 2), y: height / 2 - size,
        size, font, color, opacity, rotate: degrees(Number(options.rotation ?? 38)),
      })
    } else if (options.mode === 'page_numbers') {
      const label = `${options.prefix ?? 'Page'} ${index + 1} ${options.ofLabel ?? 'of'} ${pages.length}`
      const textWidth = font.widthOfTextAtSize(label, size)
      page.drawText(label, {
        x: options.align === 'left' ? 36 : options.align === 'right' ? width - textWidth - 36 : (width - textWidth) / 2,
        y: options.bottom ?? 22, size, font, color, opacity: 1,
      })
    } else if (options.mode === 'header_footer') {
      if (options.header) {
        page.drawText(String(options.header), { x: 36, y: height - 30, size, font, color, opacity: 0.85 })
      }
      if (options.footer) {
        page.drawText(String(options.footer), { x: 36, y: 24, size, font, color, opacity: 0.85 })
      }
    }
  }
}

async function reorderDocument(pdf, order) {
  const pages = pdf.getPages()
  if (!Array.isArray(order) || order.length !== pages.length) {
    throw new StudioError('invalid_edit', `reorder requires exactly ${pages.length} 1-based page numbers.`)
  }
  const normalized = order.map(Number)
  if (new Set(normalized).size !== normalized.length || normalized.some(page => page < 1 || page > pages.length)) {
    throw new StudioError('invalid_edit', 'reorder harus berupa permutasi nomor halaman yang ada.')
  }
  const next = await PDFDocument.create()
  const copied = await next.copyPages(pdf, normalized.map(page => page - 1))
  for (const page of copied) next.addPage(page)
  applyMetadata(next, metadataFrom(pdf))
  return next
}

async function removePages(pdf, pagesToRemove) {
  const pages = pdf.getPages()
  const remove = pageNumberSet(pagesToRemove)
  if (!remove) throw new StudioError('invalid_edit', 'remove_pages butuh larik pages yang tidak kosong.')
  const keep = pages.map((_, index) => index).filter(index => !remove.has(index + 1))
  if (keep.length === 0) throw new StudioError('invalid_edit', 'Semua halaman tidak boleh dihapus.')
  const next = await PDFDocument.create()
  const copied = await next.copyPages(pdf, keep)
  for (const page of copied) next.addPage(page)
  applyMetadata(next, metadataFrom(pdf))
  return next
}

/**
 * @param {object} args
 */
export async function editPdf({ input_path, operations, output_path, output_dir, metadata, workspaceRoot, config }) {
  const inputPath = await resolveInputFile(workspaceRoot, input_path)
  const ops = Array.isArray(operations) ? operations : [operations]
  if (ops.length === 0 || ops.some(op => !op || typeof op !== 'object')) {
    throw new StudioError('invalid_edit', 'operations harus objek atau larik objek yang tidak kosong.')
  }
  const outputDir = output_dir
    ? assertInside(workspaceRoot, path.resolve(workspaceRoot, output_dir), 'output_outside_workspace')
    : path.resolve(workspaceRoot, config?.output_root ?? 'outputs', 'edits', sanitizeFilename(path.basename(inputPath, '.pdf')))
  await mkdir(outputDir, { recursive: true })
  let doc = await loadPdf(inputPath)
  const applied = []
  const warnings = []
  const generated = []
  for (const op of ops) {
    const type = String(op.operation ?? op.type ?? '').toLowerCase()
    switch (type) {
      case 'merge': {
        const sources = Array.isArray(op.sources) ? op.sources : [op.source]
        if (!sources.length) throw new StudioError('invalid_edit', 'merge butuh path PDF sumber.')
        for (const source of sources) {
          if (!source) continue
          const sourcePath = await resolveInputFile(workspaceRoot, source)
          const sourceDoc = await loadPdf(sourcePath)
          const copied = await doc.copyPages(sourceDoc, sourceDoc.getPageIndices())
          for (const page of copied) doc.addPage(page)
        }
        applied.push({ operation: 'merge', sources: sources.length })
        break
      }
      case 'split': {
        const ranges = Array.isArray(op.ranges) && op.ranges.length
          ? op.ranges
          : doc.getPages().map((_, index) => ({ start: index + 1, end: index + 1, name: `page-${String(index + 1).padStart(2, '0')}` }))
        for (const range of ranges) {
          const start = Math.max(1, Number(range.start ?? 1))
          const end = Math.min(doc.getPageCount(), Number(range.end ?? start))
          if (end < start) continue
          const part = await PDFDocument.create()
          const copied = await part.copyPages(doc, Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index))
          for (const page of copied) part.addPage(page)
          applyMetadata(part, metadataFrom(doc))
          const name = sanitizeFilename(range.name ?? `part-${start}-${end}`)
          const partPath = path.join(outputDir, `${name}.pdf`)
          await writePdf(part, partPath)
          generated.push(partPath)
        }
        applied.push({ operation: 'split', parts: generated.length })
        break
      }
      case 'rotate': {
        const pages = pageNumberSet(op.pages)
        const angle = Number(op.degrees ?? 90)
        if (![90, 180, 270, -90, -180, -270].includes(angle)) throw new StudioError('invalid_edit', 'derajat rotate harus kelipatan 90.')
        for (const [index, page] of doc.getPages().entries()) {
          if (!pages || pages.has(index + 1)) page.setRotation(degrees(angle))
        }
        applied.push({ operation: 'rotate', pages: pages ? [...pages] : 'all', degrees: angle })
        break
      }
      case 'reorder':
        doc = await reorderDocument(doc, op.order)
        applied.push({ operation: 'reorder', order: op.order })
        break
      case 'remove_pages':
        doc = await removePages(doc, op.pages)
        applied.push({ operation: 'remove_pages', pages: op.pages })
        break
      case 'extract_text': {
        const output = await extractText(inputPath, outputDir, sanitizeFilename(path.basename(inputPath, '.pdf')))
        generated.push(output.path)
        applied.push({ operation: 'extract_text', path: output.path, characters: output.characters, preview: output.preview })
        break
      }
      case 'extract_images': {
        const images = await extractImages(inputPath, outputDir, sanitizeFilename(path.basename(inputPath, '.pdf')))
        generated.push(...images.paths)
        applied.push({ operation: 'extract_images', dir: images.dir, count: images.count, paths: images.paths })
        break
      }
      case 'watermark':
        await drawTextOverlay(doc, pageNumberSet(op.pages), String(op.text ?? 'DRAFT'), {
          mode: 'watermark', size: op.size ?? 34, color: op.color ?? '#7A7A7A', opacity: op.opacity ?? 0.14,
          rotation: op.rotation ?? 38, bold: true,
        })
        applied.push({ operation: 'watermark', text: String(op.text ?? 'DRAFT') })
        break
      case 'page_numbers':
        await drawTextOverlay(doc, pageNumberSet(op.pages), '', {
          mode: 'page_numbers', size: op.size ?? 8, color: op.color ?? '#666666',
          align: op.align ?? 'center', prefix: op.prefix ?? 'Page', ofLabel: op.of_label ?? 'of', bottom: op.bottom ?? 22,
        })
        applied.push({ operation: 'page_numbers', align: op.align ?? 'center' })
        break
      case 'header_footer':
        await drawTextOverlay(doc, pageNumberSet(op.pages), '', {
          mode: 'header_footer', size: op.size ?? 8, color: op.color ?? '#666666',
          header: op.header, footer: op.footer,
        })
        applied.push({ operation: 'header_footer', header: op.header ?? null, footer: op.footer ?? null })
        break
      case 'add_pages': {
        if (!op.source) throw new StudioError('invalid_edit', 'add_pages butuh PDF sumber.')
        const sourcePath = await resolveInputFile(workspaceRoot, op.source)
        const sourceDoc = await loadPdf(sourcePath)
        const copied = await doc.copyPages(sourceDoc, sourceDoc.getPageIndices())
        for (const page of copied) doc.addPage(page)
        applied.push({ operation: 'add_pages', source: op.source, pages_added: copied.length })
        break
      }
      case 'replace_pages': {
        if (!op.source) throw new StudioError('invalid_edit', 'replace_pages butuh PDF sumber.')
        const pageNumber = Number(op.page ?? 1)
        if (pageNumber < 1 || pageNumber > doc.getPageCount()) throw new StudioError('invalid_edit', 'Halaman replace_pages di luar jangkauan.')
        const sourcePath = await resolveInputFile(workspaceRoot, op.source)
        const sourceDoc = await loadPdf(sourcePath)
        const next = await PDFDocument.create()
        const order = doc.getPageIndices().filter(index => index !== pageNumber - 1)
        const before = await next.copyPages(doc, order.filter(index => index < pageNumber - 1))
        const replacement = await next.copyPages(sourceDoc, [0])
        const after = await next.copyPages(doc, order.filter(index => index >= pageNumber - 1))
        for (const page of before) next.addPage(page)
        for (const page of replacement) next.addPage(page)
        for (const page of after) next.addPage(page)
        applyMetadata(next, metadataFrom(doc))
        doc = next
        applied.push({ operation: 'replace_pages', page: pageNumber, source: op.source })
        break
      }
      case 'metadata':
        applyMetadata(doc, op.metadata ?? op)
        applied.push({ operation: 'metadata' })
        break
      default:
        throw new StudioError('unsupported_edit', `Unsupported PDF editing operation: ${type || '(missing)'}`)
    }
  }
  if (metadata) applyMetadata(doc, metadata)
  const outputPath = output_path
    ? assertInside(workspaceRoot, path.resolve(workspaceRoot, output_path), 'output_outside_workspace')
    : path.join(outputDir, `${sanitizeFilename(path.basename(inputPath, '.pdf'))}-edited.pdf`)
  await writePdf(doc, outputPath)
  generated.unshift(outputPath)
  const info = await run('pdfinfo', [outputPath], { timeoutMs: 30000 })
  const pageCount = Number(/^Pages:\s+(\d+)/m.exec(info.stdout)?.[1] ?? doc.getPageCount())
  if (applied.some(entry => ['watermark', 'page_numbers', 'header_footer'].includes(entry.operation))) {
    warnings.push('Teks tambahan digambar di atas konten lama. Periksa dulu agar teks penting tidak tertutup.')
  }
  if (applied.some(entry => ['merge', 'reorder', 'replace_pages', 'remove_pages'].includes(entry.operation))) {
    warnings.push('Penataan ulang halaman bisa memengaruhi tautan, outline, dan kolom formulir. Teks hasil ekstraksi tetap ada, tetapi anotasi rumit belum tentu ikut.')
  }
  if (applied.some(entry => entry.operation === 'extract_images') && applied.find(entry => entry.operation === 'extract_images')?.count === 0) {
    warnings.push('Tidak ada gambar raster yang bisa diekstrak. Karya vektor tidak diekspor oleh pdfimages.')
  }
  return {
    status: 'success',
    input_path: inputPath,
    output_path: outputPath,
    output_paths: generated,
    page_count: pageCount,
    operations_applied: applied,
    warnings,
    lossless: false,
    notes: ['Penyuntingan PDF bersifat struktural dan bisa menulis ulang aliran konten. Hasilnya tidak lossless dari sisi byte maupun tata letak.'],
  }
}
