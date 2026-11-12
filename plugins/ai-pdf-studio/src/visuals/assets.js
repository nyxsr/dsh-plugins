/**
 * Safe local asset loading.
 *
 * Remote URLs are rejected by default, paths must stay inside an approved
 * root, SVG is sanitized, and every asset is embedded as a data URI so the
 * exported HTML/PDF is self-contained.
 */
import { access, readFile, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { StudioError } from '../core/errors.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const PACKAGE_ROOT = path.resolve(HERE, '../..')

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
}
const MAX_ASSET_BYTES = 8 * 1024 * 1024
const cache = new Map()

function isInside(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function sanitizeSvg(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*(https?:)?\/\/[^"']*\2/gi, '')
}

/**
 * @param {string} src
 * @param {{workspaceRoot?: string, baseDir?: string, allowRemote?: boolean}} options
 * @returns {Promise<{src:string, mime:string, bytes:number, resolvedPath:string|null, kind:string}>}
 */
export async function resolveAsset(src, options = {}) {
  const raw = String(src ?? '').trim()
  if (!raw) throw new StudioError('asset_missing', 'Sumber gambar kosong.')
  if (raw.startsWith('data:')) {
    const match = raw.match(/^data:([a-zA-Z0-9/+.-]+);base64,([\s\S]+)$/)
    if (!match) throw new StudioError('asset_invalid', 'Gambar yang ditanam hanya menerima data URI base64.')
    const mime = match[1].toLowerCase()
    if (!Object.values(MIME).includes(mime)) throw new StudioError('asset_unsafe', `Tipe gambar data URI tidak didukung: ${mime}`)
    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.byteLength > MAX_ASSET_BYTES) throw new StudioError('asset_too_large', 'Gambar yang ditanam melebihi 8 MiB.')
    if (mime === 'image/svg+xml') {
      const sanitized = sanitizeSvg(buffer.toString('utf8'))
      return { src: `data:image/svg+xml;base64,${Buffer.from(sanitized).toString('base64')}`, mime, bytes: Buffer.byteLength(sanitized), resolvedPath: null, kind: 'svg' }
    }
    return { src: raw, mime, bytes: buffer.byteLength, resolvedPath: null, kind: 'raster' }
  }
  if (/^(https?:|ftp:|file:)/i.test(raw)) {
    if (options.allowRemote) throw new StudioError('asset_remote_unsupported', 'Pemuatan gambar dari jarak jauh belum ada. Unduh asetnya ke workspace dulu.')
    throw new StudioError('asset_unsafe', 'URL aset jarak jauh dan skema file diblokir. Pakai berkas lokal relatif terhadap workspace.')
  }
  const roots = [options.baseDir, options.workspaceRoot, PACKAGE_ROOT].filter(Boolean).map(value => path.resolve(value))
  let resolved
  let resolvedRoot
  for (const root of roots) {
    const candidate = path.resolve(root, raw)
    const inside = roots.some(allowed => isInside(allowed, candidate))
    if (!inside) continue
    try {
      await access(candidate, constants.R_OK)
      const info = await stat(candidate)
      if (!info.isFile()) continue
      resolved = candidate
      resolvedRoot = root
      break
    } catch { /* try next root */ }
  }
  if (!resolved) {
    throw new StudioError('asset_not_found', `Gambar tidak ditemukan di dalam root yang diizinkan: ${raw}`, {
      details: { roots, allowRemote: Boolean(options.allowRemote) },
    })
  }
  if (!isInside(resolvedRoot, resolved)) throw new StudioError('asset_unsafe', 'Aset keluar dari root yang diizinkan.')
  const ext = path.extname(resolved).toLowerCase()
  const mime = MIME[ext]
  if (!mime) throw new StudioError('asset_unsafe', `Ekstensi gambar tidak didukung: ${ext || '(none)'}`)
  const key = `${resolved}:${mime}`
  if (cache.has(key)) return cache.get(key)
  const original = await readFile(resolved)
  if (original.byteLength > MAX_ASSET_BYTES) throw new StudioError('asset_too_large', `Aset melebihi 8 MiB: ${raw}`)
  let buffer = original
  if (mime === 'image/svg+xml') buffer = Buffer.from(sanitizeSvg(original.toString('utf8')))
  const value = {
    src: `data:${mime};base64,${buffer.toString('base64')}`,
    mime,
    bytes: buffer.byteLength,
    resolvedPath: resolved,
    kind: mime === 'image/svg+xml' ? 'svg' : 'raster',
  }
  cache.set(key, value)
  return value
}

export function clearAssetCache() {
  cache.clear()
}
