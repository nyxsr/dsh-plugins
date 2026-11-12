/**
 * Evidence-based design quality scoring.
 *
 * Scores are diagnostic. Mandatory gates are authoritative and cannot be
 * outvoted by a high aggregate score. A dimension with no applicable evaluator
 * is marked unevaluated and excluded from the weighted average.
 */
import { contrastRatio } from '../design/contrast.js'

const WEIGHTS = Object.freeze({
  content: 0.25,
  layout: 0.25,
  typography: 0.15,
  visual: 0.15,
  brand: 0.10,
  technical: 0.10,
})

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function dimension(score, weight, evaluator, criteria, evidence, evaluated = true) {
  return {
    score: evaluated ? Math.round(clamp(score) * 10) / 10 : null,
    weight,
    evaluated,
    evaluator,
    criteria,
    evidence,
  }
}

function countSeverity(messages, severity) {
  return (messages ?? []).filter(message => message.severity === severity).length
}

function wordTarget(document) {
  const targets = {
    report: 1400, proposal: 1800, ebook: 2200, presentation: 500,
    brochure: 700, academic: 2200, company_profile: 1000, catalog: 600,
  }
  return targets[document.category] ?? 1200
}

/**
 * @param {object} args
 * @param {object} args.document
 * @param {object} args.theme
 * @param {object} args.inspection
 * @param {object} args.design
 * @param {Array} [args.reviewMessages]
 * @param {object} [args.manualVisualReview]
 */
export function scoreDocument({ document, theme, inspection, design, reviewMessages = [], manualVisualReview = null }) {
  const s = inspection.score_inputs
  const completeness = s.completeness_ratio
  const words = s.body_words
  const target = wordTarget(document)
  const sectionCount = document.sections.filter(section => !section.divider).length
  const editorialPenalty =
    countSeverity(reviewMessages, 'critical') * 18
    + countSeverity(reviewMessages, 'major') * 7
    + countSeverity(reviewMessages, 'minor') * 2
  const wordScore = words >= target * 0.75 ? 100 : words >= target * 0.45 ? 80 : words >= target * 0.25 ? 60 : 35
  const sectionScore = sectionCount >= 5 ? 100 : sectionCount >= 3 ? 82 : sectionCount >= 2 ? 65 : 40
  const contentScore = completeness * 55 + wordScore * 0.25 + sectionScore * 0.1 + Math.max(0, 100 - editorialPenalty) * 0.1

  const layoutPenalty =
    s.outside_page_words * 18
    + s.near_edge_body_words * 10
    + s.collisions * 12
    + (s.no_blank_pages ? 0 : 22)
    + (s.layout_audit_ok ? 0 : 16)
    + (inspection.visual.overcrowded_pages.length ? 8 : 0)
    + (s.min_body_margin_pt !== null && s.min_body_margin_pt < 30 ? 12 : 0)
    + (s.body_ink_variance > 0.02 ? 8 : 0)
  const layoutScore = 100 - layoutPenalty

  const contrast = contrastRatio(theme.colors.ink, theme.colors.bg)
  const mutedContrast = contrastRatio(theme.colors.muted, theme.colors.bg)
  const bodyFont = inspection.typography?.estimated_body_font_pt ?? null
  const typographyPenalty =
    (s.fonts_embedded ? 0 : 35)
    + (contrast < 4.5 ? 22 : 0)
    + (mutedContrast < 4.5 ? 8 : 0)
    + (bodyFont !== null && bodyFont < 8.5 ? 18 : 0)
    + (inspection.typography?.max_line_overflow ? 10 : 0)
    + (inspection.metadata?.tagged ? 0 : 3)
  const typographyScore = 100 - typographyPenalty

  const visual = inspection.visual
  const ink = visual.body_ink_mean
  let visualPenalty = 0
  if (ink === null || ink < 0.012) visualPenalty += 12
  if (ink !== null && ink > 0.34) visualPenalty += 10
  if (visual.body_ink_variance > 0.02) visualPenalty += 6
  if (visual.average_colorfulness !== null && visual.average_colorfulness < 0.025) visualPenalty += 6
  if (s.min_body_margin_pt !== null && s.min_body_margin_pt < 36) visualPenalty += 6
  const thematicAssets = (document.sections ?? []).flatMap(section => section.blocks).filter(block => ['chart', 'diagram', 'kpi', 'image', 'quote'].includes(block.type)).length
  if (thematicAssets === 0) visualPenalty += 13
  let visualScore = 100 - visualPenalty
  const visualEvidence = [
    `rata-rata tinta isi ${ink === null ? 'tidak tersedia' : ink.toFixed(4)}`,
    `variansi tinta ${visual.body_ink_variance}`,
    `rata-rata kekayaan warna ${visual.average_colorfulness ?? 'tidak tersedia'}`,
    `blok visual tematik ${thematicAssets}`,
    `tinjauan halaman subjek: ${manualVisualReview?.reviewed ? `${manualVisualReview.pages_reviewed?.length ?? 0} halaman ditinjau` : 'tidak dijalankan'}`,
  ]
  if (manualVisualReview?.reviewed) {
    visualScore = manualVisualReview.score ?? visualScore
    for (const finding of manualVisualReview.findings ?? []) {
      if (finding.severity === 'critical') visualScore -= 20
      else if (finding.severity === 'major') visualScore -= 8
      else visualScore -= 2
    }
    visualEvidence.push(`${(manualVisualReview.findings ?? []).length} temuan visual manual`)
  }

  let brandScore = null
  let brandEvaluated = false
  const brandEvidence = []
  if (document.brand?.organization || document.brand?.logo_path || document.brand?.colors) {
    brandEvaluated = true
    brandScore = 100
    const brandContrast = document.brand.colors?.primary
      ? contrastRatio(document.brand.colors.primary, document.brand.colors.background ?? theme.colors.bg)
      : contrast
    if (brandContrast < 4.5) brandScore -= 25
    if (document.brand.logo_path && !document.assets?.some(asset => asset.path === document.brand.logo_path)) {
      brandScore -= 8
      brandEvidence.push('logo brand disebut, tetapi tidak ada di manifes aset')
    } else if (document.brand.logo_path) {
      brandEvidence.push('aset logo brand tersedia')
    }
    brandEvidence.push(`kontras utama brand ${brandContrast.toFixed(2)}:1`)
    brandEvidence.push(`keluarga tema ${theme.key}`)
  } else {
    brandEvidence.push('brand kit belum diberikan, jadi konsistensi brand tidak dinilai')
  }

  const gateCount = Object.keys(inspection.gates).length
  const gatesPassed = Object.values(inspection.gates).filter(Boolean).length
  const technicalScore = (gatesPassed / gateCount) * 80 + (contrast >= 4.5 ? 10 : 0) + (mutedContrast >= 4.5 ? 10 : 0)

  const dimensions = {
    content: dimension(contentScore, WEIGHTS.content, 'deterministic_inspection+editorial_review', {
      completeness: 'Fragmen teks yang diharapkan ditemukan di teks PDF hasil ekstraksi',
      depth: 'Jumlah kata isi yang terlihat dibandingkan target kategori',
      structure: 'Jumlah bagian selain pembatas',
      editorial: 'Temuan editorial kritis, mayor, dan minor',
    }, [
      `${(completeness * 100).toFixed(2)}% fragmen konten cocok`,
      `${words}/${target} kata target`,
      `${sectionCount} bagian konten`,
      `${editorialPenalty} penalti editorial`,
    ]),
    layout: dimension(layoutScore, WEIGHTS.layout, 'deterministic_geometry+page_metrics', {
      clipping: 'Kata di luar halaman atau di dalam tepi isi 18pt',
      collisions: 'Kotak kata yang bertumpuk',
      pagination: 'Halaman kosong dan jumlah halaman',
      rhythm: 'Variansi kepadatan tinta',
    }, [
      `${s.outside_page_words} kata di luar halaman`,
      `${s.near_edge_body_words} kata isi mendekati tepi`,
      `${s.collisions} tumbukan`,
      `${inspection.visual.blank_pages.length} halaman kosong`,
      `margin isi minimum ${s.min_body_margin_pt ?? 'n/a'}pt`,
      `variansi tinta ${s.body_ink_variance}`,
    ]),
    typography: dimension(typographyScore, WEIGHTS.typography, 'deterministic_inspection', {
      embedding: 'Semua font tertanam',
      contrast: 'Kontras teks isi menurut WCAG',
      size: 'Perkiraan ukuran teks isi',
    }, [
      `${inspection.typography.font_count} font, tertanam=${inspection.typography.all_embedded}`,
      `kontras isi ${contrast.toFixed(2)}:1`,
      `kontras teks redup ${mutedContrast.toFixed(2)}:1`,
      `perkiraan ukuran isi ${bodyFont ?? 'n/a'}pt`,
      `PDF bertag: ${inspection.metadata?.tagged ? 'ya' : 'tidak'}`,
    ]),
    visual: dimension(visualScore, WEIGHTS.visual, manualVisualReview?.reviewed ? 'page_metrics+agent_visual_review' : 'page_metrics_only', {
      density: 'Cakupan tinta dan keseimbangan ruang kosong',
      consistency: 'Variansi kepadatan tinta di halaman isi',
      colour: 'Rata-rata kekayaan warna',
      craft: 'Tinjauan manual atau VLM bila tersedia',
    }, visualEvidence),
    brand: dimension(brandScore ?? 0, WEIGHTS.brand, 'brand_kit_validator', {
      logo: 'Kehadiran dan skala logo',
      palette: 'Kontras warna brand',
      application: 'Resolusi tema',
      restricted: 'Batasan brand',
    }, brandEvidence, brandEvaluated),
    technical: dimension(technicalScore, WEIGHTS.technical, 'mandatory_gates', {
      validity: 'Header PDF, keterbacaan, enkripsi',
      geometry: 'Dimensi halaman keluaran',
      accessibility: 'Kontras dan teks yang bisa dicari',
      safety: 'Tanpa JavaScript',
    }, [
      `${gatesPassed}/${gateCount} pemeriksaan wajib lolos`,
      `dimensi ${inspection.dimensions?.width ?? '?'}x${inspection.dimensions?.height ?? '?'}pt`,
      `kontras isi ${contrast.toFixed(2)}:1`,
    ]),
  }

  let weighted = 0
  let totalWeight = 0
  for (const entry of Object.values(dimensions)) {
    if (!entry.evaluated || entry.score === null) continue
    weighted += entry.score * entry.weight
    totalWeight += entry.weight
  }
  const score = totalWeight ? Math.round((weighted / totalWeight) * 10) / 10 : 0
  const gatesOk = Object.values(inspection.gates).every(Boolean)
  const targetScore = document.quality?.target_score ?? 90
  let releaseStatus
  if (!gatesOk) releaseStatus = 'rejected'
  else if (score >= targetScore) releaseStatus = 'approved'
  else if (score >= targetScore - 5) releaseStatus = 'needs_review'
  else releaseStatus = 'needs_review'
  return {
    score,
    target_score: targetScore,
    grade: score >= 90 ? 'excellent' : score >= 80 ? 'good' : score >= 70 ? 'needs_review' : 'poor',
    release_status: releaseStatus,
    gates_ok: gatesOk,
    failed_gates: Object.entries(inspection.gates).filter(([, passed]) => !passed).map(([name]) => name),
    dimensions,
    weights: WEIGHTS,
    evaluated_weight: Number(totalWeight.toFixed(2)),
    visual_review_evaluator: manualVisualReview?.reviewed ? manualVisualReview.reviewer ?? 'agent_visual_review' : 'none',
    notes: [
      'Skor ini alat bantu diagnosis, bukan bukti mutu profesional.',
      gatesOk ? 'Semua pemeriksaan wajib lolos.' : 'Satu atau lebih pemeriksaan wajib gagal, jadi dokumen belum disetujui.',
      dimensions.brand.evaluated ? 'Konsistensi brand dinilai terhadap brand kit yang diberikan.' : 'Konsistensi brand tidak dinilai karena brand kit belum diberikan.',
      manualVisualReview?.reviewed ? 'Tinjauan visual per halaman diberikan.' : 'Tidak ada tinjauan visual subjektif atau VLM. Penilaian visual hanya memakai metrik halaman yang deterministik.',
    ],
  }
}
