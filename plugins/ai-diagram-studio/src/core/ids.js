import { randomBytes } from 'node:crypto'
import { slug } from './text.js'

export function shortId(prefix = 'id') {
  return `${prefix}-${randomBytes(4).toString('hex')}`
}

export function diagramId(type, title) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const suffix = randomBytes(3).toString('hex')
  return `dg-${slug(type || 'diagram', 'diagram', 20)}-${slug(title || 'untitled', 'untitled', 28)}-${stamp}-${suffix}`
}

export function nodeId(base, used = new Set()) {
  const root = `n-${slug(base, 'node', 32)}`
  let candidate = root
  let index = 2
  while (used.has(candidate)) {
    candidate = `${root}-${index}`
    index += 1
  }
  used.add(candidate)
  return candidate
}

export function edgeId(base, used = new Set()) {
  const root = `e-${slug(base, 'edge', 34)}`
  let candidate = root
  let index = 2
  while (used.has(candidate)) {
    candidate = `${root}-${index}`
    index += 1
  }
  used.add(candidate)
  return candidate
}
