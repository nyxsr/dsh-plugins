import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { editPdf } from '../../src/editing/pdf_editor.js'
import { redesignPdf } from '../../src/editing/redesign.js'
import { analyzeReference } from '../../src/design/reference_analyzer.js'
import { createStudio } from '../../src/api/service.js'
import { resolveTheme } from '../../src/design/themes.js'
import { selectDesign } from '../../src/design/adaptive_selector.js'
import { validateDocument } from '../../src/core/models.js'
import { generatePdf } from '../../src/core/pipeline.js'
import { freshDir, miniDocument, PACKAGE_ROOT, describePdf } from '../helpers.js'

const studio = createStudio({ workspaceRoot: PACKAGE_ROOT })

async function makeSourcePdf(dir, name = 'source.pdf') {
  const generated = await generatePdf({ document: miniDocument({ document_id: 'edit-source-fixture' }), output_dir: dir }, { workspaceRoot: PACKAGE_ROOT })
  return generated.pdf_path
}

test('pdf editing performs rotate, metadata, watermark, and page numbers with structured output', async () => {
  const dir = await freshDir('edit-ops')
  const source = await makeSourcePdf(dir)
  const result = await editPdf({
    input_path: source,
    workspaceRoot: PACKAGE_ROOT,
    config: { output_root: 'tests/.tmp/edit-ops-out' },
    operations: [
      { operation: 'rotate', degrees: 90, pages: [2] },
      { operation: 'watermark', text: 'SYNTHETIC TEST', opacity: 0.12, rotation: 0 },
      { operation: 'page_numbers', align: 'center' },
      { operation: 'metadata', metadata: { title: 'Edited fixture', author: 'AI PDF Studio tests' } },
    ],
  })
  assert.equal(result.status, 'success')
  assert.equal(result.operations_applied.length, 4)
  assert.equal(result.lossless, false)
  assert.ok(result.page_count >= 4)
  const description = await describePdf(result.output_path)
  assert.equal(description.title, 'Edited fixture')
  assert.equal(description.author, 'AI PDF Studio tests')
  assert.match(description.text, /SYNTHETIC TEST/)
  assert.match(description.text, /Page 1 of/)
})

test('pdf editing rejects unsafe paths and unsupported operations', async () => {
  await assert.rejects(() => editPdf({
    input_path: '../outside.pdf', workspaceRoot: PACKAGE_ROOT, config: {},
    operations: [{ operation: 'rotate', degrees: 90 }],
  }), error => ['input_not_found', 'input_outside_workspace', 'path_unsafe'].includes(error.code))
  await assert.rejects(() => editPdf({
    input_path: 'package.json', workspaceRoot: PACKAGE_ROOT, config: {},
    operations: [{ operation: 'teleport' }],
  }), error => error.code === 'invalid_pdf' || error.code === 'unsupported_edit')
})

test('extract text and images produce artifacts', async () => {
  const dir = await freshDir('edit-extract')
  const source = await makeSourcePdf(dir)
  const result = await editPdf({
    input_path: source, workspaceRoot: PACKAGE_ROOT,
    config: { output_root: 'tests/.tmp/edit-extract-out' },
    operations: [{ operation: 'extract_text' }, { operation: 'extract_images' }],
  })
  const extract = result.operations_applied.find(operation => operation.operation === 'extract_text')
  assert.ok(extract.characters > 200)
  const { readFile } = await import('node:fs/promises')
  const flat = (await readFile(extract.path, 'utf8')).replace(/\s+/g, ' ')
  assert.match(flat, /controlled production fixture/)
  assert.equal(result.lossless, false)
})

test('redesign reconstructs text from a source PDF and reports losses', async () => {
  const dir = await freshDir('redesign')
  const source = await makeSourcePdf(dir)
  const result = await redesignPdf({
    pdf_path: source,
    title: 'Reconstructed fixture',
    theme_family: 'minimalist_clean',
    output_dir: path.join(dir, 'redesign-out'),
  }, { config: { workspace_root: PACKAGE_ROOT, output_root: 'tests/.tmp/redesign-out' } })
  assert.equal(result.reconstruction.lossy, true)
  assert.equal(result.reconstruction.source_pages >= 4, true)
  assert.ok(result.reconstruction.reconstructed_sections >= 2)
  assert.match(result.reconstruction.method, /pdftotext/)
  assert.ok(result.reconstruction.unsupported_elements.includes('tables'))
  const description = await describePdf(result.pdf_path)
  assert.match(description.text.replace(/\s+/g, ' '), /controlled production fixture/)
  assert.match(description.text, /Rekonstruksi yang tidak persis/)
})

test('redesign rejects scanned PDFs without a text layer', async () => {
  const dir = await freshDir('redesign-scanned')
  const fake = path.join(dir, 'scanned.pdf')
  const { writeFile } = await import('node:fs/promises')
  await writeFile(fake, Buffer.from('not a real pdf'))
  await assert.rejects(() => redesignPdf({
    pdf_path: fake,
  }, { config: { workspace_root: PACKAGE_ROOT, output_root: 'tests/.tmp/redesign-out' } }),
  error => error.code === 'invalid_pdf')
})

test('reference analysis extracts a profile with labelled estimates', async () => {
  const dir = await freshDir('reference')
  const source = await makeSourcePdf(dir)
  const result = await analyzeReference({ referencePath: source, workDir: dir, fidelity: 'inspired' })
  const profile = result.profile
  assert.match(profile.colors.primary, /^#[0-9A-F]{6}$/)
  assert.ok(profile.typography.estimated)
  assert.ok(profile.layout.estimated || profile.layout.columns !== undefined)
  assert.ok(profile.warnings.some(warning => /perkiraan|estimasi|diambil dari/i.test(warning)))
  assert.ok(result.analyzed_pages >= 1)
  const adapted = await analyzeReference({ referencePath: source, workDir: dir, userProfile: { visual_style: 'minimalist_clean', colors: { primary: '#111111' } } })
  assert.equal(adapted.profile.source.method, 'user_authored')
  assert.equal(adapted.profile.confidence, 1)
})

test('studio service exposes the ten API operations', async () => {
  for (const method of ['generate_pdf', 'preview_pdf', 'inspect_pdf', 'edit_pdf', 'redesign_pdf', 'list_templates', 'analyze_design_reference', 'apply_brand_kit', 'validate_document', 'export_pdf']) {
    assert.equal(typeof studio[method], 'function', method)
  }
  const capabilities = await studio.capabilities()
  assert.equal(capabilities.supports.ocr, false)
  assert.equal(capabilities.supports.vision_model_inside_engine, false)
  assert.ok(capabilities.themes.length === 8)
})

test('validate_document returns structured errors without rendering', async () => {
  const result = await studio.validate_document({ document: { title: '', category: 'unknown', sections: [] } })
  assert.equal(result.status, 'invalid')
  assert.ok(result.errors.length >= 3)
  assert.equal(result.document, null)
})
