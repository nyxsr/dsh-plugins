/** Brand-kit validation and application. */
import { contrastRatio, ensureContrast, normalizeHex } from '../design/contrast.js'
import { resolveAsset } from '../visuals/assets.js'
import { StudioError } from '../core/errors.js'

const HEX = /^#[0-9a-fA-F]{6}$/

export async function validateBrandKit(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new StudioError('invalid_brand_kit', 'Brand kit harus berupa objek.')
  }
  const warnings = []
  const colors = {}
  for (const key of ['primary', 'secondary', 'accent', 'background', 'text']) {
    if (input.colors?.[key] === undefined) continue
    if (!HEX.test(String(input.colors[key]))) throw new StudioError('invalid_brand_kit', `Warna brand ${key} harus berupa hex 6 digit.`)
    colors[key] = normalizeHex(input.colors[key])
  }
  const kit = {
    organization: String(input.organization ?? '').trim().slice(0, 160),
    logo_path: input.logo_path ? String(input.logo_path).trim().slice(0, 1000) : null,
    colors,
    fonts: {
      heading: String(input.fonts?.heading ?? '').trim().slice(0, 80),
      body: String(input.fonts?.body ?? '').trim().slice(0, 80),
    },
    watermark: String(input.watermark ?? '').trim().slice(0, 80),
    contact: String(input.contact ?? '').trim().slice(0, 300),
    website: String(input.website ?? '').trim().slice(0, 300),
    restrictions: Array.isArray(input.restrictions) ? input.restrictions.map(value => String(value).slice(0, 120)).slice(0, 20) : [],
    reference_style: String(input.reference_style ?? '').trim().slice(0, 120),
  }
  if (!kit.organization) throw new StudioError('invalid_brand_kit', 'Brand kit perlu nama organisasi.')
  if (kit.logo_path) {
    const asset = await resolveAsset(kit.logo_path, options)
    if (asset.kind === 'raster' && asset.bytes > 5 * 1024 * 1024) warnings.push('Logo brand lebih besar dari 5 MiB. Sebaiknya pakai berkas yang sudah dioptimalkan.')
  }
  const bg = kit.colors.background ?? '#FFFFFF'
  const text = kit.colors.text ?? '#111111'
  const textContrast = contrastRatio(text, bg)
  if (textContrast < 4.5) {
    warnings.push(`Kontras teks brand terhadap latar hanya ${textContrast.toFixed(2)}:1. Warna teks isi akan disesuaikan agar lolos WCAG AA.`)
    kit.colors.text = ensureContrast(text, bg, 4.5).color
  }
  if (kit.colors.primary) {
    const primaryOnBg = contrastRatio(kit.colors.primary, bg)
    if (primaryOnBg < 3) warnings.push(`Warna utama brand hanya punya kontras ${primaryOnBg.toFixed(2)}:1 terhadap latar.`)
  }
  return { brand_kit: kit, warnings, contrast: { text_on_background: Number(textContrast.toFixed(2)), primary_on_background: kit.colors.primary ? Number(contrastRatio(kit.colors.primary, bg).toFixed(2)) : null } }
}

export async function applyBrandKit(document, brandKitInput, options = {}) {
  const { brand_kit: kit, warnings, contrast } = await validateBrandKit(brandKitInput, options)
  const next = structuredClone(document)
  next.brand = {
    ...(next.brand ?? {}),
    ...kit,
  }
  if (kit.colors.primary && next.theme?.tokens) next.theme.tokens.accent = kit.colors.primary
  if (kit.reference_style) {
    next.reference = next.reference ?? { fidelity: 'brand_matched', profile: null, source: 'brand_kit' }
    next.reference.fidelity = 'brand_matched'
  }
  return {
    document: next,
    brand_report: {
      organization: kit.organization,
      logo_path: kit.logo_path,
      colors: kit.colors,
      fonts: kit.fonts,
      restrictions: kit.restrictions,
      contrast,
      warnings,
    },
  }
}
