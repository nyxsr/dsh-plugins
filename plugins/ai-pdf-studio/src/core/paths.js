/** Safe path resolution for outputs, inputs, and assets. */
import path from 'node:path'
import { mkdir, stat } from 'node:fs/promises'
import { StudioError } from './errors.js'

export function isInside(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function assertInside(root, candidate, code = 'path_unsafe') {
  if (!isInside(path.resolve(root), path.resolve(candidate))) {
    throw new StudioError(code, 'Path hasil resolusi keluar dari root yang diizinkan.', {
      details: { root: path.resolve(root), candidate: path.resolve(candidate) },
    })
  }
  return path.resolve(candidate)
}

export function sanitizeFilename(value, fallback = 'document') {
  const base = String(value ?? '').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 90)
  return base || fallback
}

export function sanitizeDocumentId(value, fallback = 'document') {
  return String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || fallback
}

/**
 * @param {{workspaceRoot:string, outputRoot?:string, outputDir?:string, documentId:string}} args
 */
export async function resolveOutputDir({ workspaceRoot, outputRoot = 'outputs', outputDir, documentId }) {
  const workspace = path.resolve(workspaceRoot)
  const configuredRoot = path.resolve(workspace, outputRoot)
  const requested = outputDir
    ? path.resolve(workspace, outputDir)
    : path.join(configuredRoot, sanitizeDocumentId(documentId))
  assertInside(workspace, requested, 'output_outside_workspace')
  await mkdir(requested, { recursive: true })
  return requested
}

export async function resolveInputFile(workspaceRoot, inputPath) {
  const workspace = path.resolve(workspaceRoot)
  const requested = path.resolve(workspace, inputPath)
  assertInside(workspace, requested, 'input_outside_workspace')
  try {
    const info = await stat(requested)
    if (!info.isFile()) throw new Error('bukan berkas')
  } catch (error) {
    throw new StudioError('input_not_found', `Berkas input tidak ada di dalam workspace: ${inputPath}`, {
      cause: error, details: { workspace, requested },
    })
  }
  return requested
}

export async function ensureFile(pathValue, code = 'file_not_found') {
  try {
    const info = await stat(pathValue)
    if (!info.isFile()) throw new Error('bukan berkas')
    return info
  } catch (error) {
    throw new StudioError(code, `Berkas yang dibutuhkan tidak ditemukan: ${pathValue}`, { cause: error })
  }
}
