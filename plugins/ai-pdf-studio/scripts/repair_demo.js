#!/usr/bin/env node
/** Preserve a real repair-loop artifact for inspection. */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { generatePdf } from '../src/core/pipeline.js'

const document = {
  document_id: 'demo-repair-loop',
  title: 'Controlled Margin Repair',
  subtitle: 'A fixture that starts with body text too close to the page edges',
  category: 'report',
  language: 'en',
  audience: 'Quality engineering reviewers',
  purpose: 'Demonstrate detection, targeted repair, re-render, and verification',
  content_mode: 'preserve',
  synthetic: true,
  page: { size: 'A4', margins: { top: 64, right: 12, bottom: 64, left: 12 } },
  theme: { family: 'premium_editorial' },
  metadata: { author: 'AI PDF Studio tests', organization: 'AI PDF Studio', created_at: '2026-11-10T08:00:00Z', keywords: ['repair', 'synthetic'] },
  quality: { target_score: 80, max_repair_iterations: 2 },
  sections: [
    {
      title: 'The defect', kicker: '01 · Near-edge body text',
      blocks: [{
        type: 'paragraph',
        text: 'This controlled fixture places body text close to the left and right page edges. The inspector should detect the near-edge condition, plan a targeted margin repair, re-render, and verify that the clipping gate passes without deleting content.',
      }],
    },
    {
      title: 'The repair', kicker: '02 · Bounded loop',
      blocks: [{
        type: 'paragraph',
        text: 'The repair planner adds eight points to each side margin, increments the document version, and re-renders. The second pass should show an improvement in gate count and score, with every content block still present.',
      }],
    },
  ],
}
const result = await generatePdf({ document, output_dir: 'outputs/repair-loop' }, { workspaceRoot: path.resolve('.') })
await writeFile('outputs/repair-loop/result.json', JSON.stringify(result, null, 2))
process.stdout.write(JSON.stringify({ status: result.status, score: result.quality_score, iterations: result.iterations, failed_gates: result.failed_gates, history: result.repair_history, pdf: result.pdf_path }, null, 2))
