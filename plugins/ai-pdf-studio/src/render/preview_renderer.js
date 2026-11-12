/** Rasterize PDF pages to PNG previews with Poppler. */
import { mkdir, readFile, readdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { runChecked } from '../core/process.js'
import { StudioError } from '../core/errors.js'

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

/**
 * @param {{pdfPath:string, outputDir:string, dpi?:number}} args
 */
export async function previewPdf({ pdfPath, outputDir, dpi = 110 }) {
  await mkdir(outputDir, { recursive: true })
  const existing = await readdir(outputDir).catch(() => [])
  await Promise.all(existing.filter(file => /^(page-\d+|preview-\d+)\.png$/.test(file)).map(file => unlink(path.join(outputDir, file))))
  const prefix = path.join(outputDir, 'preview')
  try {
    await runChecked('pdftoppm', ['-png', '-r', String(dpi), '-aa', 'yes', '-aaVector', 'yes', pdfPath, prefix], { timeoutMs: 90000 })
  } catch (error) {
    throw new StudioError('preview_failed', 'Tidak berhasil merasterisasi halaman PDF dengan pdftoppm.', {
      cause: error,
      details: error.details ?? null,
    })
  }
  const files = (await readdir(outputDir))
    .filter(file => /^preview-\d+\.png$/.test(file))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]))
  if (files.length === 0) throw new StudioError('preview_failed', 'pdftoppm tidak menghasilkan gambar halaman.')
  const previews = []
  for (const [index, file] of files.entries()) {
    const source = path.join(outputDir, file)
    const target = path.join(outputDir, `page-${String(index + 1).padStart(2, '0')}.png`)
    await rename(source, target)
    const bytes = await readFile(target)
    const size = pngSize(bytes)
    previews.push({
      page_number: index + 1,
      path: target,
      width: size?.width ?? null,
      height: size?.height ?? null,
      dpi,
      bytes: bytes.byteLength,
    })
  }
  return { preview_paths: previews.map(preview => preview.path), previews, page_count: previews.length, dpi }
}
