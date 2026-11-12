/**
 * Orchestration service for AI Diagram Studio.
 *
 * Pipeline: GENERATE -> VALIDATE -> LAYOUT/REFINE -> RENDER -> INSPECT ->
 * EXPORT -> VERIFY. Semantic data is never changed to fix appearance.
 */
import { DiagramError, asDiagramError } from '../core/errors.js'
import { clean, oneLine } from '../core/text.js'
import { diagramId } from '../core/ids.js'
import { DiagramStore } from '../core/store.js'
import { DIAGRAM_LABELS, DIAGRAM_TYPES, IR_VERSION, emptyIR, normalizeIR } from '../ir/index.js'
import { detectDiagramType, detectLanguage, extractTitle, normalizeType } from '../parse/detect.js'
import { parseERD } from '../parse/erd.js'
import { parseFlow } from '../parse/flow.js'
import { parseClass } from '../parse/class.js'
import { parseUseCase } from '../parse/usecase.js'
import { parseState } from '../parse/state.js'
import { parseSequence } from '../parse/sequence.js'
import { parseArchitecture } from '../parse/architecture.js'
import { parseStructured } from '../parse/structured.js'
import { validateDiagram } from '../validate/semantic.js'
import { layoutDiagram } from '../layout/index.js'
import { refineLayout } from '../quality/refine.js'
import { inspectLayout } from '../quality/layout.js'
import { renderSVG } from '../render/svg.js'
import { verifySvgArtifact } from '../quality/artifacts.js'
import { exportDiagramArtifacts, normalizeFormats, OUTPUT_FORMATS } from '../render/export.js'
import { selectRenderer, discoverRenderers } from '../render/select.js'
import { applyRevision } from './revision.js'

const THEMES = ['professional', 'light', 'dark', 'monochrome']
const ORIENTATIONS = ['auto', 'portrait', 'landscape']
const DENSITIES = ['auto', 'compact', 'comfortable', 'spacious']

function parseSpecification(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'object') return value
  if (typeof value === 'string') {
    try { return JSON.parse(value) }
    catch (error) { throw new DiagramError('invalid_specification', `structured_specification is not valid JSON: ${error.message}`, 'FAILED') }
  }
  throw new DiagramError('invalid_specification', 'structured_specification must be an object.', 'FAILED')
}

function pick(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : value
}

function option(value, allowed, field, fallback) {
  const selected = pick(value, fallback)
  if (!allowed.includes(selected)) {
    throw new DiagramError('invalid_option', `${field} must be one of: ${allowed.join(', ')}.`, 'FAILED', { field, allowed })
  }
  return selected
}

function resolveUmlSubtype(requirement, spec) {
  const text = `${requirement} ${JSON.stringify(spec ?? {})}`.toLowerCase()
  if (/use\s*case|usecase|aktor|actor/.test(text)) return 'uml_usecase'
  if (/activity|aktivitas|fork|join|swimlane/.test(text)) return 'uml_activity'
  if (/state\s*machine|state diagram|statechart|status|transisi|transition/.test(text)) return 'uml_state'
  return 'uml_class'
}

function resolveType(requested, requirement, spec) {
  let normalized = normalizeType(requested || 'auto')
  if (!normalized) {
    throw new DiagramError('unsupported_type', `Unsupported diagram_type: ${requested}.`, 'FAILED', { supported: [...DIAGRAM_TYPES, 'auto'] })
  }
  if (normalized === 'uml') return { type: resolveUmlSubtype(requirement, spec), confidence: 0.8, reason: 'UML was requested; the subtype was inferred from the wording.' }
  if (normalized !== 'auto') return { type: normalized, confidence: 1, reason: 'The requested diagram_type was used.' }
  const detected = detectDiagramType(requirement, spec, 'auto')
  if (detected.type === 'uml') return { ...detected, type: resolveUmlSubtype(requirement, spec) }
  return detected
}

function parserFor(type, options) {
  switch (type) {
    case 'erd': return parseERD(options)
    case 'flowchart': return parseFlow(options)
    case 'uml_class': return parseClass(options)
    case 'uml_usecase': return parseUseCase(options)
    case 'uml_activity': return parseFlow({ ...options, activity: true })
    case 'uml_state': return parseState(options)
    case 'sequence': return parseSequence(options)
    case 'architecture': return parseArchitecture(options)
    default: throw new DiagramError('unsupported_type', `No parser exists for diagram type ${type}.`, 'FAILED')
  }
}

function parseInput({ requirement, specification, type, title, language, theme, orientation, density }) {
  const options = { requirement, title, language, theme, orientation, density }
  const parsed = specification
    ? parseStructured(specification, { ...options, diagramType: type })
    : parserFor(type, options)
  const ir = normalizeIR({
    ...parsed.ir,
    title,
    language,
    style: { theme, orientation, layout_density: density },
    source: { mode: specification ? 'structured' : 'natural_language', requirement, parser: 'rule-based-v1' },
    assumptions: [...(parsed.ir.assumptions ?? []), ...(parsed.assumptions ?? [])],
  })
  return { ...parsed, ir }
}

function warningText(value) {
  if (typeof value === 'string') return value
  return value?.message ?? value?.code ?? String(value)
}

function checksFrom(statuses) {
  return Object.entries(statuses).map(([id, status]) => ({ id, status, detail: `${id} ${status.toLowerCase()}.` }))
}

function limitationList() {
  return [
    'Visual review is programmatic (geometry, overlaps, bounds, crossing counts, and PNG pixel metrics); no human image review is claimed.',
    'External renderers (Graphviz, Mermaid CLI, PlantUML) are discovered but not used by the verified native renderer.',
    'PDF vector preservation is structural; font embedding and every PDF consumer are not independently verified.',
    'Natural-language parsing is rule-based and intentionally conservative; ambiguous input returns NEEDS_CLARIFICATION.',
  ]
}

function baseResult({ status, type, ir, title, renderer, semantic, layoutInspection, refinement, exportResult, assumptions, warnings, errors, clarifications }) {
  const semanticStatus = semantic?.status ?? 'NOT_RUN'
  const renderingStatus = exportResult ? 'PASSED' : 'NOT_RUN'
  const visualStatus = layoutInspection?.status === 'FAILED' ? 'FAILED' : layoutInspection ? 'PASSED' : 'NOT_RUN'
  const exportStatus = exportResult ? ((exportResult.verifications ?? []).every(item => item.status !== 'FAILED') ? 'PASSED' : 'FAILED') : 'NOT_RUN'
  const allWarnings = [...(warnings ?? [])]
  if (refinement?.attempts?.length) allWarnings.push(`Layout refinement made ${refinement.attempts.length} attempt(s).`)
  const validation = {
    semantic: semanticStatus,
    rendering: renderingStatus,
    visual: visualStatus,
    export: exportStatus,
  }
  const quality_report = {
    diagram_type: type,
    diagram_type_label: type ? DIAGRAM_LABELS[type] : null,
    ir_version: IR_VERSION,
    renderer: renderer ? { selected: renderer.selected, projection: renderer.projection, reason: renderer.reason } : null,
    pipeline: ['generate', 'validate', 'layout', 'render', 'inspect', 'refine', 'export', 'verify'],
    semantic: semantic ? { status: semantic.status, checks: semantic.checks, errors: semantic.errors, warnings: semantic.warnings, stats: semantic.stats } : { status: 'NOT_RUN' },
    rendering: exportResult ? { status: 'PASSED', checks: [{ id: 'svg_markup', status: 'PASSED' }] } : { status: 'NOT_RUN' },
    visual: layoutInspection ? { status: layoutInspection.status, method: 'programmatic_geometry_and_png_pixels', checks: layoutInspection.checks, errors: layoutInspection.errors, warnings: layoutInspection.warnings, stats: layoutInspection.stats, score: layoutInspection.score } : { status: 'NOT_RUN' },
    refinement: refinement ? { attempts: refinement.attempts, refined: refinement.refined, semantic_preserved: refinement.semanticPreserved, final: refinement.report?.final ?? null } : { attempts: [], refined: false },
    export: exportResult ? { status: exportStatus, artifacts: exportResult.artifacts, verifications: exportResult.verifications } : { status: 'NOT_RUN', artifacts: [] },
    quality_gate: status,
    assumptions,
    warnings: allWarnings,
    errors,
    clarifications,
    unverified_capabilities: [
      'Human visual review of the rendered image',
      'Pixel-level text legibility and font shaping review',
      'External renderer parity',
    ],
    limitations: limitationList(),
  }
  return {
    status,
    diagram_id: ir?.diagram_id ?? null,
    diagram_type: type,
    diagram_type_label: type ? DIAGRAM_LABELS[type] : null,
    title: ir?.title ?? title ?? null,
    revision: ir?.revision ?? null,
    selected_renderer: renderer?.selected ?? 'native-svg',
    artifacts: exportResult?.artifacts ?? [],
    validation,
    checks: checksFrom({ semantic: validation.semantic, rendering: validation.rendering, visual: validation.visual, export: validation.export }),
    quality_report,
    assumptions,
    warnings: allWarnings,
    errors,
    clarifications,
    diagram: ir ? {
      diagram_id: ir.diagram_id,
      diagram_type: ir.diagram_type,
      title: ir.title,
      revision: ir.revision,
      node_count: ir.nodes.length,
      edge_count: ir.edges.length,
      layout: ir.layout ? { width: ir.layout.width, height: ir.layout.height, direction: ir.layout.direction } : null,
    } : null,
  }
}

function failedResult(error, context = {}) {
  const diagramError = asDiagramError(error)
  const errors = [{ code: diagramError.code ?? 'internal_error', message: diagramError.message, details: diagramError.details ?? null }]
  return baseResult({
    status: diagramError.status ?? 'FAILED',
    type: context.type ?? null,
    ir: context.ir ?? null,
    title: context.title ?? null,
    renderer: context.renderer ?? null,
    semantic: context.semantic ?? null,
    layoutInspection: context.layoutInspection ?? null,
    refinement: context.refinement ?? null,
    exportResult: context.exportResult ?? null,
    assumptions: context.assumptions ?? [],
    warnings: context.warnings ?? [],
    errors,
    clarifications: context.clarifications ?? [],
  })
}

function clarificationResult({ type, title, clarifications, assumptions, renderer }) {
  return baseResult({
    status: 'NEEDS_CLARIFICATION',
    type,
    ir: null,
    title,
    renderer,
    semantic: null,
    layoutInspection: null,
    refinement: null,
    exportResult: null,
    assumptions,
    warnings: [],
    errors: [],
    clarifications,
  })
}

export class DiagramStudio {
  constructor({ workspaceRoot, storeRoot = '.diagram-studio', chromiumPath } = {}) {
    if (!workspaceRoot) throw new DiagramError('workspace_missing', 'A workspace root is required.', 'FAILED')
    this.workspaceRoot = workspaceRoot
    this.chromiumPath = chromiumPath
    this.store = new DiagramStore({ workspaceRoot, root: storeRoot })
  }

  async init() {
    await this.store.init()
    return this
  }

  async _prepare(request = {}, { persistTitle = true } = {}) {
    const specification = parseSpecification(request.structured_specification ?? request.specification ?? null)
    const requirement = clean(request.requirement ?? '', 4000)
    if (!requirement && !specification) {
      throw new DiagramError('requirement_missing', 'Provide a natural-language requirement or a structured specification.', 'NEEDS_CLARIFICATION')
    }
    const typeInfo = resolveType(request.diagram_type ?? 'auto', requirement, specification)
    if (!typeInfo.type) {
      return { clarification: { type: null, title: null, clarifications: [typeInfo.reason ?? 'Could not determine the intended diagram type. Name the diagram type or provide a structured specification.'] } }
    }
    const type = typeInfo.type
    const language = ['id', 'en'].includes(request.language) ? request.language : detectLanguage(`${requirement} ${JSON.stringify(specification ?? {})}`)
    const title = oneLine(pick(request.title, specification?.title ?? extractTitle(requirement, specification, DIAGRAM_LABELS[type])), 120) || DIAGRAM_LABELS[type]
    const theme = option(request.theme ?? specification?.theme, THEMES, 'theme', 'professional')
    const orientation = option(request.orientation ?? specification?.orientation, ORIENTATIONS, 'orientation', 'auto')
    const density = option(request.layout_density ?? specification?.density ?? specification?.layout_density, DENSITIES, 'layout_density', 'auto')
    const parsed = parseInput({ requirement, specification, type, title, language, theme, orientation, density })
    const assumptions = [...new Set([...(parsed.ir.assumptions ?? []), ...(parsed.assumptions ?? [])])]
    const clarifications = [...new Set(parsed.clarifications ?? [])]
    if (clarifications.length) return { clarification: { type, title, clarifications, assumptions } }
    const ir = parsed.ir
    if (persistTitle) ir.title = title
    ir.assumptions = assumptions
    return { ir, type, title, assumptions, clarifications, specification, requirement, language }
  }

  async generate(request = {}) {
    await this.init()
    let context = {}
    try {
      const prepared = await this._prepare(request)
      if (prepared.clarification) return clarificationResult({ ...prepared.clarification, assumptions: prepared.clarification.assumptions ?? [] })
      const { ir, type, title, assumptions, requirement, specification } = prepared
      ir.diagram_id = diagramId(type, title)
      ir.source = { mode: specification ? 'structured' : 'natural_language', requirement, parser: 'rule-based-v1' }
      context = { ir, type, title }
      const semantic = validateDiagram(ir)
      if (semantic.status === 'FAILED') {
        return failedResult(new DiagramError('semantic_validation_failed', 'The diagram failed semantic validation and was not rendered.', 'FAILED'), { ...context, semantic })
      }
      const refinement = refineLayout(ir, { maxAttempts: request.max_refinements ?? 3, orientation: ir.style.orientation, density: ir.style.layout_density })
      if (!refinement.semanticPreserved) {
        return failedResult(new DiagramError('refinement_changed_semantics', 'Layout refinement changed semantic content; rendering was aborted.', 'FAILED'), { ...context, semantic, refinement })
      }
      const laidOut = refinement.ir
      const layoutInspection = inspectLayout(laidOut)
      if (layoutInspection.status === 'FAILED') {
        return failedResult(new DiagramError('layout_inspection_failed', 'The diagram did not pass mandatory layout checks after refinement.', 'FAILED', { checks: layoutInspection.errors }), { ...context, semantic, layoutInspection, refinement })
      }
      const renderer = selectRenderer(laidOut)
      const svg = renderSVG(laidOut)
      const svgCheck = verifySvgArtifact(svg, { width: laidOut.layout.width, height: laidOut.layout.height })
      if (svgCheck.status === 'FAILED') {
        return failedResult(new DiagramError('svg_validation_failed', 'The rendered SVG failed structural verification.', 'FAILED', { errors: svgCheck.errors }), { ...context, semantic, layoutInspection, refinement, renderer })
      }
      const saved = await this.store.create(laidOut)
      const exportResult = await exportDiagramArtifacts({
        ir: saved,
        formats: request.output_formats,
        scale: request.scale,
        store: this.store,
        chromiumPath: this.chromiumPath,
      })
      const warnings = [
        ...semantic.warnings.map(warningText),
        ...layoutInspection.warnings.map(warningText),
        ...exportResult.warnings.map(warningText),
      ]
      const status = warnings.length ? 'SUCCESS_WITH_WARNINGS' : 'SUCCESS'
      return baseResult({ status, type, ir: saved, title, renderer, semantic, layoutInspection, refinement, exportResult, assumptions, warnings, errors: [], clarifications: [] })
    } catch (error) {
      return failedResult(error, context)
    }
  }

  async revise(request = {}) {
    await this.init()
    let context = {}
    try {
      const id = request.diagram_id
      if (!id) throw new DiagramError('diagram_id_missing', 'diagram_id is required for a revision.', 'NEEDS_CLARIFICATION')
      const base = await this.store.load(id)
      context = { ir: base, type: base.diagram_type, title: base.title }
      const instruction = clean(request.instruction ?? request.requirement ?? '', 4000)
      const revision = applyRevision(base, instruction, { structuredPatch: request.structured_patch ?? request.structured_specification })
      if (revision.clarifications.length) {
        return clarificationResult({ type: base.diagram_type, title: base.title, clarifications: revision.clarifications, assumptions: revision.assumptions })
      }
      let ir = revision.ir
      ir.assumptions = [...new Set([...(base.assumptions ?? []), ...revision.assumptions])]
      for (const [key, value] of Object.entries(request.style ?? {})) {
        if (key === 'theme') ir.style.theme = option(value, THEMES, 'theme', ir.style.theme)
        if (key === 'orientation') ir.style.orientation = option(value, ORIENTATIONS, 'orientation', ir.style.orientation)
        if (key === 'layout_density') ir.style.layout_density = option(value, DENSITIES, 'layout_density', ir.style.layout_density)
      }
      const semantic = validateDiagram(ir)
      if (semantic.status === 'FAILED') {
        return failedResult(new DiagramError('semantic_validation_failed', 'The revised diagram failed semantic validation and was not saved.', 'FAILED'), { ...context, semantic })
      }
      const refinement = refineLayout(ir, { maxAttempts: request.max_refinements ?? 3, orientation: ir.style.orientation, density: ir.style.layout_density })
      if (!refinement.semanticPreserved) {
        return failedResult(new DiagramError('refinement_changed_semantics', 'Layout refinement changed semantic content; the revision was aborted.', 'FAILED'), { ...context, semantic, refinement })
      }
      ir = refinement.ir
      const layoutInspection = inspectLayout(ir)
      if (layoutInspection.status === 'FAILED') {
        return failedResult(new DiagramError('layout_inspection_failed', 'The revised diagram failed mandatory layout checks.', 'FAILED', { checks: layoutInspection.errors }), { ...context, semantic, layoutInspection, refinement })
      }
      const renderer = selectRenderer(ir)
      const svg = renderSVG(ir)
      const svgCheck = verifySvgArtifact(svg, { width: ir.layout.width, height: ir.layout.height })
      if (svgCheck.status === 'FAILED') {
        return failedResult(new DiagramError('svg_validation_failed', 'The revised SVG failed structural verification.', 'FAILED', { errors: svgCheck.errors }), { ...context, semantic, layoutInspection, refinement, renderer })
      }
      const saved = await this.store.save(ir, { changeSummary: revision.changes.map(change => change.detail) })
      const exportResult = await exportDiagramArtifacts({
        ir: saved,
        formats: request.output_formats,
        scale: request.scale,
        store: this.store,
        chromiumPath: this.chromiumPath,
      })
      const warnings = [
        ...semantic.warnings.map(warningText),
        ...layoutInspection.warnings.map(warningText),
        ...exportResult.warnings.map(warningText),
      ]
      const status = warnings.length ? 'SUCCESS_WITH_WARNINGS' : 'SUCCESS'
      const result = baseResult({ status, type: saved.diagram_type, ir: saved, title: saved.title, renderer, semantic, layoutInspection, refinement, exportResult, assumptions: saved.assumptions, warnings, errors: [], clarifications: [] })
      result.change_summary = revision.changes
      result.changed_node_ids = revision.changedNodeIds
      result.changed_edge_ids = revision.changedEdgeIds
      result.previous_revision = base.revision
      return result
    } catch (error) {
      return failedResult(error, context)
    }
  }

  async validate(request = {}) {
    await this.init()
    let context = {}
    try {
      let ir
      if (request.diagram_id) {
        ir = await this.store.load(request.diagram_id)
      } else {
        const prepared = await this._prepare({ ...request, output_formats: ['svg'] })
        if (prepared.clarification) return clarificationResult(prepared.clarification)
        ir = prepared.ir
        ir.diagram_id = diagramId(ir.diagram_type, ir.title)
      }
      context = { ir, type: ir.diagram_type, title: ir.title }
      const semantic = validateDiagram(ir)
      const refined = refineLayout(ir, { maxAttempts: 3, orientation: ir.style?.orientation, density: ir.style?.layout_density })
      const layoutInspection = inspectLayout(refined.ir)
      const warnings = [...semantic.warnings.map(warningText), ...layoutInspection.warnings.map(warningText)]
      const status = semantic.status === 'FAILED' || layoutInspection.status === 'FAILED'
        ? 'FAILED'
        : warnings.length ? 'SUCCESS_WITH_WARNINGS' : 'SUCCESS'
      const result = baseResult({
        status,
        type: ir.diagram_type,
        ir,
        title: ir.title,
        renderer: selectRenderer(refined.ir),
        semantic,
        layoutInspection,
        refinement: refined,
        exportResult: null,
        assumptions: ir.assumptions ?? [],
        warnings,
        errors: [...semantic.errors],
        clarifications: [],
      })
      result.validation.rendering = 'NOT_RUN'
      result.validation.export = 'NOT_RUN'
      result.quality_report.rendering = { status: 'NOT_RUN', reason: 'Validation does not render artifacts.' }
      result.quality_report.export = { status: 'NOT_RUN', artifacts: [] }
      return result
    } catch (error) {
      return failedResult(error, context)
    }
  }

  async export(request = {}) {
    await this.init()
    let context = {}
    try {
      if (!request.diagram_id) throw new DiagramError('diagram_id_missing', 'diagram_id is required for export.', 'NEEDS_CLARIFICATION')
      const stored = await this.store.load(request.diagram_id)
      let ir = stored
      if (!ir.layout) ir = layoutDiagram(ir)
      const layoutInspection = inspectLayout(ir)
      context = { ir, type: ir.diagram_type, title: ir.title, layoutInspection }
      if (layoutInspection.status === 'FAILED') {
        return failedResult(new DiagramError('layout_inspection_failed', 'The stored diagram has no valid layout.', 'FAILED', { checks: layoutInspection.errors }), context)
      }
      const semantic = validateDiagram(ir)
      const renderer = selectRenderer(ir)
      const exportResult = await exportDiagramArtifacts({
        ir,
        formats: normalizeFormats(request.output_formats),
        scale: request.scale,
        store: this.store,
        chromiumPath: this.chromiumPath,
      })
      const warnings = [...semantic.warnings.map(warningText), ...layoutInspection.warnings.map(warningText), ...exportResult.warnings.map(warningText)]
      return baseResult({
        status: warnings.length ? 'SUCCESS_WITH_WARNINGS' : 'SUCCESS',
        type: ir.diagram_type,
        ir,
        title: ir.title,
        renderer,
        semantic,
        layoutInspection,
        refinement: null,
        exportResult,
        assumptions: ir.assumptions ?? [],
        warnings,
        errors: [],
        clarifications: [],
      })
    } catch (error) {
      return failedResult(error, context)
    }
  }

  async list() {
    await this.init()
    const prototype = emptyIR({ diagramType: 'erd', title: 'Capabilities' })
    const renderer = selectRenderer(prototype)
    const stored = await this.store.list()
    return {
      status: 'SUCCESS',
      ir_version: IR_VERSION,
      operations: ['generate_diagram', 'revise_diagram', 'validate_diagram', 'export_diagram', 'list_supported_diagrams'],
      diagram_types: DIAGRAM_TYPES.map(type => ({ type, label: DIAGRAM_LABELS[type] })),
      output_formats: OUTPUT_FORMATS,
      themes: THEMES,
      orientations: ORIENTATIONS,
      layout_densities: DENSITIES,
      renderers: discoverRenderers(),
      selected_renderer: renderer.selected,
      raster_backend: renderer.projection,
      capabilities: renderer.capabilities,
      fallback: renderer.fallback,
      quality_gates: ['SUCCESS', 'SUCCESS_WITH_WARNINGS', 'NEEDS_CLARIFICATION', 'FAILED'],
      stored_diagrams: stored.map(item => ({ ...item, history: undefined })),
      workspace: this.workspaceRoot,
      storage_root: this.store.root,
    }
  }

  async revisions(diagramIdValue) {
    await this.init()
    const current = await this.store.load(diagramIdValue)
    const archived = await this.store.revisions(diagramIdValue)
    return {
      status: 'SUCCESS',
      diagram_id: diagramIdValue,
      current_revision: current.revision,
      revisions: [
        ...archived.map(item => ({ ...item, current: false })),
        {
          revision: current.revision,
          updated_at: current.updated_at,
          changes: current.revision_changes ?? [],
          current: true,
        },
      ],
    }
  }
}

export function createStudio(options) {
  return new DiagramStudio(options)
}
