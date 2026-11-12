import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { assertResult, makeStudio, strictShopSpec } from './helpers.js'
import { createStudio } from '../src/api/studio.js'
import { findChromium } from '../src/render/chromium.js'
import { verifySvgArtifact } from '../src/quality/artifacts.js'
import { decodePng } from '../src/quality/png.js'
import { assertInside, sanitizeFilename } from '../src/core/paths.js'

test('12. PNG generation produces a valid, nonblank raster', async t => {
  const { studio, cleanup } = await makeStudio('png')
  t.after(cleanup)
  const result = await studio.generate({ structured_specification: strictShopSpec(), output_formats: ['png'], scale: 2 })
  assertResult(t, result)
  const png = result.artifacts.find(item => item.format === 'png')
  assert.ok(png)
  const buffer = await fs.readFile(png.path)
  const decoded = decodePng(buffer)
  assert.ok(decoded.width > 600)
  assert.ok(decoded.height > 300)
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG')
})

test('13. SVG generation is standalone, namespaced, and XML-safe', async t => {
  const { studio, cleanup } = await makeStudio('svg')
  t.after(cleanup)
  const result = await studio.generate({ structured_specification: strictShopSpec(), output_formats: ['svg'] })
  assertResult(t, result)
  const artifact = result.artifacts[0]
  const svg = await fs.readFile(artifact.path, 'utf8')
  assert.ok(svg.startsWith('<?xml') || svg.startsWith('<svg'))
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'))
  assert.equal(verifySvgArtifact(svg, { width: result.quality_report.visual.stats.width, height: result.quality_report.visual.stats.height }).status, 'PASSED')
})

test('14. PDF generation has a valid header, EOF, page count, and page geometry', async t => {
  const { studio, cleanup } = await makeStudio('pdf')
  t.after(cleanup)
  const result = await studio.generate({ structured_specification: strictShopSpec(), output_formats: ['pdf'] })
  assertResult(t, result)
  const artifact = result.artifacts.find(item => item.format === 'pdf')
  assert.ok(artifact)
  const buffer = await fs.readFile(artifact.path)
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.ok(buffer.subarray(-2048).toString('latin1').includes('%%EOF'))
  const verification = result.quality_report.export.verifications.find(item => item.format === 'pdf')
  assert.equal(verification.status, 'PASSED')
  assert.ok(verification.metrics.pages >= 1)
  assert.ok(verification.metrics.pageWidth > 0)
  assert.ok(verification.metrics.raster.inkRatio > 0)
})

test('15. Revision adds payments, preserves unrelated elements, and increments revision', async t => {
  const { studio, cleanup } = await makeStudio('revision')
  t.after(cleanup)
  const generated = await studio.generate({ structured_specification: strictShopSpec(), output_formats: ['svg'] })
  assertResult(t, generated)
  const before = await studio.store.load(generated.diagram_id)
  const usersBefore = JSON.stringify(before.nodes.find(node => node.name === 'users'))
  const revised = await studio.revise({
    diagram_id: generated.diagram_id,
    instruction: 'Tambahkan tabel payments dan hubungkan dengan orders. Jangan ubah relasi lainnya. Rapikan layout dan ekspor SVG.',
    output_formats: ['svg'],
  })
  assertResult(t, revised, { allowWarnings: false })
  assert.equal(revised.previous_revision, 1)
  assert.equal(revised.revision, 2)
  assert.ok(revised.changed_node_ids.length >= 1)
  assert.ok(revised.changed_edge_ids.length >= 1)
  const after = await studio.store.load(generated.diagram_id)
  assert.equal(after.nodes.length, 5)
  assert.equal(JSON.stringify(after.nodes.find(node => node.name === 'users')), usersBefore)
  assert.ok(after.nodes.some(node => node.name === 'payments'))
  assert.ok(revised.artifacts.every(item => item.relative_path.includes('-r2-')))
})

test('16. Missing Chromium is reported as a bounded renderer error, not a crash', async () => {
  await assert.rejects(
    () => findChromium('/definitely/not/here/chrome'),
    error => error.code === 'renderer_unavailable',
  )
  const root = await fs.mkdtemp(path.join((await import('node:os')).tmpdir(), 'ai-diagram-no-chromium-'))
  const studio = createStudio({ workspaceRoot: root, storeRoot: '.diagram-store', chromiumPath: '/definitely/not/here/chrome' })
  try {
    const result = await studio.generate({ structured_specification: strictShopSpec(), output_formats: ['png'] })
    assert.equal(result.status, 'FAILED')
    assert.equal(result.errors[0].code, 'renderer_unavailable')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('17. Malicious SVG and malformed renderer syntax are rejected', async t => {
  const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>'
  const check = verifySvgArtifact(malicious)
  assert.equal(check.status, 'FAILED')
  assert.ok(check.errors.some(error => error.code === 'svg_script_forbidden'))

  const { studio, cleanup } = await makeStudio('injection')
  try {
    const result = await studio.generate({
      structured_specification: strictShopSpec(),
      title: '<script>alert(1)</script>',
      output_formats: ['svg'],
    })
    assertResult(t, result)
    const svg = await fs.readFile(result.artifacts[0].path, 'utf8')
    assert.equal(svg.includes('<script>'), false)
    assert.ok(svg.includes('&lt;script&gt;'))
  } finally {
    await cleanup()
  }
})

test('20. Repeated exports never overwrite an earlier artifact', async t => {
  const { studio, cleanup } = await makeStudio('overwrite')
  t.after(cleanup)
  const generated = await studio.generate({ structured_specification: strictShopSpec(), output_formats: ['svg'] })
  assertResult(t, generated)
  const first = await studio.export({ diagram_id: generated.diagram_id, output_formats: ['svg'] })
  const second = await studio.export({ diagram_id: generated.diagram_id, output_formats: ['svg'] })
  assertResult(t, first)
  assertResult(t, second)
  assert.notEqual(first.artifacts[0].path, second.artifacts[0].path)
  assert.notEqual(first.artifacts[0].sha256, '')
})

test('21. Path traversal is blocked at path, filename, and artifact boundaries', async t => {
  const { studio, root, cleanup } = await makeStudio('paths')
  t.after(cleanup)
  assert.throws(() => assertInside(root, path.join(root, '..', 'escape')), error => error.code === 'path_unsafe')
  const id = sanitizeFilename('../../etc/passwd')
  assert.equal(id.includes('/'), false)
  assert.equal(id.includes('..'), false)
  const generated = await studio.generate({ structured_specification: strictShopSpec(), output_formats: ['svg'] })
  await assert.rejects(
    () => studio.store.artifactPath(generated.diagram_id, '../../escape.svg'),
    error => error.code === 'artifact_path_unsafe',
  )
})

test('23. Unavailable visual inspection is disclosed, not fabricated', async t => {
  const { studio, cleanup } = await makeStudio('visual')
  t.after(cleanup)
  const result = await studio.generate({ structured_specification: strictShopSpec(), output_formats: ['svg'] })
  assertResult(t, result)
  assert.equal(result.validation.visual, 'PASSED')
  assert.equal(result.quality_report.visual.method, 'programmatic_geometry_and_png_pixels')
  assert.ok(result.quality_report.unverified_capabilities.some(item => item.includes('Human visual review')))
  assert.ok(result.quality_report.limitations.some(item => item.includes('no human image review')))
})

test('24. Recovers from a bounded render error and re-exports from stored IR', async t => {
  const root = await fs.mkdtemp(path.join((await import('node:os')).tmpdir(), 'ai-diagram-recovery-'))
  const studio = createStudio({ workspaceRoot: root, storeRoot: '.diagram-store', chromiumPath: '/definitely/not/here/chrome' })
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const failed = await studio.generate({ structured_specification: strictShopSpec(), output_formats: ['png'] })
  assert.equal(failed.status, 'FAILED')
  assert.ok(failed.diagram_id)
  const recovered = await studio.export({ diagram_id: failed.diagram_id, output_formats: ['svg'] })
  assertResult(t, recovered)
  assert.equal(recovered.artifacts[0].status, 'VERIFIED')
})
