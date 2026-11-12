/** Render verified SVG and export PNG/PDF artifacts without overwriting history. */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { DiagramError } from '../core/errors.js'
import { relativeTo } from '../core/paths.js'
import { renderSVG } from './svg.js'
import { exportWithChromium } from './chromium.js'
import { verifyPngArtifact, verifyPdfArtifact, verifySvgArtifact } from '../quality/artifacts.js'

export const OUTPUT_FORMATS = ['svg', 'png', 'pdf']
const MIME = { svg: 'image/svg+xml', png: 'image/png', pdf: 'application/pdf' }

function normalizeFormats(formats) {
  const source = Array.isArray(formats) && formats.length ? formats : ['svg', 'png', 'pdf']
  const cleaned = []
  for (const item of source) {
    const format = String(item).toLowerCase().replace(/^\./, '')
    if (!OUTPUT_FORMATS.includes(format)) {
      throw new DiagramError('unsupported_format', `Unsupported output format: ${item}.`, 'FAILED', { supported: OUTPUT_FORMATS })
    }
    if (!cleaned.includes(format)) cleaned.push(format)
  }
  return cleaned
}

function stamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * @param {{ir: object, formats: string[], scale?: number, store: object, chromiumPath?: string}} options
 * @returns {Promise<{artifacts: object[], warnings: object[], checks: object[]}>}
 */
export async function exportDiagramArtifacts({ ir, formats, scale, store, chromiumPath }) {
  const requested = normalizeFormats(formats)
  if (!ir?.layout) throw new DiagramError('layout_missing', 'The diagram must be laid out before export.', 'FAILED')
  if (!store?.writeText || !store?.writeBuffer) throw new DiagramError('store_missing', 'A diagram store is required for export.', 'FAILED')

  const svg = renderSVG(ir)
  const svgCheck = verifySvgArtifact(svg, { width: ir.layout.width, height: ir.layout.height })
  if (svgCheck.status === 'FAILED') {
    throw new DiagramError('svg_invalid', 'Generated SVG failed structural verification.', 'FAILED', { errors: svgCheck.errors })
  }

  const needsRaster = requested.includes('png') || requested.includes('pdf')
  let rendered = { png: null, pdf: null }
  if (needsRaster) {
    rendered = await exportWithChromium(svg, {
      width: ir.layout.width,
      height: ir.layout.height,
      formats: requested.filter(format => format === 'png' || format === 'pdf'),
      scale: scale ?? ir.style?.scale ?? 2,
      chromiumPath,
      htmlTitle: ir.title,
    })
  }

  const verifications = [{ format: 'svg', ...svgCheck }]
  if (requested.includes('png')) {
    if (!rendered.png) throw new DiagramError('png_missing', 'The PNG renderer returned no data.', 'FAILED')
    verifications.push({ format: 'png', ...verifyPngArtifact(rendered.png, { width: ir.layout.width, height: ir.layout.height, headerHeight: ir.layout.header?.height ?? 0, scale: rendered.scale ?? scale ?? ir.style?.scale ?? 2 }) })
  }
  if (requested.includes('pdf')) {
    if (!rendered.pdf) throw new DiagramError('pdf_missing', 'The PDF renderer returned no data.', 'FAILED')
    verifications.push({ format: 'pdf', ...(await verifyPdfArtifact(rendered.pdf, { width: ir.layout.width, height: ir.layout.height })) })
  }
  const failed = verifications.filter(item => item.status === 'FAILED')
  if (failed.length) {
    throw new DiagramError('artifact_verification_failed', 'One or more artifacts failed verification.', 'FAILED', { verifications: failed })
  }

  const suffix = `${stamp()}-${crypto.randomBytes(3).toString('hex')}`
  const artifacts = []
  const cleanup = []
  try {
    for (const format of requested) {
      const buffer = format === 'svg' ? Buffer.from(svg, 'utf8') : rendered[format]
      const filename = `${ir.diagram_id}-r${ir.revision}-${suffix}.${format}`
      const target = format === 'svg'
        ? await store.writeText(ir.diagram_id, filename, svg)
        : await store.writeBuffer(ir.diagram_id, filename, buffer)
      cleanup.push(target)
      const stat = await fs.stat(target)
      if (!stat.isFile() || stat.size !== buffer.length) {
        throw new DiagramError('artifact_write_failed', `Artifact ${filename} was written with an unexpected size.`, 'FAILED')
      }
      artifacts.push({
        format,
        mime: MIME[format],
        path: target,
        relative_path: relativeTo(store.workspaceRoot, target),
        bytes: stat.size,
        sha256: sha256(buffer),
        status: 'VERIFIED',
      })
    }
  } catch (error) {
    await Promise.all(cleanup.map(file => fs.rm(file, { force: true }).catch(() => {})))
    throw error
  }

  return {
    artifacts,
    verifications,
    checks: verifications.map(item => ({ id: `artifact_${item.format}`, status: item.status, detail: `${item.format.toUpperCase()} artifact verification ${item.status.toLowerCase()}.` })),
    warnings: verifications.flatMap(item => (item.warnings ?? []).map(warning => ({ format: item.format, ...warning }))),
  }
}

export function artifactBasename(ir, format) {
  return `${ir.diagram_id}-r${ir.revision}.${format}`
}

export { normalizeFormats }
