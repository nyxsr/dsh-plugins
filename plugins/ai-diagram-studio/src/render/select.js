/** Renderer capability discovery and deterministic selection. */
import fs from 'node:fs'
import path from 'node:path'
import { DIAGRAM_TYPES } from '../ir/index.js'
import { findChromium } from './chromium.js'

function commandOnPath(command) {
  const entries = String(process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  for (const directory of entries) {
    const candidate = path.join(directory, command)
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch { /* keep looking */ }
  }
  return null
}

export function discoverRenderers() {
  let chromium = null
  try { chromium = findChromium() } catch { chromium = null }
  return [
    {
      name: 'native-svg',
      kind: 'internal',
      available: true,
      diagram_types: [...DIAGRAM_TYPES],
      exports: ['svg', 'png', 'pdf'],
      note: 'Deterministic SVG from the canonical IR; Chromium supplies raster/PDF projection.',
    },
    { name: 'graphviz', kind: 'external', available: Boolean(commandOnPath('dot')), diagram_types: ['flowchart', 'erd'], exports: ['svg', 'png', 'pdf'], note: 'Optional; not used unless explicitly selected in a future release.' },
    { name: 'mermaid-cli', kind: 'external', available: Boolean(commandOnPath('mmdc')), diagram_types: ['flowchart', 'sequence', 'uml_class', 'erd'], exports: ['svg', 'png', 'pdf'], note: 'Optional; not used unless explicitly selected in a future release.' },
    { name: 'plantuml', kind: 'external', available: Boolean(commandOnPath('plantuml')), diagram_types: ['uml_class', 'uml_usecase', 'uml_activity', 'uml_state', 'sequence'], exports: ['svg', 'png'], note: 'Optional; not used unless explicitly selected in a future release.' },
    { name: 'chromium', kind: 'raster-backend', available: Boolean(chromium), path: chromium, diagram_types: [...DIAGRAM_TYPES], exports: ['png', 'pdf'], note: 'Headless Chromium CDP used to rasterize and print the SVG.' },
  ]
}

export function selectRenderer(ir) {
  const candidates = discoverRenderers()
  const native = candidates.find(item => item.name === 'native-svg')
  const raster = candidates.find(item => item.name === 'chromium')
  return {
    selected: 'native-svg',
    projection: raster?.available ? 'chromium' : null,
    reason: 'Native SVG is the only renderer verified for every supported diagram family; it keeps the IR as the source of truth and avoids external syntax drift.',
    candidates,
    capabilities: {
      supported_types: native.diagram_types,
      vector: true,
      raster: Boolean(raster?.available),
      pdf: Boolean(raster?.available),
      themes: ['professional', 'light', 'dark', 'monochrome'],
      notation: ir.notation,
    },
    fallback: raster?.available
      ? 'If Chromium is unavailable, SVG export still works and PNG/PDF return a renderer_unavailable error.'
      : 'SVG export remains available; PNG/PDF cannot be produced without Chromium.',
  }
}
