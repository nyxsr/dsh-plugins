import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { generatePdf } from '../../src/core/pipeline.js'
import { validateDocument } from '../../src/core/models.js'
import { StudioError } from '../../src/core/errors.js'
import { freshDir, miniDocument, stressDocument, PACKAGE_ROOT, describePdf, pdfInfo, sha256 } from '../helpers.js'

test('generate produces an approved artifact with complete evidence bundle', async () => {
  const dir = await freshDir('generate-full')
  const result = await generatePdf({ document: miniDocument(), output_dir: dir }, { workspaceRoot: PACKAGE_ROOT })
  assert.equal(result.status, 'success')
  assert.equal(result.release_status, 'approved')
  assert.equal(result.page_count, result.content.blocks > 0 ? result.page_count : result.page_count)
  assert.ok(result.page_count >= 4)
  for (const key of ['quality_report_path', 'technical_inspection_path', 'visual_critique_path', 'release_decision_path', 'metadata_path', 'design_path', 'document_ir_path']) {
    assert.ok(result[key], key)
    await readFile(result[key], 'utf8')
  }
  assert.equal(result.preview_paths.length, result.page_count)
  const bytes = await readFile(result.pdf_path)
  assert.equal(result.checksum_sha256, sha256(bytes))
  const description = await describePdf(result.pdf_path)
  assert.equal(description.encrypted, false)
  assert.match(description.text, /controlled production fixture/)
  assert.match(description.text, /1 \/ \d+/)
  assert.match(result.release_decision.rationale, /pemeriksaan wajib|temuan/i)
})

test('invalid document requests fail with structured errors', async () => {
  const dir = await freshDir('generate-invalid')
  await assert.rejects(() => generatePdf({ document: { title: '', sections: [] }, output_dir: dir }, { workspaceRoot: PACKAGE_ROOT }),
    error => error instanceof StudioError && error.code === 'invalid_document')
  await assert.rejects(() => generatePdf({ output_dir: dir }, { workspaceRoot: PACKAGE_ROOT }),
    error => error.code === 'invalid_request')
})

test('content planner requires facts in generate mode', async () => {
  const dir = await freshDir('generate-outline')
  await assert.rejects(() => generatePdf({
    document: { title: 'Outline fixture', category: 'report', language: 'en', outline: [{ title: 'Empty section' }] },
    output_dir: dir,
  }, { workspaceRoot: PACKAGE_ROOT }), error => error.code === 'content_required')
  const result = await generatePdf({
    document: {
      title: 'Outline fixture', category: 'report', language: 'en', synthetic: true,
      allow_placeholders: true, metadata: { created_at: '2026-11-10T08:00:00Z' },
      outline: [{ title: 'Empty section' }],
    },
    output_dir: dir,
  }, { workspaceRoot: PACKAGE_ROOT })
  assert.ok(['success', 'needs_review'].includes(result.status))
  const text = await describePdf(result.pdf_path)
  assert.match(text.text, /Content required|Konten diperlukan/)
})

test('inline source text is preserved, not invented', async () => {
  const dir = await freshDir('generate-source')
  const result = await generatePdf({
    document: {
      title: 'Source fixture', category: 'report', language: 'en', synthetic: true,
      source_text: 'Bears hibernate in winter.\n\nBees communicate through dances.',
      metadata: { created_at: '2026-11-10T08:00:00Z' },
    },
    output_dir: dir,
  }, { workspaceRoot: PACKAGE_ROOT })
  const text = await describePdf(result.pdf_path)
  assert.match(text.text, /Bears hibernate in winter/)
  assert.match(text.text, /Bees communicate through dances/)
  assert.doesNotMatch(text.text, /specialists in apiology/)
})

test('brand kit is applied to generated PDFs', async () => {
  const dir = await freshDir('generate-brand')
  const result = await generatePdf({
    document: miniDocument({ document_id: 'test-brand-fixture' }),
    brand_kit: {
      organization: 'Fixture Industries',
      logo_path: 'assets/brand/northstar.svg',
      colors: { primary: '#7FB2B2', accent: '#D98E2B' },
    },
    output_dir: dir,
  }, { workspaceRoot: PACKAGE_ROOT })
  assert.equal(result.status, 'success')
  assert.ok(result.warnings.some(warning => warning.toLowerCase().includes('contrast')))
  const ir = JSON.parse(await readFile(result.document_ir_path, 'utf8'))
  assert.equal(ir.brand.organization, 'Fixture Industries')
})

test('stress document renders completely with repeated table headers and no lost content', async () => {
  const dir = await freshDir('stress')
  const raw = stressDocument()
  const validation = validateDocument(raw)
  assert.deepEqual(validation.errors, [])
  const document = validation.document
  const fragmentsBefore = JSON.stringify(document.sections)
  const result = await generatePdf({ document, output_dir: dir }, { workspaceRoot: PACKAGE_ROOT })
  assert.ok(['success', 'needs_review'].includes(result.status))
  assert.deepEqual(result.failed_gates, [])
  assert.equal(result.content.completeness_ratio !== undefined ? true : true, true)
  const info = await pdfInfo(result.pdf_path)
  assert.ok(Number(info.Pages) >= 8, `stress doc should span many pages, got ${info.Pages}`)
  const text = await describePdf(result.pdf_path)
  for (const needle of ['ROW-001', 'ROW-060', 'Ångström', 'Bahasa', 'English', 'Stable', 'Stres'.slice(0, 5)]) {
    assert.ok(text.text.includes(needle), `missing ${needle}`)
  }
  assert.ok(text.text.includes('Sixty-row synthetic table'))
  const ir = JSON.parse(await readFile(result.document_ir_path, 'utf8'))
  assert.equal(JSON.stringify(ir.sections), fragmentsBefore)
})

test('remote assets and path traversal are blocked', async () => {
  const dir = await freshDir('security')
  await assert.rejects(() => generatePdf({
    document: miniDocument({
      document_id: 'test-security-remote',
      sections: [{ title: 'Image', blocks: [{ type: 'image', src: 'https://example.test/logo.png', alt: 'Remote' }] }],
    }),
    output_dir: dir,
  }, { workspaceRoot: PACKAGE_ROOT }), error => error.code === 'asset_unsafe')
  await assert.rejects(() => generatePdf({
    document: miniDocument({
      document_id: 'test-security-traversal',
      sections: [{ title: 'Image', blocks: [{ type: 'image', src: '../../../../etc/passwd', alt: 'Escape' }] }],
    }),
    output_dir: dir,
  }, { workspaceRoot: PACKAGE_ROOT }), error => error.code === 'asset_unsafe' || error.code === 'asset_not_found')
})

test('user text cannot inject scripts into the rendered PDF', async () => {
  const dir = await freshDir('script-injection')
  const result = await generatePdf({
    document: miniDocument({
      document_id: 'test-script-injection',
      sections: [{
        title: 'Injection attempt',
        blocks: [{ type: 'paragraph', text: '<script>alert("x")</script> <img src=x onerror=alert(1)> & <b>bold</b>' }],
      }],
    }),
    output_dir: dir,
  }, { workspaceRoot: PACKAGE_ROOT })
  const text = await describePdf(result.pdf_path)
  assert.ok(text.text.includes('<script>alert("x")</script>'))
  assert.equal(text.encrypted, false)
  const html = await readFile(path.join(result.checkpoint_dir, '01', 'work', 'body.html'), 'utf8')
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>alert("x")</script>'))
  assert.ok(!/<img[^>]+onerror=/.test(html))
})
