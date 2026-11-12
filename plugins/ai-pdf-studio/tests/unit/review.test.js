import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { inspectPdf } from '../../src/quality/inspector.js'
import { scoreDocument } from '../../src/quality/scoring.js'
import { runAgentReview, AGENT_ROLES } from '../../src/agents/orchestrator.js'
import { resolveTheme } from '../../src/design/themes.js'
import { validateDocument } from '../../src/core/models.js'
import { previewPdf } from '../../src/render/preview_renderer.js'
import { freshDir, miniDocument, PACKAGE_ROOT } from '../helpers.js'

function inspectableDocument() {
  const result = validateDocument(miniDocument())
  assert.deepEqual(result.errors, [])
  return result.document
}

test('agent roles expose structured contracts with distinct responsibilities', () => {
  assert.equal(AGENT_ROLES.length, 10)
  const ids = AGENT_ROLES.map(role => role.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(AGENT_ROLES.find(role => role.id === 'orchestrator'))
  for (const role of AGENT_ROLES) {
    assert.ok(role.name)
    assert.ok(role.focus)
  }
})

test('review protocol rejects failed gates even with a high score', async () => {
  const document = inspectableDocument()
  const { theme } = resolveTheme(document)
  const inspection = {
    gates: { file_valid: false, page_geometry: true, text_searchable: true, content_complete: true, fonts_embedded: true, no_critical_clipping: true, no_critical_collisions: true, no_unexpected_blank_pages: true, layout_audit: true, no_javascript: true, page_limit: true },
    errors: ['Mandatory gate failed: file_valid'],
    warnings: [],
    visual: { page_metrics: [], blank_pages: [], overcrowded_pages: [], body_ink_mean: 0.05, body_ink_variance: 0, average_colorfulness: 0.2 },
    typography: { font_count: 3, all_embedded: true, estimated_body_font_pt: 10, max_line_overflow: false },
    annotations: { links: 0 },
    metadata: { title: 'Test', tagged: false },
    checks: { pages_match_render: true, near_edge_body_words: 0, outside_page_words: 0, collisions: 0, low_resolution_images: 0 },
    score_inputs: { completeness_ratio: 1, body_words: 400, body_chars: 2200, fonts_embedded: true, no_critical_clipping: true, no_critical_collisions: true, no_blank_pages: true, dimensions_ok: true, text_searchable: true, layout_audit_ok: true, body_ink_mean: 0.05, body_ink_variance: 0, min_body_margin_pt: 60, outside_page_words: 0, near_edge_body_words: 0, collisions: 0, page_count: 4 },
  }
  const preScore = scoreDocument({ document, theme, inspection, design: { family: 'modern_corporate', reasons: ['test'] } })
  const review = runAgentReview({ document, theme, design: { family: 'modern_corporate' }, inspection, scoring: preScore })
  assert.equal(review.resolution.status, 'rejected')
  assert.equal(review.resolution.gates_ok, false)
  assert.ok(review.resolution.blocking_findings.length > 0)
  assert.ok(review.messages.every(message => message.agent_id && message.issue_type && message.severity && typeof message.confidence === 'number'))
})

test('review detects missing synthetic disclosure as a critical finding', async () => {
  const document = inspectableDocument()
  const scrub = value => (typeof value === 'string' ? value.replace(/synthetic/gi, 'removed-word') : value)
  for (const field of ['title', 'subtitle', 'eyebrow', 'purpose', 'audience', 'tone']) document[field] = scrub(document[field])
  document.cover = {}
  document.metadata = { ...document.metadata, subject: 'Mini Production Fixture' }
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'string') node[key] = value.replace(/synthetic/gi, 'removed-word')
        else walk(value)
      }
    }
  }
  for (const section of document.sections) walk(section)
  const inspection = {
    gates: Object.fromEntries(['file_valid', 'page_geometry', 'text_searchable', 'content_complete', 'fonts_embedded', 'no_critical_clipping', 'no_critical_collisions', 'no_unexpected_blank_pages', 'layout_audit', 'no_javascript', 'page_limit'].map(name => [name, true])),
    errors: [], warnings: [],
    visual: { page_metrics: [], blank_pages: [], overcrowded_pages: [], body_ink_mean: 0.05, body_ink_variance: 0, average_colorfulness: 0.2 },
    typography: { font_count: 3, all_embedded: true, estimated_body_font_pt: 10, max_line_overflow: false },
    annotations: { links: 0 }, metadata: { title: 'Test', tagged: false },
    checks: { pages_match_render: true, near_edge_body_words: 0, outside_page_words: 0, collisions: 0, low_resolution_images: 0 },
    score_inputs: { completeness_ratio: 1, body_words: 400, body_chars: 2200, fonts_embedded: true, no_critical_clipping: true, no_critical_collisions: true, no_blank_pages: true, dimensions_ok: true, text_searchable: true, layout_audit_ok: true, body_ink_mean: 0.05, body_ink_variance: 0, min_body_margin_pt: 60, outside_page_words: 0, near_edge_body_words: 0, collisions: 0, page_count: 4 },
  }
  const { theme } = resolveTheme(document)
  const preScore = scoreDocument({ document, theme, inspection, design: { family: 'modern_corporate', reasons: ['test'] } })
  const review = runAgentReview({ document, theme, design: { family: 'modern_corporate' }, inspection, scoring: preScore })
  const missing = review.messages.find(message => message.issue_type === 'missing_disclosure')
  assert.ok(missing)
  assert.equal(missing.severity, 'critical')
  assert.ok(review.resolution.status === 'rejected' || review.resolution.status === 'needs_review')
})

test('inspect and scoring produce complete evidence for a rendered PDF', async () => {
  const document = inspectableDocument()
  const dir = await freshDir('inspect-evidence')
  const { generatePdf } = await import('../../src/core/pipeline.js')
  const generated = await generatePdf({ document, output_dir: dir }, { workspaceRoot: PACKAGE_ROOT })
  assert.equal(generated.status, 'success')
  const previews = await previewPdf({ pdfPath: generated.pdf_path, outputDir: path.join(dir, 'inspect-previews'), dpi: 90 })
  const inspection = await inspectPdf({ pdfPath: generated.pdf_path, document, previews: previews.previews, layoutAudit: null, render: null })
  inspection.gates.page_limit = true
  const { theme } = resolveTheme(document)
  const design = { family: 'modern_corporate', reasons: ['test'] }
  const preScore = scoreDocument({ document, theme, inspection, design })
  const review = runAgentReview({ document, theme, design, inspection, scoring: preScore })
  const scoring = scoreDocument({ document, theme, inspection, design, reviewMessages: review.messages })
  assert.deepEqual(inspection.gates, Object.fromEntries(Object.entries(inspection.gates).map(([name]) => [name, true])))
  assert.equal(inspection.content.completeness_ratio, 1)
  assert.ok(scoring.score > 0)
  assert.ok(scoring.dimensions.layout.evaluated)
  assert.ok(review.resolution.status === 'approved' || review.resolution.status === 'approved_with_warnings')
  const markdown = await readFile(generated.quality_markdown_path, 'utf8')
  assert.match(markdown, /# Laporan mutu/)
  assert.match(markdown, /Pemeriksaan wajib/)
  assert.match(markdown, /Perbaikan yang dijalankan/)
})
