/**
 * Adaptive design selection.
 *
 * The selector is deterministic and explainable: category, audience, purpose,
 * reference style, brand constraints, page size, and content density all vote.
 * It never randomizes a theme within one document.
 */
import { DESIGN_FAMILIES } from '../core/models.js'
import { THEMES, THEME_KEYS } from './themes.js'

const CATEGORY_BASE = Object.freeze({
  report: 'modern_corporate',
  proposal: 'premium_editorial',
  ebook: 'minimalist_clean',
  presentation: 'creative_bold',
  brochure: 'luxury_elegant',
  academic: 'academic_professional',
  company_profile: 'modern_corporate',
  catalog: 'infographic_visual',
})

const PURPOSE_HINTS = [
  { pattern: /investor|fundrais|venture|pitch|investasi|pendanaan/i, family: 'creative_bold', reason: 'presentasi untuk investor lebih kuat dengan dek yang berani dan mudah diingat' },
  { pattern: /academic|research|journal|peer.review|riset|akadem/i, family: 'academic_professional', reason: 'pembaca riset mengharapkan struktur tenang yang ramah sitasi' },
  { pattern: /luxury|premium|exclusive|mewah|premium/i, family: 'luxury_elegant', reason: 'cerita produk premium cocok dengan isyarat mewah yang ditahan' },
  { pattern: /data|analytic|dashboard|infographic|visuali[sz]/i, family: 'infographic_visual', reason: 'penjelasan data lebih jelas lewat perlakuan infografis modular' },
  { pattern: /technology|platform|api|futur|ai\b|digital/i, family: 'technology_futuristic', reason: 'narasi platform teknis butuh kejelasan seperti panel instrumen' },
  { pattern: /editorial|magazine|essay|thought.lead/i, family: 'premium_editorial', reason: 'dokumen yang dibangun oleh argumen cocok dengan irama editorial' },
]

const STYLE_MAP = Object.freeze({
  modern_corporate: 'modern_corporate',
  corporate: 'modern_corporate',
  premium_editorial: 'premium_editorial',
  editorial: 'premium_editorial',
  minimalist_clean: 'minimalist_clean',
  minimal: 'minimalist_clean',
  creative_bold: 'creative_bold',
  bold: 'creative_bold',
  technology_futuristic: 'technology_futuristic',
  tech: 'technology_futuristic',
  luxury_elegant: 'luxury_elegant',
  luxury: 'luxury_elegant',
  academic_professional: 'academic_professional',
  academic: 'academic_professional',
  infographic_visual: 'infographic_visual',
  infographic: 'infographic_visual',
})

function contentDensity(document) {
  let characters = 0
  let visuals = 0
  for (const section of document.sections ?? []) {
    for (const block of section.blocks ?? []) {
      if (block.type === 'paragraph') characters += (block.text ?? '').length
      if (block.type === 'list') for (const item of block.items ?? []) characters += (item.text ?? '').length
      if (['chart', 'diagram', 'image', 'kpi'].includes(block.type)) visuals += 1
    }
  }
  return { characters, visuals, dense: characters > 7000 || visuals > 8 }
}

/**
 * @param {object} document normalized IR
 * @param {{template?: object}} [options]
 */
export function selectDesign(document, options = {}) {
  const reasons = []
  let family = document.theme?.family
  if (family) {
    reasons.push(`explicit theme family "${family}" requested`)
  }
  if (!family && options.template?.theme) {
    family = options.template.theme
    reasons.push(`category template "${options.template.name}" supplies ${family}`)
  }
  const referenceStyle = STYLE_MAP[document.reference?.profile?.visual_style]
  if (!family && referenceStyle) {
    family = referenceStyle
    reasons.push(`reference profile visual_style "${document.reference.profile.visual_style}" maps to ${family}`)
  }
  if (!family) {
    family = CATEGORY_BASE[document.category] ?? 'modern_corporate'
    reasons.push(`category "${document.category}" defaults to ${family}`)
  }
  const combined = `${document.purpose ?? ''} ${document.audience ?? ''} ${document.title ?? ''}`
  for (const hint of PURPOSE_HINTS) {
    if (hint.pattern.test(combined) && (!document.theme?.family && !options.template)) {
      family = hint.family
      reasons.push(hint.reason)
      break
    }
  }
  if (!THEME_KEYS.includes(family)) family = 'modern_corporate'
  const theme = THEMES[family]
  const density = contentDensity(document)
  let densityPlan = theme.layout.density
  if (density.dense && densityPlan === 'generous') {
    densityPlan = 'comfortable'
    reasons.push('kepadatan konten tinggi, jadi jarak diturunkan satu tingkat tanpa mengecilkan huruf')
  }
  if (document.category === 'presentation') {
    densityPlan = 'compact'
    reasons.push('halaman presentasi memakai teks pendukung ringkas dan satu gagasan utama per halaman')
  }
  return {
    family,
    theme: theme.key,
    theme_name: theme.name,
    cover: theme.layout.cover,
    section: theme.layout.section,
    density: densityPlan,
    body_width: theme.layout.bodyWidth,
    reasons,
    alternatives: DESIGN_FAMILIES.filter(key => key !== family).slice(0, 3),
    content_density: density.dense ? 'high' : density.visuals > 4 ? 'visual' : 'standard',
    page_size: document.page?.size,
    target_score: document.quality?.target_score ?? 90,
    accessibility: {
      body_contrast: theme.contrast?.body ?? null,
      muted_contrast: theme.contrast?.muted ?? null,
      minimum_body_text_pt: theme.type.body,
    },
  }
}
