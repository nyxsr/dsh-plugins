/** Safe path resolution for diagram inputs, outputs, and exports. */
import path from 'node:path'
import { mkdir, stat } from 'node:fs/promises'
import { DiagramError } from './errors.js'
import { slug } from './text.js'

export function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function assertInside(root, candidate, code = 'path_unsafe') {
  if (!isInside(path.resolve(root), path.resolve(candidate))) {
    throw new DiagramError(code, 'Resolved path escapes the approved workspace root.', {
      details: { root: path.resolve(root), candidate: path.resolve(candidate) },
    })
  }
  return path.resolve(candidate)
}

export function sanitizeFilename(value, fallback = 'diagram') {
  const base = String(value ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 110)
  return base || fallback
}

export function sanitizeDiagramId(value) {
  const id = String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 90)
  if (!id || id !== value) {
    throw new DiagramError('invalid_diagram_id', 'diagram_id may contain only letters, digits, underscore, and hyphen.', {
      details: { value: String(value ?? '').slice(0, 120) },
    })
  }
  return id
}

export async function ensureDir(directory) {
  await mkdir(directory, { recursive: true })
  return directory
}

export async function resolveOutputDir({ workspaceRoot, outputRoot = '.diagram-studio', outputDir, diagramId }) {
  const workspace = path.resolve(workspaceRoot)
  const requested = outputDir
    ? assertInside(workspace, path.resolve(workspace, outputDir), 'output_outside_workspace')
    : path.join(workspace, outputRoot, 'diagrams', sanitizeFilename(slug(diagramId), 'diagram'))
  await ensureDir(requested)
  return requested
}

export async function resolveWorkspaceFile(workspaceRoot, inputPath, { mustExist = true, code = 'input_outside_workspace' } = {}) {
  const workspace = path.resolve(workspaceRoot)
  const requested = assertInside(workspace, path.resolve(workspace, String(inputPath ?? '')), code)
  if (!mustExist) return requested
  let info
  try {
    info = await stat(requested)
  } catch (error) {
    throw new DiagramError('input_not_found', `File does not exist inside the workspace: ${inputPath}`, {
      cause: error,
      details: { workspace, requested },
    })
  }
  if (!info.isFile()) {
    throw new DiagramError('input_not_file', `Path is not a regular file: ${inputPath}`, { details: { requested } })
  }
  return requested
}

export function relativeTo(workspaceRoot, filePath) {
  return path.relative(path.resolve(workspaceRoot), path.resolve(filePath)).split(path.sep).join('/')
}
