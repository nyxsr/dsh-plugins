/** Artifact verification for SVG, PNG and PDF. */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { analyzePng } from './png.js'
import { validateSvgMarkup } from './svg.js'
import { runChecked } from '../core/process.js'

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'diagram-verify-'))
}

export function verifySvgArtifact(svg, expected = {}) {
  const check = validateSvgMarkup(svg)
  const errors = [...check.errors]
  const warnings = [...check.warnings]
  if (expected.width && Math.abs(check.width - expected.width) > 1) errors.push({ code: 'svg_width_mismatch', message: `SVG width ${check.width} does not match layout width ${expected.width}.` })
  if (expected.height && Math.abs(check.height - expected.height) > 1) errors.push({ code: 'svg_height_mismatch', message: `SVG height ${check.height} does not match layout height ${expected.height}.` })
  return {
    format: 'svg',
    status: errors.length ? 'FAILED' : 'PASSED',
    errors,
    warnings,
    metrics: { width: check.width, height: check.height, bytes: check.bytes, viewBox: check.viewBox },
  }
}

export function verifyPngArtifact(buffer, expected = {}) {
  const errors = []
  const warnings = []
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) errors.push({ code: 'png_empty', message: 'PNG artifact is empty.' })
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) errors.push({ code: 'png_signature', message: 'PNG signature is invalid.' })
  let metrics = null
  try {
    metrics = analyzePng(buffer, { topInset: (expected.headerHeight ?? 0) * (expected.scale ?? 1) })
    const scale = expected.scale ?? 1
    if (expected.width && Math.abs(metrics.width - expected.width * scale) > 2) errors.push({ code: 'png_width_mismatch', message: `PNG width ${metrics.width} does not match expected ${expected.width * scale}.` })
    if (expected.height && Math.abs(metrics.height - expected.height * scale) > 2) errors.push({ code: 'png_height_mismatch', message: `PNG height ${metrics.height} does not match expected ${expected.height * scale}.` })
    if (metrics.inkRatio < 0.002) errors.push({ code: 'png_blank', message: 'PNG has almost no non-background pixels.' })
    if (metrics.inkRatio > 0.92) warnings.push({ code: 'png_overfull', message: 'PNG has very little whitespace; content may be crowded.' })
    if (metrics.clipped) warnings.push({ code: 'png_edge_content', message: 'PNG content touches an edge; verify intentional full-bleed bands.' })
    if (metrics.distinctColors < 4) warnings.push({ code: 'png_few_colors', message: 'PNG has very few colors; verify the rendering is complete.' })
  } catch (error) {
    errors.push({ code: error.code ?? 'png_decode_failed', message: error.message })
  }
  return { format: 'png', status: errors.length ? 'FAILED' : 'PASSED', errors, warnings, metrics }
}

export async function verifyPdfArtifact(buffer, expected = {}) {
  const errors = []
  const warnings = []
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) errors.push({ code: 'pdf_empty', message: 'PDF artifact is empty.' })
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') errors.push({ code: 'pdf_signature', message: 'PDF header is missing.' })
  if (!buffer.subarray(Math.max(0, buffer.length - 2048)).toString('latin1').includes('%%EOF')) errors.push({ code: 'pdf_eof', message: 'PDF EOF marker is missing.' })
  let metrics = { bytes: buffer.length }
  if (!errors.length) {
    const dir = await tempDir()
    const file = path.join(dir, 'diagram.pdf')
    try {
      await fs.writeFile(file, buffer)
      const info = await runChecked('pdfinfo', [file], { timeoutMs: 15000, maxBytes: 1_000_000 })
      const pages = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0)
      const size = info.stdout.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m)
      metrics = { ...metrics, pages, pageWidth: size ? Number(size[1]) : null, pageHeight: size ? Number(size[2]) : null, encrypted: /^Encrypted:\s+yes/m.test(info.stdout) }
      if (pages < 1) errors.push({ code: 'pdf_pages', message: 'PDF has no pages.' })
      if (metrics.pageWidth && expected.width && Math.abs(metrics.pageWidth - expected.width * 0.75) > 2) warnings.push({ code: 'pdf_page_width', message: 'PDF page width differs from the layout width.' })
      if (metrics.encrypted) errors.push({ code: 'pdf_encrypted', message: 'PDF is unexpectedly encrypted.' })
      const prefix = path.join(dir, 'page')
      await runChecked('pdftoppm', ['-png', '-f', '1', '-l', '1', '-r', '24', '-singlefile', file, prefix], { timeoutMs: 20000, maxBytes: 1_000_000 })
      const raster = await fs.readFile(`${prefix}.png`)
      const metricsRaster = analyzePng(raster)
      metrics.raster = { width: metricsRaster.width, height: metricsRaster.height, inkRatio: metricsRaster.inkRatio }
      if (metricsRaster.inkRatio < 0.001) errors.push({ code: 'pdf_raster_blank', message: 'Rasterized PDF page is blank.' })
    } catch (error) {
      warnings.push({ code: 'pdf_raster_unavailable', message: `PDF structure was checked, but raster verification failed: ${error.message}` })
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }
  return { format: 'pdf', status: errors.length ? 'FAILED' : 'PASSED', errors, warnings, metrics }
}
