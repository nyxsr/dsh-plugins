import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import {
  DOCUMENT_CATEGORIES, DESIGN_FAMILIES, PAGE_SIZES, validateDocument,
  expectedFragments, totalWordCount, findBlock,
} from '../../src/core/models.js'
import { PACKAGE_ROOT, readExample } from '../helpers.js'

test('all six examples validate and cover the required categories', async () => {
  const files = (await readdir(path.join(PACKAGE_ROOT, 'examples'))).filter(file => file.endsWith('.json')).sort()
  assert.equal(files.length, 6)
  const categories = new Set()
  for (const file of files) {
    const raw = await readExample(file)
    const result = validateDocument(raw)
    assert.deepEqual(result.errors, [], file)
    assert.ok(result.document, file)
    assert.equal(result.document.document_id, raw.document_id)
    assert.ok(totalWordCount(result.document) > 600, `${file} should carry substantive content`)
    categories.add(result.document.category)
  }
  for (const category of ['report', 'proposal', 'ebook', 'presentation', 'brochure', 'academic']) {
    assert.ok(categories.has(category), `missing category ${category}`)
  }
})

test('16:9 presentation orientation is inferred as landscape', () => {
  const result = validateDocument({
    title: 'Landscape fixture', category: 'presentation', language: 'en',
    page: { size: 'Presentation16x9' },
    sections: [{ title: 'One', blocks: [{ type: 'paragraph', text: 'A slide.' }] }],
  })
  assert.deepEqual(result.errors, [])
  assert.equal(result.document.page.width_pt, PAGE_SIZES.Presentation16x9.widthPt)
  assert.equal(result.document.page.height_pt, PAGE_SIZES.Presentation16x9.heightPt)
  assert.equal(result.document.page.orientation, 'landscape')
})

test('block and chart validation rejects structural errors', () => {
  const result = validateDocument({
    title: 'Invalid fixture', category: 'report', language: 'en',
    sections: [{
      title: 'Broken', blocks: [
        { type: 'not_a_block', text: 'nope' },
        { type: 'chart', chart_type: 'bar', title: 'Mismatch', data: { categories: ['A', 'B'], series: [{ name: 'S', values: [1] }] } },
        { type: 'table', title: 'Empty table', columns: [], rows: [] },
      ],
    }],
  })
  assert.ok(result.errors.some(error => /type harus salah satu dari/i.test(error)))
  assert.ok(result.errors.some(error => /nilai untuk 2 kategori/i.test(error)))
  assert.ok(result.errors.some(error => /columns tidak boleh kosong/i.test(error)))
})

test('IDs are stable, unique, and traceable to blocks', () => {
  const raw = {
    title: 'ID fixture', category: 'report', language: 'en',
    sections: [
      { title: 'One', blocks: [{ type: 'paragraph', text: 'First.' }, { type: 'paragraph', id: 'custom', text: 'Second.' }] },
      { title: 'Two', blocks: [{ type: 'paragraph', text: 'Third.' }] },
    ],
  }
  const { document } = validateDocument(raw)
  const ids = document.sections.flatMap(section => [section.id, ...section.blocks.map(block => block.id)])
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(findBlock(document, 'custom'))
  assert.ok(expectedFragments(document).some(fragment => fragment.component_id === 'custom'))
})

test('drop-cap completeness uses the readable paragraph tail', () => {
  const { document } = validateDocument({
    title: 'Dropcap fixture', category: 'report', language: 'en',
    sections: [{ title: 'One', blocks: [{ type: 'paragraph', dropcap: true, text: 'Attention is a budget.' }] }],
  })
  const fragments = expectedFragments(document).filter(fragment => fragment.kind.startsWith('paragraph'))
  assert.equal(fragments.length, 1)
  assert.equal(fragments[0].text, 'ttention is a budget.')
})

test('language aliases normalize to en/id', () => {
  for (const [input, expected] of [['English', 'en'], ['Bahasa Indonesia', 'id'], ['indonesian', 'id']]) {
    const { document } = validateDocument({
      title: 'Language fixture', category: 'report', language: input,
      sections: [{ title: 'One', blocks: [{ type: 'paragraph', text: 'Text.' }] }],
    })
    assert.equal(document.language, expected)
  }
})

test('category and design registries are complete', () => {
  assert.deepEqual([...DOCUMENT_CATEGORIES], ['report', 'proposal', 'ebook', 'presentation', 'brochure', 'academic', 'company_profile', 'catalog'])
  assert.deepEqual([...DESIGN_FAMILIES], ['modern_corporate', 'premium_editorial', 'minimalist_clean', 'creative_bold', 'technology_futuristic', 'luxury_elegant', 'academic_professional', 'infographic_visual'])
})
