/**
 * One-command end-to-end smoke: generate a flowchart, verify all three formats,
 * print artifact paths, then remove the temporary workspace.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createStudio } from '../src/api/studio.js'

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'diagram-smoke-'))
try {
  const studio = createStudio({ workspaceRoot: workspace, storeRoot: '.diagram-studio' })
  const result = await studio.generate({
    requirement: 'Flowchart approval: mulai, ajukan cuti, periksa berkas, jika lengkap setujui, jika tidak tolak, selesai.',
    diagram_type: 'flowchart',
    title: 'Smoke Approval',
    output_formats: ['svg', 'png', 'pdf'],
    scale: 1,
  })
  console.log(`${result.status} ${result.diagram_type} ${result.diagram_id}`)
  for (const artifact of result.artifacts ?? []) console.log(`${artifact.format}: ${artifact.bytes} bytes ${artifact.path}`)
  if (result.status === 'FAILED' || result.status === 'NEEDS_CLARIFICATION') process.exitCode = 1
} finally {
  await fs.rm(workspace, { recursive: true, force: true })
}
