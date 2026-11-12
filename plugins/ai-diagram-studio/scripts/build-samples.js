/**
 * Build a clean, verified sample set from examples/requests.json.
 * Artifacts are copied out of the canonical store; manifest.json records
 * the status, checks, warnings, and checksums that were actually observed.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStudio } from '../src/api/studio.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(root, 'outputs', 'samples')
const storeRoot = '.diagram-studio-samples'
const requests = JSON.parse(await fs.readFile(path.join(root, 'examples', 'requests.json'), 'utf8'))

await fs.rm(outputRoot, { recursive: true, force: true })
await fs.rm(path.join(root, storeRoot), { recursive: true, force: true })
await fs.mkdir(outputRoot, { recursive: true })

const studio = createStudio({ workspaceRoot: root, storeRoot })
const manifest = { generated_at: new Date().toISOString(), pipeline: ['generate', 'validate', 'render', 'inspect', 'refine', 'export', 'verify'], samples: [] }
let failures = 0

for (const sample of requests) {
  const requested = sample.request.output_formats ?? ['svg', 'png', 'pdf']
  const result = await studio.generate({ ...sample.request, output_formats: requested, scale: sample.request.scale ?? 2 })
  const entry = {
    id: sample.id,
    label: sample.label,
    status: result.status,
    diagram_id: result.diagram_id,
    diagram_type: result.diagram_type,
    title: result.title,
    validation: result.validation,
    warnings: result.warnings,
    errors: result.errors,
    layout: result.diagram?.layout ?? null,
    artifacts: [],
  }
  if (result.status === 'FAILED' || result.status === 'NEEDS_CLARIFICATION') {
    failures++
    manifest.samples.push(entry)
    console.error(`FAIL ${sample.id}: ${JSON.stringify(result.errors)}`)
    continue
  }
  for (const artifact of result.artifacts) {
    const target = path.join(outputRoot, `${sample.id}.${artifact.format}`)
    const data = await fs.readFile(artifact.path)
    await fs.writeFile(target, data)
    entry.artifacts.push({
      format: artifact.format,
      path: path.relative(root, target).split(path.sep).join('/'),
      bytes: data.length,
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      status: artifact.status,
    })
  }
  manifest.samples.push(entry)
  console.log(`${result.status.padEnd(22)} ${sample.id.padEnd(18)} ${entry.artifacts.length} artifacts`)
}

await fs.writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
if (failures) {
  console.error(`${failures} sample(s) failed`)
  process.exitCode = 1
}
