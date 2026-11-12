/**
 * Sequential multi-role design review.
 *
 * In this environment the roles are deterministic passes inside one process,
 * not separately hosted LLM agents. The contract is deliberately the same as a
 * future multi-model implementation: structured findings, explicit severity,
 * objective/subjective classification, and an orchestrator that cannot let a
 * subjective preference override a measurable rendering failure.
 */
import { documentText, totalWordCount } from '../core/models.js'
import { contrastRatio } from '../design/contrast.js'

const SEVERITY_RANK = { minor: 1, major: 2, critical: 3 }

const ROLE_INFO = [
  { id: 'strategist', name: 'Strategi Dokumen', focus: 'tujuan, audiens, kategori, cara penyampaian' },
  { id: 'content_editor', name: 'Arsitek dan Editor Konten', focus: 'struktur, kelengkapan, kejelasan, kehati-hatian faktual' },
  { id: 'creative_director', name: 'Direktur Kreatif', focus: 'niat desain, identitas, tipografi, sistem visual' },
  { id: 'layout_engineer', name: 'Insinyur Tata Letak', focus: 'grid, pembagian halaman, luapan, tabrakan' },
  { id: 'visual_specialist', name: 'Spesialis Visualisasi Data', focus: 'akurasi grafik, label, skala, tabel' },
  { id: 'render_engineer', name: 'Insinyur Rendering PDF', focus: 'font, teks yang bisa dicari, metadata, tautan' },
  { id: 'visual_critic', name: 'Kritikus Visual', focus: 'keseimbangan, hierarki, kepadatan, irama, konsistensi' },
  { id: 'technical_qa', name: 'Insinyur QA Teknis', focus: 'validitas, geometri, pemotongan, pemeriksaan keamanan' },
  { id: 'editorial_reviewer', name: 'Peninjau Kualitas Editorial', focus: 'koherensi, terminologi, sitasi, pengungkapan' },
  { id: 'orchestrator', name: 'Orkestrator Tinjauan', focus: 'agregasi, resolusi konflik, keputusan rilis' },
]

const CATEGORY_EXPECTATIONS = {
  report: ['kpi', 'chart', 'table'],
  proposal: ['timeline', 'table', 'callout'],
  ebook: ['paragraph', 'list', 'callout'],
  presentation: ['kpi', 'chart'],
  brochure: ['image', 'paragraph'],
  academic: ['table', 'chart', 'citation'],
  company_profile: ['kpi', 'image'],
  catalog: ['image', 'table'],
}

function finding(agentId, document, {
  issue, severity, evidence, action, impact, confidence = 0.85,
  page = null, component = null, classification = 'objective', pageLabel = null,
}) {
  return {
    agent_id: agentId,
    document_id: document.document_id,
    document_version: document.document_version ?? 1,
    page_number: page,
    page_label: pageLabel,
    component_id: component,
    issue_type: issue,
    severity,
    evidence,
    proposed_action: action,
    expected_impact: impact,
    confidence,
    classification,
  }
}

function add(messages, agentId, document, spec) {
  messages.push(finding(agentId, document, spec))
}

function sectionForPage(document, excerpt) {
  const text = String(excerpt ?? '').toLowerCase()
  let best = null
  for (const section of document.sections) {
    if (section.divider) continue
    const title = section.title?.toLowerCase().trim()
    if (title && text.includes(title.slice(0, Math.min(40, title.length)))) {
      if (!best || title.length > best.title.length) best = section
    }
  }
  return best
}

function blockTypes(document) {
  return new Set((document.sections ?? []).flatMap(section => (section.blocks ?? []).map(block => block.type)))
}

function runStrategist(document, design, inspection, messages) {
  if (!document.audience) add(messages, 'strategist', document, { issue: 'missing_audience', severity: 'minor', evidence: 'Audiens belum disebutkan.', action: 'add_audience', impact: 'Nada dan tingkat bacaan tidak bisa diuji terhadap pembaca yang jelas.', confidence: 0.95 })
  if (!document.purpose) add(messages, 'strategist', document, { issue: 'missing_purpose', severity: 'minor', evidence: 'Tujuan komunikasi belum diisi.', action: 'add_purpose', impact: 'Review tidak bisa menilai apakah dokumen mencapai tindakan yang dimaksud.', confidence: 0.95 })
  if (document.category === 'presentation' && document.page.width_pt < document.page.height_pt) add(messages, 'strategist', document, { issue: 'presentation_not_landscape', severity: 'major', evidence: 'Kategori presentasi dipakai dengan halaman portrait.', action: 'set_landscape', impact: 'Slide akan menyisakan ruang kosong atau sulit dibaca di ruang rapat.', confidence: 0.99 })
  if (document.category === 'ebook' && document.page.size !== 'A5') add(messages, 'strategist', document, { issue: 'ebook_page_size', severity: 'minor', evidence: `E-book memakai ${document.page.size}. Ukuran A5 lebih nyaman untuk bacaan panjang.`, action: 'consider_a5', impact: 'Kenyamanan membaca dalam durasi lama bisa berkurang.', confidence: 0.7, classification: 'subjective' })
  if (!design.reasons?.length) add(messages, 'strategist', document, { issue: 'undocumented_design_choice', severity: 'minor', evidence: 'Pemilihan desain tidak punya catatan alasan.', action: 'record_design_rationale', impact: 'Revisi berikutnya tidak bisa menjelaskan kenapa sistem visual ini dipilih.', confidence: 0.8 })
}

function runContentEditor(document, messages) {
  const words = totalWordCount(document)
  const sections = document.sections.filter(section => !section.divider)
  if (sections.length < 3) add(messages, 'content_editor', document, { issue: 'thin_structure', severity: 'major', evidence: `Hanya ada ${sections.length} bagian konten.`, action: 'add_sections', impact: 'Dokumen belum cukup ruang untuk membangun argumen yang utuh.' })
  const text = documentText(document)
  const placeholder = text.match(/\[(?:insert|tbd|todo|placeholder)[^\]]*\]|\bTBD\b|\bTODO\b|lorem ipsum/i)
  if (placeholder) add(messages, 'content_editor', document, { issue: 'unlabelled_placeholder', severity: 'major', evidence: `Masih ada placeholder: “${placeholder[0]}”.`, action: 'resolve_placeholder', impact: 'Placeholder di dokumen rilis membuat teks terasa belum selesai atau mengarang.' })
  const required = CATEGORY_EXPECTATIONS[document.category] ?? []
  const present = blockTypes(document)
  for (const type of required) {
    if (!present.has(type)) add(messages, 'content_editor', document, { issue: `missing_${type}`, severity: type === 'kpi' || type === 'table' ? 'major' : 'minor', evidence: `Kategori ${document.category} biasanya punya komponen ${type}, tetapi tidak ada di dokumen ini.`, action: `add_${type}`, impact: 'Dokumen kehilangan alat bantu keputusan yang penting.' })
  }
  for (const section of sections) {
    if (!section.title || section.title.length < 3) add(messages, 'content_editor', document, { issue: 'weak_heading', severity: 'minor', evidence: `Bagian ${section.id} belum punya judul yang bermakna.`, action: 'improve_heading', impact: 'Navigasi dan hierarki jadi lemah.', component: section.id })
    if (document.category !== 'academic' && section.blocks.every(block => block.type === 'paragraph') && section.blocks.length > 2) add(messages, 'content_editor', document, { issue: 'paragraph_wall', severity: 'minor', evidence: `Bagian “${section.title}” hanya berisi paragraf.`, action: 'add_visual_or_list', impact: 'Membaca cepat dan mengingat isi jadi lebih sulit.', component: section.id, classification: 'subjective' })
  }
  const hasCitations = Boolean(document.citations?.length) || document.sections.some(section => section.blocks.some(block => block.type === 'citation'))
  if (document.category === 'academic' && !hasCitations) add(messages, 'content_editor', document, { issue: 'missing_citations', severity: 'major', evidence: 'Dokumen akademik tidak punya entri sitasi.', action: 'add_sources', impact: 'Klaim tidak bisa dilacak ke sumbernya.' })
  if (document.synthetic) {
    const disclosure = /synthetic|sintetis|demonstration|demonstrasi/i.test(text)
    if (!disclosure) add(messages, 'content_editor', document, { issue: 'missing_synthetic_disclosure', severity: 'critical', evidence: 'Dokumen ditandai sintetis, tetapi isinya tidak mengatakannya.', action: 'add_disclosure', impact: 'Pembaca bisa mengira data demonstrasi sebagai fakta.' })
  }
  const target = document.category === 'presentation' ? 500 : document.category === 'brochure' ? 700 : 1400
  if (words < target * 0.45) add(messages, 'content_editor', document, { issue: 'content_depth', severity: 'minor', evidence: `${words} kata, sementara ${document.category} biasanya butuh sekitar ${target}.`, action: 'develop_content', impact: 'Dokumen bisa terasa seperti kerangka, bukan argumen yang selesai.', classification: 'subjective' })
}

function runCreativeDirector(document, theme, design, messages) {
  const contrast = contrastRatio(theme.colors.ink, theme.colors.bg)
  if (contrast < 4.5) add(messages, 'creative_director', document, { issue: 'body_contrast', severity: 'critical', evidence: `Kontras teks utama ${contrast.toFixed(2)}:1.`, action: 'fix_contrast', impact: 'Teks utama tidak memenuhi WCAG AA.', confidence: 0.99 })
  const muted = contrastRatio(theme.colors.muted, theme.colors.bg)
  if (muted < 4.5) add(messages, 'creative_director', document, { issue: 'muted_contrast', severity: 'major', evidence: `Kontras teks sekunder ${muted.toFixed(2)}:1.`, action: 'fix_muted_contrast', impact: 'Keterangan dan metadata bisa sulit dibaca.' })
  const types = blockTypes(document)
  if (types.size < 4) add(messages, 'creative_director', document, { issue: 'visual_monotony', severity: 'major', evidence: `Hanya ${types.size} jenis blok yang dipakai.`, action: 'add_visual_variety', impact: 'Irama halaman jadi monoton dan lebih sulit dipindai.', classification: 'subjective' })
  const headingFamily = theme.fonts.heading
  if (!headingFamily) add(messages, 'creative_director', document, { issue: 'missing_heading_font', severity: 'major', evidence: 'Font judul tidak berhasil dipilih.', action: 'select_font', impact: 'Hierarki tipografi tidak bisa dipercaya.', confidence: 0.99 })
  if (document.theme?.family && !design.family) add(messages, 'creative_director', document, { issue: 'design_resolution', severity: 'major', evidence: 'Tema diminta, tetapi tidak berhasil dipetakan.', action: 'resolve_theme', impact: 'Rendering akan jatuh ke desain lain tanpa pemberitahuan.', confidence: 0.99 })
  const cover = document.cover?.kind ?? theme.layout.cover
  if (!cover) add(messages, 'creative_director', document, { issue: 'missing_cover_variant', severity: 'major', evidence: 'Varian sampul kosong.', action: 'select_cover', impact: 'Sampul akan memakai tata letak yang belum ditentukan.', confidence: 0.99 })
}

function runLayoutEngineer(document, inspection, messages) {
  for (const page of inspection.visual.page_metrics) {
    const section = sectionForPage(document, page.text_excerpt)
    const component = section?.id ?? null
    if (page.outside_page_words > 0) add(messages, 'layout_engineer', document, { issue: 'content_outside_page', severity: 'critical', evidence: `${page.outside_page_words} kata keluar dari halaman ${page.page_number}.`, action: 'reflow_page', impact: 'Teks terpotong atau hilang saat dicetak.', page: page.page_number, component, confidence: 0.99 })
    if (page.near_edge_body_words > 0) add(messages, 'layout_engineer', document, { issue: 'near_edge_text', severity: 'major', evidence: `${page.near_edge_body_words} kata teks isi berada dalam 18pt tepi halaman ${page.page_number}.`, action: 'increase_margins_or_reflow', impact: 'Pemotongan cetak atau penjilidan bisa memotong teks.', page: page.page_number, component, confidence: 0.9 })
    if (page.collisions?.length && page.page_number > 1) add(messages, 'layout_engineer', document, { issue: 'word_collision', severity: 'critical', evidence: `${page.collisions.length} kotak kata bertumpuk di halaman ${page.page_number}.`, action: 'resolve_collision', impact: 'Teks bisa saling menimpa dan tidak terbaca.', page: page.page_number, component, confidence: 0.86 })
    if (page.blank_candidate && page.page_number > 1) add(messages, 'layout_engineer', document, { issue: 'unexpected_blank_page', severity: 'critical', evidence: `Halaman ${page.page_number} hampir tanpa tinta dan hanya berisi ${page.words} kata.`, action: 'remove_blank_page', impact: 'Halaman kosong menandakan ada cacat pembagian halaman.', page: page.page_number, component, confidence: 0.92 })
    if (page.overcrowded_candidate && page.page_number > 1) add(messages, 'layout_engineer', document, { issue: 'overcrowded_page', severity: 'major', evidence: `Halaman ${page.page_number} punya rasio tinta ${page.ink_ratio}.`, action: 'add_page_break_before', impact: 'Halaman padat melemahkan pemahaman dan menambah risiko cetak.', page: page.page_number, component, confidence: 0.8 })
  }
  for (const overflow of inspection.layout_audit?.overflowing ?? []) add(messages, 'layout_engineer', document, { issue: 'element_overflow', severity: 'major', evidence: `Komponen ${overflow.id} lebih lebar dari wadahnya. scrollWidth ${overflow.scrollWidth}, clientWidth ${overflow.clientWidth}.`, action: 'constrain_component', impact: 'Komponen melewati batas wadah dan bisa terpotong.', component: overflow.id, confidence: 0.95 })
  for (const table of document.sections.flatMap(section => section.blocks).filter(block => block.type === 'table')) {
    if (table.rows.length > 24) add(messages, 'layout_engineer', document, { issue: 'long_table', severity: 'minor', evidence: `Tabel ${table.id} punya ${table.rows.length} baris.`, action: 'verify_table_pagination', impact: 'Judul kolom yang berulang dan pemisahan baris harus tetap terbaca.', component: table.id, confidence: 0.8 })
  }
}

function runVisualSpecialist(document, messages) {
  for (const block of document.sections.flatMap(section => section.blocks)) {
    if (block.type === 'chart') {
      if ((block.data?.categories?.length ?? 0) > 9) add(messages, 'visual_specialist', document, { issue: 'dense_chart_axis', severity: 'minor', evidence: `Grafik ${block.id} punya ${block.data.categories.length} kategori.`, action: 'use_horizontal_bar_or_filter', impact: 'Label sumbu bisa tidak terbaca pada ukuran cetak.', component: block.id, confidence: 0.85 })
      if ((block.data?.series?.length ?? 0) > 4) add(messages, 'visual_specialist', document, { issue: 'too_many_series', severity: 'minor', evidence: `Grafik ${block.id} punya ${block.data.series.length} seri.`, action: 'highlight_primary_series', impact: 'Grafik meminta pembaca membedakan terlalu banyak warna.', component: block.id, confidence: 0.8, classification: 'subjective' })
      if ((block.data?.items?.length ?? 0) > 6 && (block.chart_type === 'donut' || block.chart_type === 'pie')) add(messages, 'visual_specialist', document, { issue: 'pie_fragmentation', severity: 'minor', evidence: `Donut atau pie punya ${block.data.items.length} irisan.`, action: 'group_small_slices', impact: 'Irisan kecil jadi sulit dibedakan.', component: block.id, confidence: 0.8 })
    }
    if (block.type === 'table' && block.columns.length > 8) add(messages, 'visual_specialist', document, { issue: 'wide_table', severity: 'major', evidence: `Tabel ${block.id} punya ${block.columns.length} kolom.`, action: 'split_or_reduce_columns', impact: 'Tabel bisa tidak terbaca pada lebar A4.', component: block.id, confidence: 0.9 })
    if (block.type === 'kpi' && block.items.length > 5) add(messages, 'visual_specialist', document, { issue: 'kpi_overload', severity: 'minor', evidence: `Band KPI berisi ${block.items.length} metrik.`, action: 'reduce_to_three_or_five', impact: 'Pembaca sulit menemukan metrik utama.', component: block.id, confidence: 0.75, classification: 'subjective' })
  }
}

function runRenderEngineer(document, inspection, messages) {
  if (!inspection.typography.all_embedded) add(messages, 'render_engineer', document, { issue: 'font_not_embedded', severity: 'critical', evidence: `${inspection.fonts.filter(font => !font.embedded).length} font tidak tertanam.`, action: 'embed_fonts', impact: 'Teks bisa berganti font atau hilang di mesin lain.', confidence: 0.99 })
  if (inspection.score_inputs.body_chars < 40) add(messages, 'render_engineer', document, { issue: 'text_not_searchable', severity: 'critical', evidence: 'Teks isi yang diekstrak praktis kosong.', action: 'rerender_text_layer', impact: 'PDF tidak bisa dicari dan tidak ramah pembaca layar.', confidence: 0.99 })
  if (document.citations?.some(citation => citation.url) && inspection.annotations.links === 0) add(messages, 'render_engineer', document, { issue: 'links_missing', severity: 'minor', evidence: 'Ada URL sitasi, tetapi tidak ada anotasi tautan yang terdeteksi.', action: 'verify_link_rendering', impact: 'Sumber yang bisa diklik mungkin tidak berfungsi saat dibaca digital.', confidence: 0.75 })
  if (!inspection.metadata.title) add(messages, 'render_engineer', document, { issue: 'missing_pdf_title', severity: 'major', evidence: 'Judul di metadata PDF kosong.', action: 'set_metadata', impact: 'Identitas dokumen lemah di pembaca PDF dan arsip.', confidence: 0.99 })
}

function runVisualCritic(document, theme, inspection, manualReview, messages) {
  const bodyPages = inspection.visual.page_metrics.filter(page => page.page_number > 1)
  if (bodyPages.length > 2) {
    const inks = bodyPages.map(page => page.ink_ratio ?? 0)
    const mean = inks.reduce((sum, value) => sum + value, 0) / inks.length
    const variance = inks.reduce((sum, value) => sum + (value - mean) ** 2, 0) / inks.length
    if (variance > 0.02) add(messages, 'visual_critic', document, { issue: 'inconsistent_page_rhythm', severity: 'minor', evidence: `Varians tinta halaman ${variance.toFixed(4)}.`, action: 'balance_page_density', impact: 'Dokumen terasa tidak rata dari halaman ke halaman.', classification: 'subjective', confidence: 0.7 })
  }
  for (const page of bodyPages) {
    if ((page.ink_ratio ?? 0) < 0.012 && page.words < 20) add(messages, 'visual_critic', document, { issue: 'sparse_page', severity: 'minor', evidence: `Halaman ${page.page_number} hanya berisi ${page.words} kata dengan rasio tinta ${page.ink_ratio}.`, action: 'consider_section_divider_or_combine', impact: 'Halaman bisa terbaca sebagai ruang kosong yang belum selesai.', page: page.page_number, classification: 'subjective', confidence: 0.65 })
    if (!['minimalist_clean', 'academic_professional', 'luxury_elegant'].includes(theme.key) && (page.colorfulness ?? 1) < 0.02 && page.words > 80) add(messages, 'visual_critic', document, { issue: 'visual_monotony_page', severity: 'minor', evidence: `Warna halaman ${page.page_number} nyaris tidak ada, nilainya ${page.colorfulness}.`, action: 'add_accent_or_visual', impact: 'Halaman kurang punya penanda arah visual.', page: page.page_number, classification: 'subjective', confidence: 0.6 })
  }
  for (const finding of manualReview?.findings ?? []) {
    add(messages, 'visual_critic', document, {
      issue: finding.issue_type ?? 'manual_visual_finding',
      severity: finding.severity ?? 'minor',
      evidence: finding.evidence ?? 'Dari tinjauan visual per halaman yang Anda berikan.',
      action: finding.proposed_action ?? 'review_and_refine',
      impact: finding.expected_impact ?? 'Membantu komunikasi visual.',
      page: finding.page_number ?? null,
      component: finding.component_id ?? null,
      classification: 'subjective',
      confidence: finding.confidence ?? 0.7,
    })
  }
}

function runTechnicalQA(document, inspection, messages) {
  for (const [gate, passed] of Object.entries(inspection.gates)) {
    if (!passed) add(messages, 'technical_qa', document, { issue: `gate_${gate}`, severity: 'critical', evidence: `Pemeriksaan wajib ${gate} gagal.`, action: 'repair_gate', impact: 'Dokumen belum bisa dirilis selama pemeriksaan ini gagal.', confidence: 1 })
  }
  if (inspection.checks.pages_match_render === false) add(messages, 'technical_qa', document, { issue: 'page_count_mismatch', severity: 'critical', evidence: 'Jumlah halaman hasil inspeksi tidak cocok dengan metadata render.', action: 'rerender', impact: 'Identitas artefak jadi tidak bisa dipercaya.', confidence: 0.99 })
  if (inspection.checks.low_resolution_images > 0) add(messages, 'technical_qa', document, { issue: 'low_resolution_image', severity: 'minor', evidence: `${inspection.checks.low_resolution_images} gambar raster di bawah 100 PPI.`, action: 'use_higher_resolution', impact: 'Gambar bisa terlihat lembut saat dicetak.', confidence: 0.85 })
  if (!inspection.metadata.tagged) add(messages, 'technical_qa', document, { issue: 'not_tagged', severity: 'minor', evidence: 'PDF tidak diberi tag.', action: 'enable_tagged_pdf', impact: 'Struktur untuk pembaca layar jadi lebih lemah.', confidence: 0.8 })
}

function proseText(document) {
  const parts = []
  for (const section of document.sections) {
    for (const block of section.blocks) {
      if (block.type === 'paragraph' || block.type === 'quote' || block.type === 'callout') parts.push(block.text ?? '')
      if (block.type === 'list') for (const item of block.items ?? []) parts.push(item.text ?? '')
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function runEditorialReviewer(document, messages) {
  const text = proseText(document)
  const headings = document.sections.filter(section => !section.divider).map(section => section.title.trim().toLowerCase())
  const seen = new Set()
  for (const heading of headings) {
    if (seen.has(heading)) add(messages, 'editorial_reviewer', document, { issue: 'duplicate_heading', severity: 'minor', evidence: `Judul bagian ganda: “${heading}”.`, action: 'rename_section', impact: 'Navigasi dan rujukan silang jadi membingungkan.' })
    seen.add(heading)
  }
  const sentences = text.split(/(?<=[.!?])\s+/).filter(sentence => sentence.length > 0)
  const longSentences = sentences.filter(sentence => sentence.split(/\s+/).length > 46)
  if (longSentences.length) add(messages, 'editorial_reviewer', document, { issue: 'long_sentences', severity: 'minor', evidence: `${longSentences.length} kalimat lebih dari 46 kata.`, action: 'split_sentences', impact: 'Pemahaman melambat, terutama bagi pembaca non-penutur asli.', classification: 'subjective', confidence: 0.65 })
  const repeated = /\b(\w{4,})\s+\1\b/gi
  if (repeated.test(text)) add(messages, 'editorial_reviewer', document, { issue: 'repeated_word', severity: 'minor', evidence: `Kata berulang: “${text.match(repeated)?.[0]}”.`, action: 'proofread', impact: 'Pengulangan yang terlihat melemahkan kepercayaan pada kualitas editorial.' })
  const currencySymbols = new Set((text.match(/[$€£¥]|\b(?:USD|EUR|GBP|IDR|SGD)\b/g) ?? []).map(value => value.toUpperCase()))
  if (currencySymbols.size > 1) add(messages, 'editorial_reviewer', document, { issue: 'mixed_currency', severity: 'minor', evidence: `Ada beberapa penanda mata uang: ${[...currencySymbols].join(', ')}.`, action: 'clarify_currency', impact: 'Pembaca bisa salah membaca nilai uang.' })
  for (const citation of document.citations ?? []) {
    if (citation.url && !/^https?:\/\//i.test(citation.url)) add(messages, 'editorial_reviewer', document, { issue: 'invalid_citation_url', severity: 'major', evidence: `Sitasi ${citation.id} memakai URL non-http.`, action: 'fix_citation_url', impact: 'Sumber tidak bisa diikuti dengan andal.' })
  }
  const fullText = documentText(document)
  if (document.synthetic && !/synthetic|sintetis|demonstration|demonstrasi|illustrative/i.test(fullText)) add(messages, 'editorial_reviewer', document, { issue: 'missing_disclosure', severity: 'critical', evidence: 'Isi sintetis tidak diungkapkan di badan teks atau judul komponen.', action: 'add_disclosure', impact: 'Pembaca bisa menganggap data demonstrasi sebagai fakta.' })
}

function dedupeAndResolve(messages) {
  const conflicts = []
  const byKey = new Map()
  for (const message of messages) {
    const key = `${message.issue_type}|${message.component_id ?? ''}|${message.page_number ?? ''}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, message)
      continue
    }
    if (existing.severity !== message.severity) {
      const objective = existing.classification === 'objective' ? existing : message.classification === 'objective' ? message : null
      const winner = objective ?? (SEVERITY_RANK[message.severity] > SEVERITY_RANK[existing.severity] ? message : existing)
      const loser = winner === existing ? message : existing
      conflicts.push({
        key,
        winner_agent: winner.agent_id,
        loser_agent: loser.agent_id,
        resolution: objective
          ? 'Bukti teknis yang objektif mengalahkan preferensi subjektif.'
          : 'Tingkat keparahan tertinggi dipertahankan agar risiko tidak tersembunyi.',
        issue_type: winner.issue_type,
      })
      byKey.set(key, winner)
    }
  }
  return { messages: [...byKey.values()], conflicts }
}

function summarizeAgents(messages, reviewStatus) {
  return ROLE_INFO.map(role => {
    const roleMessages = messages.filter(message => message.agent_id === role.id)
    return {
      agent_id: role.id,
      name: role.name,
      focus: role.focus,
      status: role.id === 'orchestrator' ? reviewStatus : 'completed',
      findings: roleMessages.length,
      critical: roleMessages.filter(m => m.severity === 'critical').length,
      major: roleMessages.filter(m => m.severity === 'major').length,
      minor: roleMessages.filter(m => m.severity === 'minor').length,
      runtime: 'tahap berurutan secara deterministik',
    }
  })
}

/**
 * @param {object} args
 */
export function runAgentReview({ document, theme, design, inspection, scoring, manualVisualReview = null }) {
  const messages = []
  runStrategist(document, design, inspection, messages)
  runContentEditor(document, messages)
  runCreativeDirector(document, theme, design, messages)
  runLayoutEngineer(document, inspection, messages)
  runVisualSpecialist(document, messages)
  runRenderEngineer(document, inspection, messages)
  runVisualCritic(document, theme, inspection, manualVisualReview, messages)
  runTechnicalQA(document, inspection, messages)
  runEditorialReviewer(document, messages)
  const { messages: resolved, conflicts } = dedupeAndResolve(messages)
  const gatesOk = Object.values(inspection.gates).every(Boolean)
  const critical = resolved.filter(message => message.severity === 'critical')
  const major = resolved.filter(message => message.severity === 'major')
  const minor = resolved.filter(message => message.severity === 'minor')
  let status
  if (!gatesOk || critical.some(message => message.classification === 'objective')) status = 'rejected'
  else if (scoring.release_status === 'rejected') status = 'rejected'
  else if (major.length > 0 || critical.length > 0) status = 'needs_review'
  else if (scoring.release_status === 'approved' && minor.length === 0) status = 'approved'
  else if (scoring.release_status === 'approved') status = 'approved_with_warnings'
  else status = 'needs_review'
  const resolution = {
    agent_id: 'orchestrator',
    document_id: document.document_id,
    document_version: document.document_version ?? 1,
    status,
    gates_ok: gatesOk,
    score: scoring.score,
    target_score: scoring.target_score,
    counts: { critical: critical.length, major: major.length, minor: minor.length },
    blocking_findings: critical.map(message => ({ issue_type: message.issue_type, agent_id: message.agent_id, evidence: message.evidence, component_id: message.component_id, page_number: message.page_number })),
    required_repairs: [...critical, ...major].map(message => ({
      issue_type: message.issue_type, proposed_action: message.proposed_action,
      component_id: message.component_id, page_number: message.page_number,
    })).slice(0, 20),
    conflicts,
    rationale: !gatesOk
      ? 'Pemeriksaan teknis wajib gagal, jadi artefak belum bisa dirilis.'
      : critical.length
        ? 'Masih ada temuan kritis yang belum diselesaikan.'
        : major.length
          ? 'Ada temuan mayor yang perlu diperbaiki atau diterima secara eksplisit.'
          : scoring.score < scoring.target_score
            ? 'Semua pemeriksaan teknis lolos, tetapi skor mutu masih di bawah target.'
            : 'Semua pemeriksaan wajib lolos dan tidak ada temuan kritis atau mayor.',
    confidence: gatesOk ? 0.92 : 1,
    decided_at: new Date().toISOString(),
  }
  const agents = summarizeAgents(resolved, status)
  return {
    protocol_version: '1.0',
    runtime: 'tahap berurutan dalam satu proses, tanpa panggilan LLM terpisah',
    document_id: document.document_id,
    messages: resolved,
    agents,
    conflicts,
    resolution,
    release_decision: resolution,
  }
}

export const AGENT_ROLES = ROLE_INFO
