/**
 * Recursive storage scanner used by the Storage insights plugin.
 *
 * It walks one folder once, records the largest files anywhere below it, and
 * totals the recursive size of each immediate child folder. Symlinks are never
 * followed, unreadable entries are skipped, and the walk stops early when the
 * entry budget is exhausted so a huge folder cannot pin the Host forever.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

const MAX_DEPTH = 24
const MAX_ENTRIES = 200_000
const MAX_QUEUED_DIRECTORIES = 20_000
const MAX_DIR_CONCURRENCY = 8
const STAT_BATCH = 24

/**
 * Fixed-size top-N collector. Keeping only the winners bounds memory even when
 * the scanned tree contains hundreds of thousands of files.
 */
function createTopList(limit) {
  const items = []
  return {
    add(item) {
      if (limit <= 0) return
      if (items.length < limit) {
        items.push(item)
        return
      }
      let smallest = 0
      for (let index = 1; index < items.length; index += 1) {
        if (items[index].size < items[smallest].size) smallest = index
      }
      if (item.size > items[smallest].size) items[smallest] = item
    },
    values() {
      return items
        .slice()
        .sort((left, right) => right.size - left.size || left.path.localeCompare(right.path))
    },
  }
}

function joinRelative(parent, name) {
  return parent === '' ? name : `${parent}/${name}`
}

function addFile(state, relativePath, size, bucket) {
  if (state.stop) return
  state.totalBytes += size
  state.fileCount += 1
  state.visited += 1
  if (bucket !== null) bucket.size += size
  state.files.add({ path: relativePath, size })
  if (state.visited >= MAX_ENTRIES) {
    state.truncated = true
    state.stop = true
  }
}

function enqueueDirectory(state, item) {
  if (state.stop) return
  state.visited += 1
  if (state.visited >= MAX_ENTRIES || state.queue.length >= MAX_QUEUED_DIRECTORIES) {
    state.truncated = true
    state.stop = true
    return
  }
  state.queue.push(item)
}

async function processDirectory(state, item) {
  if (state.stop) return
  if (state.signal !== undefined && state.signal.aborted) {
    state.aborted = true
    state.stop = true
    return
  }

  let entries
  try {
    entries = await fs.readdir(item.directory, { withFileTypes: true })
  } catch {
    state.skipped += 1
    return
  }
  state.foldersScanned += 1

  const childDirectories = []
  const childFiles = []
  for (const entry of entries) {
    if (state.stop) break
    if (entry.isSymbolicLink()) {
      state.skipped += 1
      continue
    }
    if (entry.isDirectory()) {
      if (item.depth >= MAX_DEPTH) {
        state.skipped += 1
        continue
      }
      childDirectories.push(entry.name)
      continue
    }
    if (entry.isFile()) {
      childFiles.push(entry.name)
      continue
    }
    state.skipped += 1
  }

  for (const name of childDirectories) {
    enqueueDirectory(state, {
      directory: path.join(item.directory, name),
      relative: joinRelative(item.relative, name),
      bucket: item.bucket,
      depth: item.depth + 1,
    })
  }

  for (let offset = 0; offset < childFiles.length; offset += STAT_BATCH) {
    if (state.stop) break
    const batch = childFiles.slice(offset, offset + STAT_BATCH)
    const sizes = await Promise.all(batch.map(async (name) => {
      try {
        const stat = await fs.lstat(path.join(item.directory, name))
        return stat.isFile() ? stat.size : undefined
      } catch {
        return undefined
      }
    }))
    for (let index = 0; index < batch.length; index += 1) {
      const size = sizes[index]
      if (size === undefined) {
        state.skipped += 1
        continue
      }
      addFile(state, joinRelative(item.relative, batch[index]), size, item.bucket)
    }
  }
}

function drain(state) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const schedule = () => {
      if (settled) return
      if (state.signal !== undefined && state.signal.aborted) {
        state.aborted = true
        state.stop = true
      }
      while (state.active < MAX_DIR_CONCURRENCY && !state.stop && state.queue.length > 0) {
        const item = state.queue.pop()
        state.active += 1
        processDirectory(state, item).then(() => {
          state.active -= 1
          schedule()
        }, (error) => {
          if (settled) return
          settled = true
          reject(error)
        })
      }
      if (state.active === 0 && (state.stop || state.queue.length === 0)) finish()
    }
    schedule()
  })
}

/**
 * Scan a folder and return its top files and immediate child folders by size.
 *
 * @param {string} root - absolute folder to scan.
 * @param {{ limit?: number, signal?: AbortSignal }} [options] - result limit and cancellation.
 * @returns {Promise<object>} totals plus the largest files and folders.
 */
export async function scanDirectory(root, options = {}) {
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 10)))
  const signal = options.signal
  const startedAt = Date.now()

  let stat
  try {
    stat = await fs.stat(root)
  } catch {
    throw new Error(`Folder does not exist: ${root}`)
  }
  if (!stat.isDirectory()) throw new Error(`Not a folder: ${root}`)

  const state = {
    signal,
    totalBytes: 0,
    fileCount: 0,
    foldersScanned: 0,
    skipped: 0,
    visited: 0,
    truncated: false,
    aborted: false,
    stop: false,
    queue: [],
    active: 0,
    buckets: new Map(),
    files: createTopList(limit),
  }

  let rootEntries
  try {
    rootEntries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    throw new Error(`Folder cannot be read: ${root}`)
  }

  const rootFiles = []
  for (const entry of rootEntries) {
    if (signal !== undefined && signal.aborted) {
      state.aborted = true
      state.stop = true
      break
    }
    if (entry.isSymbolicLink()) {
      state.skipped += 1
      continue
    }
    if (entry.isDirectory()) {
      const bucket = { path: entry.name, size: 0 }
      state.buckets.set(entry.name, bucket)
      enqueueDirectory(state, {
        directory: path.join(root, entry.name),
        relative: entry.name,
        bucket,
        depth: 0,
      })
      continue
    }
    if (entry.isFile()) {
      rootFiles.push(entry.name)
      continue
    }
    state.skipped += 1
  }

  for (const name of rootFiles) {
    if (state.stop) break
    let size
    try {
      const fileStat = await fs.lstat(path.join(root, name))
      if (fileStat.isFile()) size = fileStat.size
    } catch {
      size = undefined
    }
    if (size === undefined) {
      state.skipped += 1
      continue
    }
    addFile(state, name, size, null)
  }

  await drain(state)

  const directories = Array.from(state.buckets.values())
    .filter((bucket) => bucket.size > 0)
    .sort((left, right) => right.size - left.size || left.path.localeCompare(right.path))
    .slice(0, limit)

  return {
    root,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    totals: {
      bytes: state.totalBytes,
      files: state.fileCount,
      folders: state.foldersScanned,
      skipped: state.skipped,
    },
    files: state.files.values(),
    directories,
    truncated: state.truncated || state.aborted,
    aborted: state.aborted,
  }
}
