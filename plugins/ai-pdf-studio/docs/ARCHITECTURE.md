# Arsitektur

## Alur data

```
User request
  ├─ inline Document IR
  ├─ workspace JSON file
  ├─ source_text (transform/preserve)
  └─ outline + facts (generate)
        ↓
prepareContentRequest()          src/content/planner.js
        ↓
validateDocument()               src/core/models.js
  · typed blocks, stable IDs, chart/table validation, limits
        ↓
selectDesign()                   src/design/adaptive_selector.js
  · category, audience, purpose, reference style, density
        ↓
resolveTheme()                   src/design/themes.js
  · 8 families, brand kit, reference profile, contrast repair
        ↓
renderCover() + renderBody()     src/render/components.js
  · escaped HTML, safe local assets, data-component-id on every block
        ↓
buildStyles()                    src/render/styles.js
  · print CSS, tokenized theme overrides, small-format rules
        ↓
renderHtmlToPdf()                src/render/chromium.js
  · headless Chromium via raw CDP (zero browser automation dependency)
        ↓
renderDocumentPdf()              src/render/pdf_exporter.js
  · cover without footer, body with header/footer, pdf-lib merge, metadata
        ↓
previewPdf()                     src/render/preview_renderer.js
  · pdftoppm page PNGs
        ↓
inspectPdf()                     src/quality/inspector.js
  · pdfinfo / pdftotext -bbox / pdffonts / pdfimages / Pillow / pdf-lib annots
        ↓
scoreDocument()                  src/quality/scoring.js
        ↓
runAgentReview()                 src/agents/orchestrator.js
  · 10 roles, structured messages, conflict resolution, release decision
        ↓
planRepairs() → applyRepairs()   src/quality/repair_planner.js
  · bounded loop, oscillation guard, preserve content
        ↓
quality_report.json/.md, technical_inspection.json, visual_critique.json,
release_decision.json, metadata.json, design_direction.json, document.ir.json
```

## Sumber kebenaran

`src/core/models.js` mendefinisikan Document IR:

- identitas: `document_id`, `document_version`, judul, subjudul, eyebrow
- konteks: kategori, bahasa, audiens, tujuan, nada, mode konten
- halaman: ukuran, orientasi, lebar/tinggi eksplisit, margin
- desain: keluarga tema, varian, token
- merek: organisasi, logo, warna, font, watermark, kontak, batasan
- referensi: profil, fidelity, sumber
- bagian: ID, judul, kicker, pembatas, tata letak, blok
- blok: heading, paragraph, list, table, image, chart, diagram, KPI, quote, callout, timeline, equation, citation, footnote, pagebreak, sectionbreak
- sitasi, aset, metadata, petunjuk tata letak, kebijakan kualitas

ID diberikan secara deterministik dan divalidasi keunikannya. Renderer tidak pernah mengarang konten. Blok yang hilang dianggap error, bukan dihilangkan diam-diam.

## Pilihan rendering

- **Chromium lewat CDP**: tanpa dependensi `playwright` atau `puppeteer`. Driver menjalankan Chrome dengan port DevTools sementara, membuat target, mencetak PDF, lalu menutupnya.
- **Pemisahan sampul dan badan**: sampul dirender tanpa margin halaman dan tanpa header/footer. Badan dirender dengan margin dokumen serta header/footer berulang. Hasilnya sampul tanpa nomor, dan penomoran badan mulai dari 1.
- **Penggabungan pdf-lib**: sampul dan badan disalin ke satu dokumen, lalu metadata diisi. Ini membuang struktur bertag dan outline dari Chromium, dan sudah tercatat sebagai batasan.
- **Visual SVG**: grafik, diagram, tata letak KPI, timeline, dan ilustrasi produk adalah aset vektor orisinal. Tidak perlu pustaka grafik.
- **Aset aman**: hanya file lokal yang berakar di workspace atau paket. Ada sanitasi SVG, escaping HTML, tanpa URL jarak jauh, dan tanpa skrip.

## Model kualitas

Gate wajib dievaluasi terpisah dari skor berbobot. Gate-nya:

`file_valid`, `page_geometry`, `text_searchable`, `content_complete`, `fonts_embedded`, `no_critical_clipping`, `no_critical_collisions`, `no_unexpected_blank_pages`, `layout_audit`, `no_javascript`, dan `page_limit`.

Input yang diukur mencakup:

- header PDF, enkripsi, jumlah halaman, dimensi halaman
- kotak kata dari `pdftotext -bbox`: batas halaman, kata dekat tepi, tumpang tindih, lebar baris, perkiraan tinggi font
- fragmen teks yang diharapkan dari IR, dinormalisasi untuk spasi dan drop cap
- `pdffonts`: flag embedding dan Unicode
- `pdf-lib`: jumlah anotasi tautan
- Pillow: rasio tinta, ruang kosong, kepadatan tepi, luminansi, kekayaan warna, warna dominan, batas konten

Skor berbobot bawaannya: konten 25%, tata letak 25%, tipografi 15%, visual 15%, merek 10%, teknis 10%. Merek ditandai tidak dievaluasi kalau tidak ada brand kit, dan bobotnya dikeluarkan dari rata-rata, bukan diisi angka karangan.

## Tinjauan multi-agen

Sepuluh peran berurutan di `src/agents/orchestrator.js`:

1. Strategi Dokumen
2. Arsitek dan Editor Konten
3. Direktur Kreatif
4. Insinyur Tata Letak
5. Spesialis Visualisasi Data
6. Insinyur Rendering PDF
7. Kritikus Visual
8. Insinyur QA Teknis
9. Peninjau Kualitas Editorial
10. Orkestrator Tinjauan

Setiap temuan membawa: `agent_id`, `document_id`, `document_version`, `page_number`, `component_id`, `issue_type`, `severity`, `evidence`, `proposed_action`, `expected_impact`, `confidence`, dan `classification` (`objective`/`subjective`).

Ini implementasi deterministik dalam satu proses, bukan sepuluh panggilan LLM terpisah. Kontrak pesannya dirancang supaya agen independen bisa menggantikan putaran ini nanti tanpa mengubah pipeline. Bukti teknis objektif mengalahkan preferensi visual subjektif. Gate wajib yang gagal tidak bisa dikalahkan.

## Loop perbaikan

`planRepairs()` memetakan temuan ke kosakata aksi yang kecil dan aman:

- menambah margin kiri dan kanan
- menambah page break sebelum komponen atau memecah bagian
- memadatkan tabel yang meluap
- menghapus page break yang berlebihan
- menambah disclosure sintetis berlabel kalau belum ada

`applyRepairs()` mengkloning IR, menerapkan paling banyak empat aksi, dan menaikkan versi dokumen. Blok konten tidak pernah dihapus. Tanda tangan perbaikan dan jenis aksi sebelumnya mencegah osilasi. Pipeline membatasi percobaan di `quality.max_repair_iterations` (bawaan 3, maksimum 3), membandingkan jumlah gate dan skor, lalu menerbitkan iterasi terverifikasi terbaik.

## Penyuntingan dan desain ulang

`src/editing/pdf_editor.js` mendukung merge, split, rotate, reorder, remove pages, extract text/images, watermark, page numbers, header/footer, metadata, add pages, dan replace pages. Setiap respons menyebut `lossless: false`.

`src/editing/redesign.js` memakai `pdftotext -layout`, membuang header/footer berulang, mengelompokkan heading, paragraf, dan daftar secara heuristik, lalu menyusun IR baru. Kehilangan dilaporkan terbuka, dan proses gagal dengan `ocr_not_supported` kalau tidak ada lapisan teks.
