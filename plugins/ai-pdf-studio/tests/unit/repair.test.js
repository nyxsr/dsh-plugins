import test from 'node:test'
import assert from 'node:assert/strict'
import { validateDocument } from '../../src/core/models.js'
import { planRepairs, applyRepairs } from '../../src/quality/repair_planner.js'
import { createStudio } from '../../src/api/service.js'
import { freshDir, miniDocument, PACKAGE_ROOT } from '../helpers.js'

function fixture() {
  const result = validateDocument(miniDocument())
  assert.deepEqual(result.errors, [])
  return result.document
}

const inspection = {
  gates: { file_valid: true },
  visual: { page_metrics: [], overcrowded_pages: [] },
}

test('near-edge findings become targeted margin repairs', () => {
  const document = fixture()
  const plan = planRepairs({
    document,
    inspection,
    messages: [{
      agent_id: 'layout_engineer', severity: 'major', classification: 'objective',
      issue_type: 'near_edge_text', component_id: null, page_number: 2,
      evidence: 'three words near the edge', proposed_action: 'increase_margins_or_reflow',
    }],
  })
  assert.equal(plan.preserve_content, true)
  assert.deepEqual(plan.actions.map(action => action.action), ['increase_margins', 'increase_margins'])
  assert.ok(plan.actions.every(action => action.delta_pt === 8))
})

test('repair history blocks oscillation and content is preserved', () => {
  const document = fixture()
  const beforeBlocks = document.sections.flatMap(section => section.blocks.length)
  const message = {
    agent_id: 'layout_engineer', severity: 'major', classification: 'objective',
    issue_type: 'near_edge_text', component_id: null, page_number: 2,
    evidence: 'edge', proposed_action: 'increase_margins_or_reflow',
  }
  const first = planRepairs({ document, inspection, messages: [message] })
  const applied = applyRepairs(document, first.actions, 2)
  const second = planRepairs({
    document: applied.document, inspection, messages: [message],
    history: [{ action: 'increase_margins', signature: JSON.stringify({ action: 'increase_margins', component_id: null, side: null, delta_pt: null }) }],
  })
  assert.equal(second.actions.length, 0)
  assert.ok(second.skipped.some(entry => /sudah dicoba|oscillation/i.test(entry.reason)))
  assert.deepEqual(applied.document.sections.map(section => section.blocks.length), beforeBlocks)
})

test('a repair that changes nothing throws a structured no-op error', () => {
  const document = fixture()
  assert.throws(() => applyRepairs(document, [], 2), error => error.code === 'repair_noop')
})

test('margin repair loop improves a real PDF and passes clipping', async () => {
  const outputDir = await freshDir('repair-loop')
  const document = miniDocument({
    document_id: 'test-repair-loop',
    theme: { family: 'premium_editorial' },
    page: { size: 'A4', margins: { top: 64, right: 12, bottom: 64, left: 12 } },
    quality: { target_score: 80, max_repair_iterations: 2 },
  })
  const studio = createStudio({ workspaceRoot: PACKAGE_ROOT })
  const result = await studio.generate_pdf({ document, output_dir: outputDir })
  assert.ok(result.iterations >= 2)
  assert.deepEqual(result.failed_gates, [])
  assert.ok(result.gates.no_critical_clipping)
  assert.ok(result.repair_history.length >= 1)
  assert.ok(result.repair_history[0].actions.some(action => action.action === 'increase_margins'))
  assert.ok(result.repair_history[0].effect.gate_delta >= 1)
  assert.ok(result.quality_score > 0)
})
