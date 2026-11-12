#!/usr/bin/env node
/** Create the visual-regression baseline from a deterministic fixture. */
import { copyFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { generatePdf } from '../src/core/pipeline.js'
import { miniDocument } from '../tests/helpers.js'

const root = path.resolve('.')
const baselineRoot = path.join(root, 'tests', 'visual', 'baseline')
const workRoot = path.join(root, 'tests', '.tmp', 'visual-baseline')
await rm(workRoot, { recursive: true, force: true })
await mkdir(baselineRoot, { recursive: true })
const result = await generatePdf({
  document: miniDocument({ document_id: 'visual-regression-baseline' }),
  output_dir: workRoot,
}, { workspaceRoot: root })
await copyFile(result.preview_paths[0], path.join(baselineRoot, 'page-01.png'))
process.stdout.write(JSON.stringify({ baseline: path.join(baselineRoot, 'page-01.png'), pdf: result.pdf_path, page_count: result.page_count, score: result.quality_score }, null, 2))
