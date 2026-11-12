/**
 * End-to-end production pipeline with a bounded visual-critic repair loop.
 */
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { validateDocument, summarizeDocument } from './models.js'
import { loadConfig } from './configuration.js'
import { resolveOutputDir, resolveInputFile, sanitizeFilename } from './paths.js'
import { selectDesign } from '../design/adaptive_selector.js'
import { resolveTheme } from '../design/themes.js'
import { getTemplate, mergeTemplate, listTemplates } from '../templates/registry.js'
import { renderDocumentPdf } from '../render/pdf_exporter.js'
import { previewPdf } from '../render/preview_renderer.js'
import { inspectPdf } from '../quality/inspector.js'
import { scoreDocument } from '../quality/scoring.js'
import { runAgentReview } from '../agents/orchestrator.js'
import { planRepairs, applyRepairs, measureRepairEffect } from '../quality/repair_planner.js'
import { buildQualityMarkdown, buildVisualCritique } from '../quality/report.js'
import { applyBrandKit } from '../branding/brandkit.js'
import { prepareContentRequest } from '../content/planner.js'
import { StudioError } from './errors.js'

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function rankRelease(status) {
  return { rejected: 0, needs_review: 1, approved_with_warnings: 2, approved: 3 }[status] ?? 0
}

function countPassedGates(gates) {
  return Object.values(gates ?? {}).filter(Boolean).length
}

function betterArtifact(a, b) {
  if (!a) return b
  if (!b) return a
  const gatesA = countPassedGates(a.inspection.gates)
  const gatesB = countPassedGates(b.inspection.gates)
  if (gatesA !== gatesB) return gatesA > gatesB ? a : b
  const rankA = rankRelease(a.review.resolution.status)
  const rankB = rankRelease(b.review.resolution.status)
  if (rankA !== rankB) return rankA > rankB ? a : b
  return a.scoring.score >= b.scoring.score ? a : b
}

function normalizeVisualReview(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const reviewed = Boolean(input.reviewed)
  if (!reviewed) return null
  return {
    reviewed: true,
    reviewer: String(input.reviewer ?? 'agent_visual_review').slice(0, 120),
    reviewed_at: String(input.reviewed_at ?? new Date().toISOString()),
    pages_reviewed: Array.isArray(input.pages_reviewed) ? input.pages_reviewed.map(Number).filter(Number.isFinite).slice(0, 200) : [],
    score: Number.isFinite(Number(input.score)) ? Math.max(0, Math.min(100, Number(input.score))) : null,
    findings: Array.isArray(input.findings) ? input.findings.slice(0, 80).map(finding => ({
      page_number: Number.isFinite(Number(finding?.page_number)) ? Number(finding.page_number) : null,
      component_id: finding?.component_id ? String(finding.component_id).slice(0, 100) : null,
      issue_type: String(finding?.issue_type ?? 'visual_finding').slice(0, 100),
      severity: ['minor', 'major', 'critical'].includes(finding?.severity) ? finding.severity : 'minor',
      evidence: String(finding?.evidence ?? '').slice(0, 800),
      proposed_action: String(finding?.proposed_action ?? 'review_and_refine').slice(0, 160),
      expected_impact: String(finding?.expected_impact ?? '').slice(0, 400),
      confidence: Number.isFinite(Number(finding?.confidence)) ? Math.max(0, Math.min(1, Number(finding.confidence))) : 0.7,
    })) : [],
  }
}

async function readRequestDocument(request, config, template = null) {
  if (request.document && typeof request.document === 'object') {
    const inline = structuredClone(request.document)
    const hasSections = Array.isArray(inline.sections) && inline.sections.length > 0
    const wantsPlanner = !hasSections && Boolean((inline.source_text ?? request.source_text) || (inline.outline ?? request.outline))
    if (wantsPlanner) {
      const viaPlanner = prepareContentRequest({ ...inline, source_text: inline.source_text ?? request.source_text, outline: inline.outline ?? request.outline }, template)
      return { document: { ...viaPlanner, allow_placeholders: inline.allow_placeholders ?? request.allow_placeholders }, source: 'content_planner' }
    }
    return { document: inline, source: 'inline' }
  }
  if (request.document_path) {
    const resolved = await resolveInputFile(config.workspace_root, request.document_path)
    const raw = await readFile(resolved, 'utf8')
    if (raw.length > config.security.max_document_bytes) throw new StudioError('document_too_large', 'Ukuran JSON Document IR melebihi batas yang dikonfigurasi.')
    try {
      return { document: JSON.parse(raw), source: 'file', path: resolved }
    } catch (error) {
      throw new StudioError('invalid_document', 'Berkas Document IR bukan JSON yang valid.', { cause: error })
    }
  }
  if (request.source_text || request.outline) {
    return {
      document: { ...prepareContentRequest(request, template), allow_placeholders: request.allow_placeholders },
      source: 'content_planner',
    }
  }
  throw new StudioError('invalid_request', 'Isi salah satu: document, document_path, source_text, atau outline.')
}

/**
 * Generate a PDF, inspect it, review it, repair it, and publish evidence.
 *
 * @param {object} request
 * @param {object} [options]
 */
export async function generatePdf(request, options = {}) {
  const config = options.config ?? await loadConfig({
    workspaceRoot: options.workspaceRoot ?? process.cwd(),
    configPath: options.configPath,
    overrides: options.configOverrides,
  })
  const started = Date.now()
  let template = null
  if (request.template_id) {
    template = await getTemplate(request.template_id)
  }
  const { document: rawDocument, source } = await readRequestDocument(request, config, template)
  let raw = template ? mergeTemplate(template, rawDocument) : rawDocument
  raw.quality = { ...(raw.quality ?? {}) }
  raw.quality.target_score ??= config.target_score
  raw.quality.max_repair_iterations ??= config.max_repair_iterations
  const validation = validateDocument(raw)
  if (validation.errors.length) {
    throw new StudioError('invalid_document', 'Validasi Document IR gagal.', {
      status: 'invalid',
      details: { errors: validation.errors, warnings: validation.warnings },
    })
  }
  let document = validation.document
  const warnings = [...validation.warnings]
  if (request.brand_kit) {
    const branded = await applyBrandKit(document, request.brand_kit, {
      workspaceRoot: config.workspace_root,
      baseDir: raw._base_dir ?? config.workspace_root,
      allowRemote: false,
    })
    document = branded.document
    warnings.push(...branded.brand_report.warnings)
  }
  if (!document.theme.family) {
    const selection = selectDesign(document, { template })
    document.theme.family = selection.family
  }
  const designInitial = selectDesign(document, { template })
  const themed = resolveTheme(document, { reference: document.reference?.profile })
  const theme = themed.theme
  warnings.push(...themed.warnings)
  const design = {
    ...designInitial,
    accessibility: {
      body_contrast: theme.contrast.body,
      muted_contrast: theme.contrast.muted,
      minimum_body_font_pt: theme.type.body,
    },
    resolved_theme: theme.key,
  }
  document.design = design
  const outputDir = await resolveOutputDir({
    workspaceRoot: config.workspace_root,
    outputRoot: config.output_root,
    outputDir: request.output_dir,
    documentId: document.document_id,
  })
  const baseName = sanitizeFilename(document.document_id)
  const finalPdfPath = path.join(outputDir, `${baseName}.pdf`)
  const previewDir = path.join(outputDir, 'previews')
  const iterationsDir = path.join(outputDir, 'iterations')
  const manualVisualReview = normalizeVisualReview(request.visual_review ?? document.quality.visual_review)
  let currentDocument = document
  let best = null
  const history = []
  const iterationSummaries = []
  let iteration = 0
  let stopReason = 'max_iterations'
  const maxAttempts = document.quality.max_repair_iterations + 1

  for (iteration = 1; iteration <= maxAttempts; iteration += 1) {
    const iterationDir = path.join(iterationsDir, String(iteration).padStart(2, '0'))
    const workDir = path.join(iterationDir, 'work')
    const pdfPath = path.join(iterationDir, 'document.pdf')
    const previewsDir = path.join(iterationDir, 'previews')
    const render = await renderDocumentPdf({
      document: currentDocument,
      theme,
      design,
      workDir,
      outputPath: pdfPath,
      options: {
        workspaceRoot: config.workspace_root,
        baseDir: config.workspace_root,
        allowRemote: false,
      },
    })
    const previewArtifact = await previewPdf({ pdfPath, outputDir: previewsDir, dpi: config.preview_dpi })
    const inspection = await inspectPdf({
      pdfPath,
      document: currentDocument,
      previews: previewArtifact.previews,
      layoutAudit: render.layout_audit,
      render,
    })
    if (!inspection.previews) inspection.previews = previewArtifact.previews
    if (render.page_count > config.max_pages) {
      inspection.gates.page_limit = false
      inspection.errors.push(`Page limit exceeded: ${render.page_count} > ${config.max_pages}`)
    } else {
      inspection.gates.page_limit = true
    }
    const preScore = scoreDocument({ document: currentDocument, theme, inspection, design, reviewMessages: [], manualVisualReview })
    let review = runAgentReview({ document: currentDocument, theme, design, inspection, scoring: preScore, manualVisualReview })
    let scoring = scoreDocument({ document: currentDocument, theme, inspection, design, reviewMessages: review.messages, manualVisualReview })
    review = runAgentReview({ document: currentDocument, theme, design, inspection, scoring, manualVisualReview })
    const artifact = {
      iteration,
      document: currentDocument,
      theme,
      design,
      render,
      previewArtifact,
      inspection,
      scoring,
      review,
      iterationDir,
      pdfPath,
      previewsDir,
    }
    if (history.length) {
      const prior = history.at(-1)
      prior.effect = measureRepairEffect(prior.beforeInspection, prior.beforeScoring, inspection, scoring)
      prior.accepted = prior.effect.improved || !prior.effect.regressed
      iterationSummaries.push({
        iteration, score: scoring.score, release_status: review.resolution.status,
        gates_passed: countPassedGates(inspection.gates), gates_total: Object.keys(inspection.gates).length,
        actions: prior.actions.map(action => action.action), effect: prior.effect,
      })
    } else {
      iterationSummaries.push({
        iteration, score: scoring.score, release_status: review.resolution.status,
        gates_passed: countPassedGates(inspection.gates), gates_total: Object.keys(inspection.gates).length,
        actions: [], effect: null,
      })
    }
    best = betterArtifact(best, artifact)
    const approved = scoring.gates_ok && ['approved', 'approved_with_warnings'].includes(review.resolution.status)
    if (approved) { stopReason = 'approved'; break }
    if (iteration >= maxAttempts) { stopReason = 'max_iterations'; break }
    const plan = planRepairs({
      document: currentDocument,
      messages: review.messages,
      inspection,
      history,
      iteration,
    })
    if (plan.actions.length === 0) { stopReason = plan.skipped.length ? 'no_safe_repair' : 'no_actionable_findings'; break }
    let applied
    try {
      applied = applyRepairs(currentDocument, plan.actions, iteration + 1)
    } catch (error) {
      if (error instanceof StudioError && error.code === 'repair_noop') {
        stopReason = 'no_applicable_repair'
        break
      }
      throw error
    }
    history.push({
      iteration,
      actions: applied.applied,
      requested: plan.actions,
      skipped: plan.skipped,
      strategy: plan.strategy,
      signature: applied.signature,
      beforeInspection: inspection,
      beforeScoring: scoring,
      effect: null,
      accepted: null,
    })
    currentDocument = applied.document
    currentDocument.theme.family = theme.key
  }

  if (!best) throw new StudioError('generation_failed', 'Tidak ada artefak PDF yang dihasilkan.', { details: { stopReason } })
  const bestArtifact = best
  await mkdir(outputDir, { recursive: true })
  await copyFile(bestArtifact.pdfPath, finalPdfPath)
  await rm(previewDir, { recursive: true, force: true })
  await cp(bestArtifact.previewsDir, previewDir, { recursive: true })
  const finalPreviewArtifact = await previewPdf({ pdfPath: finalPdfPath, outputDir: previewDir, dpi: config.preview_dpi })
  const finalInspection = await inspectPdf({
    pdfPath: finalPdfPath,
    document: bestArtifact.document,
    previews: finalPreviewArtifact.previews,
    layoutAudit: bestArtifact.render.layout_audit,
    render: bestArtifact.render,
  })
  if (bestArtifact.render.page_count > config.max_pages) {
    finalInspection.gates.page_limit = false
    finalInspection.errors.push(`Page limit exceeded: ${bestArtifact.render.page_count} > ${config.max_pages}`)
  } else {
    finalInspection.gates.page_limit = true
  }
  const finalPreScore = scoreDocument({ document: bestArtifact.document, theme, inspection: finalInspection, design, reviewMessages: [], manualVisualReview })
  let finalReview = runAgentReview({ document: bestArtifact.document, theme, design, inspection: finalInspection, scoring: finalPreScore, manualVisualReview })
  let finalScoring = scoreDocument({ document: bestArtifact.document, theme, inspection: finalInspection, design, reviewMessages: finalReview.messages, manualVisualReview })
  finalReview = runAgentReview({ document: bestArtifact.document, theme, design, inspection: finalInspection, scoring: finalScoring, manualVisualReview })
  const finalPdfBytes = await readFile(finalPdfPath)
  const checksum = sha256(finalPdfBytes)
  const artifacts = {
    pdf_path: finalPdfPath,
    preview_paths: finalPreviewArtifact.preview_paths,
    inspection_path: path.join(outputDir, 'technical_inspection.json'),
    visual_report_path: path.join(outputDir, 'visual_critique.json'),
    release_path: path.join(outputDir, 'release_decision.json'),
    quality_report_path: path.join(outputDir, 'quality_report.json'),
    quality_markdown_path: path.join(outputDir, 'quality_report.md'),
    metadata_path: path.join(outputDir, 'metadata.json'),
    design_path: path.join(outputDir, 'design_direction.json'),
    ir_path: path.join(outputDir, 'document.ir.json'),
    checkpoint_dir: iterationsDir,
  }
  const visualCritique = buildVisualCritique({
    inspection: finalInspection,
    review: finalReview,
    scoring: finalScoring,
    document: bestArtifact.document,
    manualReview: manualVisualReview,
  })
  const repairHistory = history.map(entry => ({
    iteration: entry.iteration,
    strategy: entry.strategy,
    actions: entry.actions,
    skipped: entry.skipped,
    signature: entry.signature,
    effect: entry.effect,
    accepted: entry.accepted,
  }))
  const qualityReport = {
    status: finalReview.resolution.status,
    document: summarizeDocument(bestArtifact.document),
    design,
    theme: {
      key: theme.key, name: theme.name, description: theme.description,
      colors: theme.colors, fonts: theme.fonts, type: theme.type, layout: theme.layout,
      contrast: theme.contrast,
    },
    inspection: finalInspection,
    scoring: finalScoring,
    review: finalReview,
    visual_critique: visualCritique,
    iterations: {
      executed: iteration,
      max_attempts: maxAttempts,
      stop_reason: stopReason,
      history: repairHistory,
      summaries: iterationSummaries,
    },
    artifacts,
    checksum_sha256: checksum,
    generated_at: new Date().toISOString(),
    elapsed_ms: Date.now() - started,
    warnings,
  }
  const finalMarkdown = buildQualityMarkdown({
    document: bestArtifact.document,
    design,
    theme,
    inspection: finalInspection,
    scoring: finalScoring,
    review: finalReview,
    iterations: iteration,
    repairs: repairHistory,
    artifacts,
  })
  const metadata = {
    document_id: bestArtifact.document.document_id,
    title: bestArtifact.document.title,
    category: bestArtifact.document.category,
    language: bestArtifact.document.language,
    synthetic: bestArtifact.document.synthetic,
    page_count: finalInspection.pages,
    dimensions: finalInspection.dimensions,
    metadata: finalInspection.metadata,
    fonts: finalInspection.fonts,
    links: finalInspection.annotations,
    checksum_sha256: checksum,
    file_bytes: finalPdfBytes.byteLength,
    created_at: bestArtifact.document.metadata?.created_at,
    generated_at: new Date().toISOString(),
  }
  await Promise.all([
    writeFile(artifacts.inspection_path, JSON.stringify(finalInspection, null, 2)),
    writeFile(artifacts.visual_report_path, JSON.stringify(visualCritique, null, 2)),
    writeFile(artifacts.release_path, JSON.stringify(finalReview.release_decision, null, 2)),
    writeFile(artifacts.quality_report_path, JSON.stringify(qualityReport, null, 2)),
    writeFile(artifacts.quality_markdown_path, finalMarkdown, 'utf8'),
    writeFile(artifacts.metadata_path, JSON.stringify(metadata, null, 2)),
    writeFile(artifacts.design_path, JSON.stringify({ design, theme: qualityReport.theme }, null, 2)),
    writeFile(artifacts.ir_path, JSON.stringify(bestArtifact.document, null, 2)),
  ])
  const allWarnings = [
    ...new Set([
      ...warnings,
      ...finalInspection.warnings,
      ...finalReview.messages.filter(message => message.severity === 'minor').map(message => `${message.agent_id}: ${message.issue_type}. ${message.evidence}`),
      ...repairHistory.flatMap(entry => entry.skipped.map(skip => `Perbaikan dilewati: ${skip.issue_type}. ${skip.reason}`)),
    ]),
  ]
  if (bestArtifact.iteration !== iteration) allWarnings.push('Percobaan perbaikan berikutnya menurunkan mutu atau tidak memberi kemajuan. Iterasi terverifikasi terbaik yang diterbitkan.')
  if (stopReason === 'max_iterations' && !finalScoring.gates_ok) allWarnings.push('Batas perbaikan tercapai sebelum semua pemeriksaan wajib lolos.')
  const status = finalScoring.gates_ok
    ? (['approved', 'approved_with_warnings'].includes(finalReview.resolution.status) ? 'success' : 'needs_review')
    : 'quality_failed'
  return {
    status,
    document_id: bestArtifact.document.document_id,
    pdf_path: finalPdfPath,
    preview_paths: finalPreviewArtifact.preview_paths,
    page_count: finalInspection.pages,
    quality_report_path: artifacts.quality_report_path,
    quality_markdown_path: artifacts.quality_markdown_path,
    technical_inspection_path: artifacts.inspection_path,
    visual_critique_path: artifacts.visual_report_path,
    release_decision_path: artifacts.release_path,
    metadata_path: artifacts.metadata_path,
    design_path: artifacts.design_path,
    document_ir_path: artifacts.ir_path,
    checkpoint_dir: iterationsDir,
    quality_score: finalScoring.score,
    target_score: finalScoring.target_score,
    release_status: finalScoring.release_status,
    release_decision: finalReview.release_decision,
    gates: finalInspection.gates,
    failed_gates: finalScoring.failed_gates,
    warnings: allWarnings,
    errors: finalInspection.errors,
    iterations: iteration,
    max_attempts: maxAttempts,
    stop_reason: stopReason,
    repair_history: repairHistory,
    checksum_sha256: checksum,
    page_size: finalInspection.dimensions,
    design: {
      family: design.family, theme: theme.name, cover: design.cover, section: design.section,
      rationale: design.reasons,
    },
    content: summarizeDocument(bestArtifact.document),
    elapsed_ms: Date.now() - started,
  }
}

export async function previewPdfOperation({ pdf_path, output_dir, dpi = 110 }, options = {}) {
  const config = options.config ?? await loadConfig({ workspaceRoot: options.workspaceRoot ?? process.cwd() })
  const resolved = await resolveInputFile(config.workspace_root, pdf_path)
  const outputDir = await resolveOutputDir({
    workspaceRoot: config.workspace_root, outputRoot: config.output_root,
    outputDir: output_dir, documentId: 'previews',
  })
  return previewPdf({ pdfPath: resolved, outputDir, dpi })
}

export async function validateDocumentOperation(request) {
  const validation = validateDocument(request.document ?? request)
  return {
    status: validation.errors.length ? 'invalid' : 'valid',
    errors: validation.errors,
    warnings: validation.warnings,
    document: validation.errors.length || !validation.document ? null : summarizeDocument(validation.document),
  }
}

export async function listTemplatesOperation() {
  const templates = await listTemplates()
  return { templates: templates.map(template => ({
    template_id: template.template_id, name: template.name, category: template.category,
    theme: template.theme, page_size: template.page_size, description: template.description,
    structural_signature: template.structural_signature, required_blocks: template.required_blocks,
    preview: template.preview, version: template.version,
  })) }
}
