/** Export the composed HTML to a merged, metadata-complete PDF. */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { renderHtmlToPdf } from './chromium.js'
import { buildHtml } from './html_renderer.js'
import { StudioError } from '../core/errors.js'

function marginInches(margins) {
  return {
    top: margins.top / 72,
    right: margins.right / 72,
    bottom: margins.bottom / 72,
    left: margins.left / 72,
  }
}

/**
 * @param {object} args
 * @param {object} args.document
 * @param {object} args.theme
 * @param {object} args.design
 * @param {string} args.workDir
 * @param {string} args.outputPath
 */
export async function renderDocumentPdf({ document, theme, design, workDir, outputPath, options = {} }) {
  const started = Date.now()
  await mkdir(workDir, { recursive: true })
  await mkdir(path.dirname(outputPath), { recursive: true })
  const html = await buildHtml(document, theme, design, workDir, options)
  const coverPdfPath = path.join(workDir, 'cover.pdf')
  const bodyPdfPath = path.join(workDir, 'body.pdf')
  const pageSize = { widthPt: document.page.width_pt, heightPt: document.page.height_pt }

  const coverRender = await renderHtmlToPdf({
    htmlPath: html.coverPath,
    pdfPath: coverPdfPath,
    pageSize,
    marginsIn: { top: 0, right: 0, bottom: 0, left: 0 },
    displayHeaderFooter: false,
    headerTemplate: '<div></div>',
    footerTemplate: '<div></div>',
    printBackground: true,
  })
  const bodyRender = await renderHtmlToPdf({
    htmlPath: html.bodyPath,
    pdfPath: bodyPdfPath,
    pageSize,
    marginsIn: marginInches(document.page.margins),
    displayHeaderFooter: true,
    headerTemplate: html.templates.header,
    footerTemplate: html.templates.footer,
    printBackground: true,
  })

  const coverDoc = await PDFDocument.load(await readFile(coverPdfPath), { updateMetadata: false })
  const bodyDoc = await PDFDocument.load(await readFile(bodyPdfPath), { updateMetadata: false })
  if (bodyDoc.getPageCount() < 1) throw new StudioError('render_failed', 'PDF isi tidak punya halaman.')
  const coverPageCount = coverDoc.getPageCount()
  if (coverPageCount !== 1) {
    throw new StudioError('cover_overflow', `Sampul menjadi ${coverPageCount} halaman, padahal sampul harus tepat satu halaman.`, {
      details: { cover_page_count: coverPageCount, title_length: document.title.length },
    })
  }
  const merged = await PDFDocument.create()
  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices())
  const bodyPages = await merged.copyPages(bodyDoc, bodyDoc.getPageIndices())
  for (const page of coverPages) merged.addPage(page)
  for (const page of bodyPages) merged.addPage(page)
  const created = new Date(document.metadata?.created_at || Date.now())
  merged.setTitle(document.title)
  merged.setAuthor(document.metadata?.author || document.metadata?.organization || 'AI PDF Studio')
  merged.setSubject(`${document.metadata?.subject || document.subtitle || document.title}${document.synthetic ? ' [Synthetic demonstration]' : ''}`)
  merged.setKeywords(document.metadata?.keywords?.length ? document.metadata.keywords : ['AI PDF Studio', document.category])
  merged.setCreator('AI PDF Studio Ultimate')
  merged.setProducer('AI PDF Studio Ultimate · Chromium/Skia')
  merged.setCreationDate(created)
  merged.setModificationDate(created)
  const bytes = await merged.save({ useObjectStreams: true, addDefaultPage: false })
  if (bytes.length < 1000 || !Buffer.from(bytes.slice(0, 5)).toString('ascii').startsWith('%PDF-')) {
    throw new StudioError('render_failed', 'Hasil penggabungan bukan header PDF yang valid.')
  }
  await writeFile(outputPath, bytes)
  const info = await stat(outputPath)
  return {
    pdf_path: outputPath,
    bytes: info.size,
    page_count: merged.getPageCount(),
    cover_page_count: coverPageCount,
    body_page_count: bodyDoc.getPageCount(),
    page_size: pageSize,
    html_paths: { cover: html.coverPath, body: html.bodyPath },
    layout_audit: bodyRender.layout,
    cover_layout_audit: coverRender.layout,
    render: {
      chromium_pdf_bytes: bodyRender.pdfBytes + coverRender.pdfBytes,
      elapsed_ms: Date.now() - started,
    },
  }
}
