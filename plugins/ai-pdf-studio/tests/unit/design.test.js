import test from 'node:test'
import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { THEME_LIST, resolveTheme } from '../../src/design/themes.js'
import { buildStyles } from '../../src/render/styles.js'
import { selectDesign } from '../../src/design/adaptive_selector.js'
import { listTemplates } from '../../src/templates/registry.js'
import { validateDocument } from '../../src/core/models.js'
import { validateBrandKit } from '../../src/branding/brandkit.js'
import { PACKAGE_ROOT } from '../helpers.js'

function doc(family = 'modern_corporate', category = 'report') {
  const result = validateDocument({
    title: 'Design fixture', category, language: 'en', theme: { family },
    sections: [{ title: 'One', blocks: [{ type: 'paragraph', text: 'Body text that is long enough to evaluate contrast and typography.' }] }],
  })
  assert.deepEqual(result.errors, [])
  return result.document
}

test('eight design families are registered and resolve with accessible body text', () => {
  assert.equal(THEME_LIST.length, 8)
  assert.equal(new Set(THEME_LIST.map(theme => theme.key)).size, 8)
  for (const theme of THEME_LIST) {
    const resolved = resolveTheme(doc(theme.key))
    assert.ok(resolved.theme.contrast.body >= 4.5, `${theme.key} body contrast ${resolved.theme.contrast.body}`)
    assert.ok(resolved.theme.contrast.muted >= 4.5, `${theme.key} muted contrast ${resolved.theme.contrast.muted}`)
    const css = buildStyles(doc(theme.key), resolved.theme, selectDesign(doc(theme.key)))
    assert.match(css, /@page/)
    assert.doesNotMatch(css, /var\(--accent2\)/, `${theme.key} uses an undefined CSS token`)
    assert.match(css, /--accent-2:/)
  }
})

test('adaptive selector maps every category to a deliberate family', () => {
  const expected = {
    report: 'modern_corporate',
    proposal: 'premium_editorial',
    ebook: 'minimalist_clean',
    presentation: 'creative_bold',
    brochure: 'luxury_elegant',
    academic: 'academic_professional',
  }
  for (const [category, family] of Object.entries(expected)) {
    const document = doc(null, category)
    const selection = selectDesign(document)
    assert.equal(selection.family, family)
    assert.ok(selection.reasons.length > 0)
  }
})

test('six category templates have distinct structures and real preview images', async () => {
  const templates = await listTemplates()
  assert.equal(templates.length, 6)
  assert.equal(new Set(templates.map(template => template.structural_signature)).size, 6)
  for (const template of templates) {
    assert.ok(template.preview)
    const preview = path.join(PACKAGE_ROOT, template.preview)
    await access(preview)
  }
})

test('brand kit applies colors and reports low-contrast warnings', async () => {
  const result = await validateBrandKit({
    organization: 'Fixture Brand',
    logo_path: 'assets/brand/northstar.svg',
    colors: { primary: '#0B6E6E', background: '#FFFFFF', text: '#BBBBBB' },
  }, { workspaceRoot: PACKAGE_ROOT })
  assert.equal(result.brand_kit.organization, 'Fixture Brand')
  assert.ok(result.warnings.some(warning => /kontras|contrast/i.test(warning)))
  assert.ok(result.contrast.text_on_background < 4.5)
  assert.doesNotThrow(() => new URL('https://example.test'))
})

test('reference profile adapts palette but preserves contrast', () => {
  const document = doc('premium_editorial')
  document.reference = {
    fidelity: 'inspired',
    profile: {
      visual_style: 'premium_editorial',
      colors: { primary: '#9C2C2C', accent: '#B89457', background: '#FBEFD8', text: '#191714' },
      layout: { whitespace: 'generous' },
      typography: { hierarchy: 'high_contrast', heading_style: 'editorial_serif' },
    },
  }
  const resolved = resolveTheme(document)
  assert.ok(resolved.theme.reference_applied)
  assert.ok(resolved.theme.contrast.body >= 4.5)
  assert.ok(resolved.theme.contrast.muted >= 4.5)
  assert.ok(resolved.theme.colors.accent.startsWith('#'))
})
