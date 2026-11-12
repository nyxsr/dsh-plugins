/** Human- and machine-readable quality reports. */
export function buildQualityMarkdown({ document, design, theme, inspection, scoring, review, iterations, repairs, artifacts }) {
  const gateRows = Object.entries(inspection.gates).map(([name, passed]) => `| ${name} | ${passed ? 'LULUS' : 'GAGAL'} |`).join('\n')
  const dimensionRows = Object.values(scoring.dimensions).map(dimension => {
    if (!dimension.evaluated) return `| ${dimension.evaluator} | belum dinilai | ${(dimension.weight * 100).toFixed(0)}% | ${dimension.evidence.join(' · ')} |`
    return `| ${dimension.evaluator} | ${dimension.score.toFixed(1)} | ${(dimension.weight * 100).toFixed(0)}% | ${dimension.evidence.join(' · ')} |`
  }).join('\n')
  const findings = review.messages.filter(message => ['critical', 'major'].includes(message.severity)).slice(0, 30)
  const findingRows = findings.length
    ? findings.map(message => `| ${message.severity} | ${message.agent_id} | ${message.issue_type} | hal. ${message.page_number ?? '-'} | ${message.evidence.replace(/\|/g, '/')} | ${message.proposed_action} |`).join('\n')
    : '| - | - | Tidak ada temuan kritis atau mayor | - | - | - |'
  const pageRows = inspection.visual.page_metrics.map(page =>
    `| ${page.page_number} | ${page.role} | ${page.words} | ${page.ink_ratio ?? '-'} | ${page.edge_ratio ?? '-'} | ${page.blank_candidate ? 'kosong?' : 'tidak'} | ${page.overcrowded_candidate ? 'padat?' : 'tidak'} |`).join('\n')
  const repairRows = repairs?.length
    ? repairs.map(entry => `| ${entry.iteration} | ${entry.actions.map(action => action.action).join(', ')} | ${entry.effect?.gate_delta ?? '-'} | ${entry.effect?.score_delta ?? '-'} | ${entry.accepted ? 'diterima' : 'ditolak'} |`).join('\n')
    : '| - | Tidak perlu perbaikan | - | - | - |'
  return `# Laporan mutu: ${document.title}

- **ID dokumen:** \`${document.document_id}\`
- **Versi:** ${document.document_version}
- **Kategori:** ${document.category}
- **Bahasa:** ${document.language}
- **Keluarga desain:** ${theme.name} (\`${theme.key}\`)
- **Ukuran halaman:** ${document.page.width_pt} × ${document.page.height_pt} pt (${document.page.size})
- **Konten sintetis:** ${document.synthetic ? 'Ya, semua angka adalah data demonstrasi' : 'Tidak'}
- **Dibuat:** ${document.metadata?.created_at ?? new Date().toISOString()}

## Keputusan rilis

**${scoring.release_status.toUpperCase()}** dengan skor berbobot **${scoring.score}/${scoring.target_score}**. ${scoring.gates_ok ? 'Semua pemeriksaan wajib lolos.' : 'Ada pemeriksaan wajib yang gagal.'}

${review.resolution.rationale}

> Skor hanya alat bantu diagnosis, bukan bukti mutu profesional. Skor tinggi tidak bisa menutupi pemeriksaan yang gagal.

## Pemeriksaan wajib

| Pemeriksaan | Hasil |
|---|---|
${gateRows}

## Dimensi berbobot

| Evaluator atau dimensi | Skor | Bobot | Bukti |
|---|---:|---:|---|
${dimensionRows}

## Temuan kritis dan mayor

| Tingkat | Agen | Masalah | Halaman | Bukti | Tindakan yang diusulkan |
|---|---|---|---|---|---|
${findingRows}

## Geometri halaman dan metrik visual

| Halaman | Peran | Kata | Rasio tinta | Rasio tepi | Kosong? | Padat? |
|---:|---|---:|---:|---:|---|---|
${pageRows}

## Perbaikan yang dijalankan

| Iterasi | Tindakan | Perubahan pemeriksaan | Perubahan skor | Hasil |
|---:|---|---:|---:|---|
${repairRows}

## Kelengkapan konten

- Fragmen yang diharapkan: ${inspection.content.expected_fragments}
- Fragmen yang cocok: ${inspection.content.matched_fragments}
- Kelengkapan: ${(inspection.content.completeness_ratio * 100).toFixed(2)}%
- Fragmen yang hilang: ${inspection.content.missing_fragments.length ? inspection.content.missing_fragments.map(f => `\`${f.text.slice(0, 70)}\``).join(', ') : 'tidak ada'}

## Tipografi dan font

- Font yang ditemukan: ${inspection.typography.font_count}
- Semua tertanam: ${inspection.typography.all_embedded ? 'ya' : 'tidak'}
- Perkiraan ukuran teks isi: ${inspection.typography.estimated_body_font_pt ?? 'tidak tersedia'} pt
- Kontras teks isi: ${theme.contrast.body.toFixed(2)}:1
- Kontras teks sekunder: ${theme.contrast.muted.toFixed(2)}:1
- PDF diberi tag: ${inspection.metadata.tagged ? 'ya' : 'tidak'}
- Anotasi tautan: ${inspection.annotations.available ? inspection.annotations.links : 'tidak tersedia'}

## Daftar artefak

- PDF: \`${artifacts.pdf_path}\`
- Pratinjau: ${artifacts.preview_paths.length} gambar halaman
- Inspeksi teknis: \`${artifacts.inspection_path}\`
- Kritik visual: \`${artifacts.visual_report_path}\`
- Keputusan rilis: \`${artifacts.release_path}\`
- Iterasi yang dijalankan: ${iterations}

## Batasan yang perlu diketahui

- Kritik visual memakai metrik deterministik dari gambar halaman dan geometri teks. Tinjauan subjektif per halaman hanya dicatat kalau Anda memberi tinjauan visual eksplisit. Mesin tidak menebaknya dari validitas file.
- Chromium tidak menyediakan header berjalan per bagian di margin halaman PDF. Yang dipakai hanya satu header dokumen yang berulang.
- Bookmark PDF belum dibuat oleh jalur penggabungan saat ini.
- Ekstraksi warna dari tangkapan layar referensi bersifat heuristik. Nilai tipografi dan grid yang tepat ditandai sebagai perkiraan.
- Dokumen ini demonstrasi sintetis. Tidak ada pernyataan di dalamnya yang merupakan klaim fakta tentang organisasi nyata.
`
}

export function buildVisualCritique({ inspection, review, scoring, document, manualReview }) {
  const visualMessages = review.messages.filter(message => message.agent_id === 'visual_critic')
  return {
    document_id: document.document_id,
    evaluator: manualReview?.reviewed ? `${manualReview.reviewer ?? 'agent_visual_review'}+page_metrics` : 'deterministic_page_metrics',
    subjective_review_performed: Boolean(manualReview?.reviewed),
    pages_reviewed: manualReview?.pages_reviewed ?? [],
    score: scoring.dimensions.visual.score,
    page_metrics: inspection.visual.page_metrics.map(page => ({
      page_number: page.page_number,
      role: page.role,
      words: page.words,
      ink_ratio: page.ink_ratio,
      whitespace_ratio: page.whitespace_ratio,
      edge_ratio: page.edge_ratio,
      colorfulness: page.colorfulness,
      blank_candidate: page.blank_candidate,
      overcrowded_candidate: page.overcrowded_candidate,
      background: page.background,
    })),
    findings: visualMessages,
    limitations: [
      'Metrik ini mengukur geometri, tinta, kontras, dan sebaran warna. Ia tidak memahami mutu retorika.',
      'Mesin tidak memanggil VLM multimodal otomatis.',
      'Tinjauan manual yang Anda berikan dianggap evaluator subjektif dan tidak bisa menimpa pemeriksaan teknis yang gagal.',
    ],
  }
}
