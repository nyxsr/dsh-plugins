import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { generatePdf } from '../../src/core/pipeline.js'
import { validateDocument } from '../../src/core/models.js'
import { freshDir, readExample, miniDocument, PACKAGE_ROOT, describePdf } from '../helpers.js'

const EXAMPLES = [
  '01-business-performance-report.json',
  '02-strategic-business-proposal.json',
  '03-educational-ebook.json',
  '04-investor-presentation.json',
  '05-product-marketing-brochure.json',
  '06-academic-research-document.json',
]

test('every demonstration document renders, passes all gates, and is approved', async () => {
  const results = []
  for (const file of EXAMPLES) {
    const raw = await readExample(file)
    const validation = validateDocument(raw)
    assert.deepEqual(validation.errors, [], file)
    const dir = await freshDir(`demo-${file}`)
    const result = await generatePdf({ document: raw, output_dir: dir }, { workspaceRoot: PACKAGE_ROOT })
    assert.equal(result.status, 'success', `${file}: ${JSON.stringify(result.failed_gates)}`)
    assert.equal(result.release_status, 'approved', file)
    assert.deepEqual(result.failed_gates, [], file)
    assert.equal(result.preview_paths.length, result.page_count, file)
    assert.ok(result.quality_score >= 90, `${file} score ${result.quality_score}`)
    assert.ok(result.page_count >= 4, file)
    assert.ok(result.page_count <= 24, file)
    results.push({ file, score: result.quality_score, pages: result.page_count, category: result.content.category, status: result.release_status, design: result.design })
  }
  const categories = new Set(results.map(result => result.category))
  assert.equal(categories.size, 6)
  const themes = new Set(results.map(result => result.design?.theme).filter(Boolean))
  assert.equal(themes.size, 6, 'each demonstration should use a distinct design direction')
})

test('each demonstration PDF keeps its synthetic disclosure and searchable text', async () => {
  for (const file of EXAMPLES) {
    const raw = await readExample(file)
    const dir = await freshDir(`demo-evidence-${file}`)
    const result = await generatePdf({ document: raw, output_dir: dir }, { workspaceRoot: PACKAGE_ROOT })
    const description = await describePdf(result.pdf_path)
    assert.match(description.text, /synthetic|sintetis/i, file)
    assert.ok(description.text.length > 4000, file)
    assert.ok(description.title.length > 0, file)
  }
})

test('visual critique reports are produced without claiming an unavailable evaluator', async () => {
  const raw = await readExample(EXAMPLES[0])
  const dir = await freshDir('critique')
  const result = await generatePdf({ document: raw, output_dir: dir }, { workspaceRoot: PACKAGE_ROOT })
  const critique = JSON.parse(await readFile(result.visual_critique_path, 'utf8'))
  assert.equal(critique.subjective_review_performed, false)
  assert.equal(critique.evaluator, 'deterministic_page_metrics')
  assert.ok(critique.limitations.some(limitation => limitation.toLowerCase().includes('vlm')))
  assert.ok(critique.page_metrics.length === result.page_count)
})

test('explicit visual review is honored but cannot override failed gates', async () => {
  const raw = await readExample(EXAMPLES[0])
  const dir = await freshDir('visual-review')
  const result = await generatePdf({
    document: raw,
    visual_review: {
      reviewed: true,
      reviewer: 'fixture-reviewer',
      score: 97,
      pages_reviewed: [1, 2],
      findings: [{ page_number: 2, issue_type: 'tone_check', severity: 'minor', evidence: 'fixture finding', confidence: 0.8 }],
    },
    output_dir: dir,
  }, { workspaceRoot: PACKAGE_ROOT })
  const critique = JSON.parse(await readFile(result.visual_critique_path, 'utf8'))
  assert.equal(critique.subjective_review_performed, true)
  assert.equal(critique.evaluator, 'fixture-reviewer+page_metrics')
  assert.equal(result.release_status, 'approved')
  assert.deepEqual(result.failed_gates, [])
})
