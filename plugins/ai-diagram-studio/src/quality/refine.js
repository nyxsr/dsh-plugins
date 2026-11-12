/**
 * Bounded, semantic-preserving layout refinement.
 *
 * Refinement only changes style/layout inputs and recomputes `ir.layout`.
 * Nodes, attributes, relationships and constraints are never edited.
 */
import { canonicalJSON, cloneIR } from '../ir/index.js'
import { layoutDiagram } from '../layout/index.js'
import { inspectLayout } from './layout.js'

const DENSITY_STEPS = ['compact', 'comfortable', 'spacious']

function nextDensity(value, steps = 1) {
  const index = DENSITY_STEPS.indexOf(value)
  return DENSITY_STEPS[Math.min(DENSITY_STEPS.length - 1, Math.max(0, index) + steps)]
}

function scoreOf(inspection) {
  // Hard errors dominate; warnings and crossings break ties.
  const warnings = inspection.warnings.length
  return inspection.errors.length * 10_000 + warnings * 100 + (inspection.stats?.crossings ?? 0)
}

function hardFailure(inspection) {
  return inspection.errors.some(error => ['layout_node_overlap', 'layout_node_bounds', 'layout_missing', 'layout_empty'].includes(error.code))
}

function semanticFingerprint(ir) {
  return canonicalJSON({
    diagram_type: ir.diagram_type,
    title: ir.title,
    language: ir.language,
    notation: ir.notation,
    nodes: ir.nodes,
    edges: ir.edges,
    groups: ir.groups,
    frames: ir.frames,
    constraints: ir.constraints,
    assumptions: ir.assumptions,
  })
}

/**
 * @param {object} input Diagram IR.
 * @param {{maxAttempts?: number, orientation?: string, density?: string}} [options]
 * @returns {{ir: object, attempts: object[], refined: boolean, semanticFingerprint: string, report: object}}
 */
export function refineLayout(input, options = {}) {
  const maxAttempts = Math.max(0, Math.min(5, Number(options.maxAttempts ?? 3)))
  const semanticBefore = semanticFingerprint(input)
  let current = layoutDiagram(input)
  let inspection = inspectLayout(current)
  const attempts = []
  const initial = {
    status: inspection.status,
    score: scoreOf(inspection),
    density: current.style?.layout_density,
    orientation: current.style?.orientation,
  }
  let best = { ir: current, inspection, score: scoreOf(inspection) }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (!hardFailure(inspection)) break
    const candidates = []
    const baseDensity = current.layout?.density ?? 'comfortable'
    const baseOrientation = current.style?.orientation ?? 'auto'
    const boosted = nextDensity(baseDensity, 1)
    if (boosted !== baseDensity) candidates.push({ density: boosted, orientation: baseOrientation, reason: 'increase_spacing' })
    if (baseOrientation === 'auto') {
      const direction = current.layout?.direction
      candidates.push({ density: baseDensity, orientation: direction === 'TB' ? 'landscape' : 'portrait', reason: 'toggle_orientation' })
    }
    candidates.push({ density: 'spacious', orientation: baseOrientation === 'auto' ? (current.layout?.direction === 'TB' ? 'landscape' : 'portrait') : baseOrientation, reason: 'maximum_spacing' })

    let improved = null
    for (const candidate of candidates) {
      const clone = cloneIR(current)
      clone.style = { ...clone.style, layout_density: candidate.density, orientation: candidate.orientation }
      let laidOut
      try {
        laidOut = layoutDiagram(clone)
      } catch (error) {
        attempts.push({ attempt, ...candidate, status: 'FAILED', error: error.message })
        continue
      }
      const result = inspectLayout(laidOut)
      const score = scoreOf(result)
      const record = {
        attempt,
        reason: candidate.reason,
        density: candidate.density,
        orientation: candidate.orientation,
        status: result.status,
        score,
        errors: result.errors.map(item => item.code),
        warnings: result.warnings.map(item => item.code),
      }
      attempts.push(record)
      if (!improved || score < improved.score || (score === improved.score && result.errors.length < improved.inspection.errors.length)) {
        improved = { ir: laidOut, inspection: result, score, record }
      }
      if (!hardFailure(result)) break
    }
    if (!improved) break
    current = improved.ir
    inspection = improved.inspection
    if (improved.score < best.score) best = improved
    if (!hardFailure(inspection)) break
  }

  const semanticAfter = semanticFingerprint(current)
  return {
    ir: current,
    attempts,
    refined: attempts.length > 0,
    semanticPreserved: semanticBefore === semanticAfter,
    report: {
      initial,
      final: {
        status: inspection.status,
        score: scoreOf(inspection),
        density: current.style?.layout_density,
        orientation: current.style?.orientation,
        direction: current.layout?.direction,
      },
      attempts,
      semanticPreserved: semanticBefore === semanticAfter,
    },
  }
}
