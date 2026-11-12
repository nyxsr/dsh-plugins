/**
 * AI Diagram Studio — DeepSeek Harness Host plugin.
 *
 * The diagram pipeline lives in ./src. This file only maps the studio's stable
 * operations to Harness tools and turns results into compact model-facing text.
 */
import path from 'node:path'
import { createStudio } from './src/api/studio.js'

export const name = 'ai-diagram-studio'
export const inject = ['tools']

const DIAGRAM_TYPES = ['auto', 'erd', 'flowchart', 'uml_class', 'uml_usecase', 'uml_activity', 'uml_state', 'sequence', 'architecture', 'uml']
const FORMATS = ['svg', 'png', 'pdf']
const THEMES = ['professional', 'light', 'dark', 'monochrome']
const ORIENTATIONS = ['auto', 'portrait', 'landscape']
const DENSITIES = ['auto', 'compact', 'comfortable', 'spacious']

function textResult(value) {
  const result = value ?? {}
  const lines = [`AI Diagram Studio: ${result.status ?? 'FAILED'}`]
  if (result.diagram_id) lines.push(`diagram_id: ${result.diagram_id}`)
  if (result.diagram_type) lines.push(`diagram_type: ${result.diagram_type_label ?? result.diagram_type}`)
  if (result.title) lines.push(`title: ${result.title}`)
  if (result.revision) lines.push(`revision: ${result.revision}`)
  if (result.selected_renderer) lines.push(`renderer: ${result.selected_renderer}`)
  if (result.validation) {
    const v = result.validation
    lines.push(`validation: semantic=${v.semantic} rendering=${v.rendering} visual=${v.visual} export=${v.export}`)
  }
  const artifacts = Array.isArray(result.artifacts) ? result.artifacts : []
  if (artifacts.length) {
    lines.push('artifacts:')
    for (const artifact of artifacts.slice(0, 8)) {
      lines.push(`- ${artifact.format}: ${artifact.relative_path ?? artifact.path} (${artifact.bytes} bytes, ${artifact.status})`)
    }
  }
  if (Array.isArray(result.change_summary) && result.change_summary.length) {
    lines.push('changes:')
    for (const change of result.change_summary.slice(0, 8)) lines.push(`- ${change.detail ?? change.operation ?? JSON.stringify(change)}`)
  }
  if (Array.isArray(result.clarifications) && result.clarifications.length) {
    lines.push('clarifications needed:')
    for (const item of result.clarifications.slice(0, 6)) lines.push(`- ${item}`)
  }
  if (Array.isArray(result.assumptions) && result.assumptions.length) {
    lines.push(`assumptions: ${result.assumptions.length} (review quality_report and diagram.assumptions)`)
  }
  if (Array.isArray(result.warnings) && result.warnings.length) {
    lines.push(`warnings: ${result.warnings.slice(0, 5).join(' | ')}${result.warnings.length > 5 ? ` … (${result.warnings.length} total)` : ''}`)
  }
  if (Array.isArray(result.errors) && result.errors.length) {
    for (const error of result.errors.slice(0, 6)) lines.push(`error [${error.code ?? 'error'}]: ${error.message ?? error}`)
  }
  if (result.quality_report?.method) lines.push(`inspection: ${result.quality_report.method}`)
  if (Array.isArray(result.diagram_types) && result.diagram_types.length) {
    lines.push(`supported types: ${result.diagram_types.map(item => item.label ?? item.type ?? item).join(', ')}`)
  }
  if (Array.isArray(result.renderers) && result.renderers.length) {
    lines.push(`renderers: ${result.renderers.map(item => `${item.name}${item.available ? '' : ' (unavailable)'}`).join(', ')}`)
  }
  if (Array.isArray(result.stored_diagrams) && result.stored_diagrams.length) {
    lines.push(`stored diagrams: ${result.stored_diagrams.length}`)
    for (const item of result.stored_diagrams.slice(0, 12)) {
      lines.push(`- ${item.id} | ${item.type} | ${item.title} | r${item.revision}`)
    }
  }
  if (Array.isArray(result.revisions)) {
    lines.push(`revisions: ${result.revisions.length}`)
    for (const item of result.revisions.slice(-12)) {
      const change = item.changes?.length ? ` | ${item.changes.map(c => typeof c === 'string' ? c : (c.detail ?? c.operation ?? JSON.stringify(c))).join('; ')}` : ''
      lines.push(`- r${item.revision}${item.current ? ' (current)' : ''}${change}`)
    }
  }
  if (result.storage_root) lines.push(`storage: ${result.storage_root}`)
  return [{ type: 'text', text: lines.join('\n') }]
}

function jsonSafe(value) {
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value, (_key, item) => (
    typeof item === 'number' && !Number.isFinite(item) ? null : item
  )))
}

function register(tools, definition, disposers) {
  const execute = definition.execute
  disposers.push(tools.register({
    ...definition,
    execute: async (...args) => jsonSafe(await execute(...args)),
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textResult(value),
    },
  }))
}

function commonProperties() {
  return {
    requirement: { type: 'string', description: 'Natural-language diagram request in Indonesian or English, or a short revision instruction.' },
    title: { type: 'string', description: 'Optional diagram title; a short title is inferred when omitted.' },
    diagram_type: { type: 'string', enum: DIAGRAM_TYPES, description: 'Diagram family. "auto" detects from the requirement; "uml" infers a UML subtype.' },
    structured_specification: { type: 'object', additionalProperties: true, description: 'Optional typed specification (entities/relationships, classes, participants/messages, steps, components/connections, or generic nodes/edges).' },
    output_formats: { type: 'array', items: { type: 'string', enum: FORMATS }, description: 'Formats to export; defaults to svg, png, and pdf.' },
    theme: { type: 'string', enum: THEMES, description: 'Visual theme; defaults to professional.' },
    orientation: { type: 'string', enum: ORIENTATIONS, description: 'Page orientation; auto chooses per diagram family.' },
    layout_density: { type: 'string', enum: DENSITIES, description: 'Spacing density; auto uses comfortable spacing.' },
    language: { type: 'string', enum: ['auto', 'id', 'en'], description: 'Content language; auto detects Indonesian or English.' },
    scale: { type: 'number', description: 'PNG raster scale from 1 to 3; defaults to 2.' },
    max_refinements: { type: 'integer', description: 'Maximum automatic layout refinement attempts (0-3); defaults to 3.' },
  }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  const studios = new Map()
  const disposers = []

  const studioFor = exec => {
    const workingDirectory = ctx.get('workingDirectory')
    let workspaceRoot = workingDirectory?.defaultDirectory ?? process.cwd()
    try {
      if (workingDirectory && exec?.agent?.session) workspaceRoot = workingDirectory.get(exec.agent.session)
    } catch { /* fall back to the default directory */ }
    workspaceRoot = path.resolve(workspaceRoot)
    if (!studios.has(workspaceRoot)) studios.set(workspaceRoot, createStudio({ workspaceRoot }))
    return studios.get(workspaceRoot)
  }

  register(ctx.tools, {
    name: 'generate_diagram',
    description: 'Generate a diagram from an Indonesian or English requirement or a structured specification. Supports ERD, flowchart, UML class/use-case/activity/state, sequence, and software architecture diagrams. Runs semantic validation, bounded layout refinement, SVG rendering, geometric inspection, and verified SVG/PNG/PDF export; returns artifact paths and a quality report. Pass existing_diagram_id to revise instead.',
    parameters: {
      type: 'object',
      properties: {
        ...commonProperties(),
        existing_diagram_id: { type: 'string', description: 'Revise this stored diagram instead of creating a new one; requirement becomes the revision instruction.' },
      },
      required: ['requirement'],
    },
    timeoutMs: 600000,
    isConcurrencySafe: () => false,
    execute: (args, exec) => {
      const studio = studioFor(exec)
      return args.existing_diagram_id
        ? studio.revise({ ...args, diagram_id: args.existing_diagram_id, instruction: args.requirement })
        : studio.generate(args)
    },
  }, disposers)

  register(ctx.tools, {
    name: 'revise_diagram',
    description: 'Revise a stored diagram without rebuilding it from scratch. Applies only the requested structural, relationship, style, or title changes, preserves unrelated elements, revalidates the full model, rerenders, and exports. Returns changed node/edge IDs and a change summary.',
    parameters: {
      type: 'object',
      properties: {
        diagram_id: { type: 'string', description: 'ID returned by generate_diagram.' },
        instruction: { type: 'string', description: 'Revision instruction, e.g. "Tambahkan tabel payments dan hubungkan dengan orders".' },
        structured_patch: { type: 'object', additionalProperties: true, description: 'Optional structured operations: add_node, add_edge, remove_node, rename_node, update_node, update_edge, set_cardinality, set_style, set_title.' },
        output_formats: { type: 'array', items: { type: 'string', enum: FORMATS }, description: 'Formats to export after revision.' },
        style: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: THEMES },
            orientation: { type: 'string', enum: ORIENTATIONS },
            layout_density: { type: 'string', enum: DENSITIES },
          },
          additionalProperties: false,
          description: 'Optional style overrides applied with the revision.',
        },
        scale: { type: 'number', description: 'PNG raster scale from 1 to 3.' },
        max_refinements: { type: 'integer', description: 'Maximum layout refinement attempts (0-3).' },
      },
      required: ['diagram_id'],
    },
    timeoutMs: 600000,
    isConcurrencySafe: () => false,
    execute: (args, exec) => studioFor(exec).revise(args),
  }, disposers)

  register(ctx.tools, {
    name: 'validate_diagram',
    description: 'Validate diagram semantics and layout without exporting. Accepts a stored diagram_id or a fresh requirement/specification. Reports structured errors and warnings and marks rendering/export as NOT_RUN; it does not fabricate visual inspection.',
    parameters: {
      type: 'object',
      properties: {
        diagram_id: { type: 'string', description: 'Validate this stored diagram; when omitted, validate requirement or structured_specification.' },
        ...commonProperties(),
      },
      required: [],
    },
    timeoutMs: 120000,
    isConcurrencySafe: () => true,
    execute: (args, exec) => studioFor(exec).validate(args),
  }, disposers)

  register(ctx.tools, {
    name: 'export_diagram',
    description: 'Export a stored diagram to SVG, PNG, and/or PDF. Verifies signatures, dimensions, PNG ink content, PDF page geometry, and first-page rasterization before reporting an artifact as VERIFIED.',
    parameters: {
      type: 'object',
      properties: {
        diagram_id: { type: 'string', description: 'Stored diagram ID to export.' },
        output_formats: { type: 'array', items: { type: 'string', enum: FORMATS }, description: 'Formats to export; defaults to all three.' },
        scale: { type: 'number', description: 'PNG raster scale from 1 to 3; defaults to 2.' },
      },
      required: ['diagram_id'],
    },
    timeoutMs: 300000,
    isConcurrencySafe: () => false,
    execute: (args, exec) => studioFor(exec).export(args),
  }, disposers)

  register(ctx.tools, {
    name: 'list_supported_diagrams',
    description: 'List supported diagram families, output formats, themes, renderers, quality gates, capabilities, limitations, and diagrams stored in this workspace.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    execute: (_args, exec) => studioFor(exec).list(),
  }, disposers)

  register(ctx.tools, {
    name: 'list_diagram_revisions',
    description: 'List revision history for a stored diagram, including timestamps and change summaries.',
    parameters: {
      type: 'object',
      properties: { diagram_id: { type: 'string', description: 'Stored diagram ID.' } },
      required: ['diagram_id'],
    },
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    execute: (args, exec) => studioFor(exec).revisions(args.diagram_id),
  }, disposers)

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch { /* already disposed */ }
    }
  })
}
