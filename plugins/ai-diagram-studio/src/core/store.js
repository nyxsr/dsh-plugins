/**
 * Workspace-persistent canonical diagram store.
 *
 * The IR is the source of truth. Rendered SVG/PNG/PDF files are disposable
 * projections that can always be regenerated from the saved IR.
 */
import { randomBytes } from 'node:crypto'
import { mkdir, open, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DiagramError } from './errors.js'
import { assertInside, ensureDir, sanitizeDiagramId } from './paths.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function atomicWrite(file, data) {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  try {
    await writeFile(temporary, data, 'utf8')
    await rename(temporary, file)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

async function exists(file) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

export class DiagramStore {
  constructor({ workspaceRoot, root = '.diagram-studio' }) {
    this.workspaceRoot = path.resolve(workspaceRoot)
    this.root = path.resolve(this.workspaceRoot, root)
    this.diagramsDir = path.join(this.root, 'diagrams')
    this.lockDir = path.join(this.root, '.locks')
    this.registryFile = path.join(this.root, 'registry.json')
  }

  async init() {
    await ensureDir(this.diagramsDir)
    await ensureDir(this.lockDir)
    if (!(await exists(this.registryFile))) {
      await atomicWrite(this.registryFile, JSON.stringify({ version: 1, diagrams: [] }, null, 2))
    }
    return this
  }

  diagramDir(id) {
    return path.join(this.diagramsDir, sanitizeDiagramId(id))
  }

  irPath(id) {
    return path.join(this.diagramDir(id), 'diagram.ir.json')
  }

  historyDir(id) {
    return path.join(this.diagramDir(id), 'history')
  }

  exportDir(id) {
    return path.join(this.diagramDir(id), 'exports')
  }

  async withLock(key, callback, timeoutMs = 10_000) {
    await ensureDir(this.lockDir)
    const file = path.join(this.lockDir, `${String(key).replace(/[^A-Za-z0-9_-]/g, '_')}.lock`)
    const deadline = Date.now() + timeoutMs
    let handle
    while (!handle) {
      try {
        handle = await open(file, 'wx')
        await handle.writeFile(JSON.stringify({ pid: process.pid, at: Date.now() }))
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error
        try {
          const info = JSON.parse(await readFile(file, 'utf8'))
          if (Date.now() - Number(info.at ?? 0) > 60_000) await unlink(file).catch(() => {})
        } catch {
          await unlink(file).catch(() => {})
        }
        if (Date.now() >= deadline) {
          throw new DiagramError('store_busy', 'The diagram store is busy; retry the operation.', {
            details: { lock: path.basename(file) },
          })
        }
        await sleep(35)
      }
    }
    try {
      return await callback()
    } finally {
      await handle.close().catch(() => {})
      await unlink(file).catch(() => {})
    }
  }

  async readRegistry() {
    await this.init()
    try {
      const parsed = JSON.parse(await readFile(this.registryFile, 'utf8'))
      if (!parsed || !Array.isArray(parsed.diagrams)) throw new Error('invalid registry')
      return parsed
    } catch (error) {
      throw new DiagramError('store_corrupt', 'The diagram registry could not be read.', {
        cause: error,
        details: { registry: this.registryFile },
      })
    }
  }

  async list() {
    const registry = await this.readRegistry()
    return registry.diagrams.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
  }

  async latest() {
    const all = await this.list()
    return all[0] ?? null
  }

  async create(ir) {
    const id = sanitizeDiagramId(ir.diagram_id)
    return this.withLock(`diagram-${id}`, async () => {
      await this.init()
      if (await exists(this.irPath(id))) {
        throw new DiagramError('diagram_exists', `Diagram ${id} already exists.`, { details: { diagram_id: id } })
      }
      await ensureDir(this.diagramDir(id))
      await ensureDir(this.exportDir(id))
      await ensureDir(this.historyDir(id))
      await atomicWrite(this.irPath(id), JSON.stringify(ir, null, 2))
      const registry = await this.readRegistry()
      registry.diagrams = registry.diagrams.filter(item => item.id !== id)
      registry.diagrams.push(this.summary(ir))
      await atomicWrite(this.registryFile, JSON.stringify(registry, null, 2))
      return ir
    })
  }

  async load(id) {
    const safe = sanitizeDiagramId(id)
    let raw
    try {
      raw = await readFile(this.irPath(safe), 'utf8')
    } catch (error) {
      throw new DiagramError('diagram_not_found', `Diagram ${safe} was not found in this workspace.`, {
        cause: error,
        details: { diagram_id: safe, workspace: this.workspaceRoot },
      })
    }
    try {
      return JSON.parse(raw)
    } catch (error) {
      throw new DiagramError('diagram_corrupt', `Diagram ${safe} contains invalid JSON.`, {
        cause: error,
        details: { diagram_id: safe },
      })
    }
  }

  /** Save a revision, archiving the previous IR before replacing it. */
  async save(ir, { changeSummary = [] } = {}) {
    const id = sanitizeDiagramId(ir.diagram_id)
    return this.withLock(`diagram-${id}`, async () => {
      const previous = await this.load(id)
      await ensureDir(this.historyDir(id))
      await atomicWrite(
        path.join(this.historyDir(id), `revision-${String(previous.revision ?? 1).padStart(4, '0')}.json`),
        JSON.stringify(previous, null, 2),
      )
      const next = {
        ...ir,
        revision: Number(previous.revision ?? 1) + 1,
        parent_revision: Number(previous.revision ?? 1),
        updated_at: new Date().toISOString(),
        revision_changes: Array.isArray(changeSummary) ? changeSummary.slice(0, 40) : [],
      }
      await atomicWrite(this.irPath(id), JSON.stringify(next, null, 2))
      const registry = await this.readRegistry()
      registry.diagrams = registry.diagrams.filter(item => item.id !== id)
      registry.diagrams.push(this.summary(next))
      await atomicWrite(this.registryFile, JSON.stringify(registry, null, 2))
      return next
    })
  }

  async revisions(id) {
    const safe = sanitizeDiagramId(id)
    let files = []
    try {
      files = await readdir(this.historyDir(safe))
    } catch {
      return []
    }
    return files.filter(name => /^revision-\d+\.json$/.test(name)).sort().map(name => ({
      revision: Number(name.match(/\d+/)?.[0] ?? 0),
      path: path.join(this.historyDir(safe), name),
    }))
  }

  summary(ir) {
    return {
      id: ir.diagram_id,
      type: ir.diagram_type,
      title: ir.title,
      revision: ir.revision ?? 1,
      created_at: ir.created_at,
      updated_at: ir.updated_at,
      node_count: Array.isArray(ir.nodes) ? ir.nodes.length : 0,
      edge_count: Array.isArray(ir.edges) ? ir.edges.length : 0,
    }
  }

  async artifactPath(id, filename) {
    const directory = this.exportDir(id)
    await ensureDir(directory)
    const target = path.resolve(directory, String(filename ?? ''))
    assertInside(directory, target, 'artifact_path_unsafe')
    return target
  }

  async writeBuffer(id, filename, buffer) {
    const target = await this.artifactPath(id, filename)
    await writeFile(target, buffer)
    return target
  }

  async writeText(id, filename, text) {
    const target = await this.artifactPath(id, filename)
    await atomicWrite(target, text)
    return target
  }
}
