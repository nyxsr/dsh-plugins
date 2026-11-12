# AI PDF Studio Ultimate

Mesin produksi, inspeksi, kritik, perbaikan, dan desain ulang PDF yang adaptif untuk DeepSeek Harness.

Ini bukan konverter PDF. Plugin ini menyusun Document IR bertipe, memilih keluarga desain, merender PDF yang teksnya bisa dicari melalui Chromium headless, lalu mengukur hasilnya dengan Poppler dan Pillow. Setelah itu ia menjalankan beberapa putaran tinjauan spesialis secara berurutan, memperbaiki cacat tata letak yang benar-benar terverifikasi, dan menerbitkan keputusan rilis bersama buktinya.

## Yang benar-benar berjalan di sini

Diuji di lingkungan ini pada 10 November 2026:

| Kemampuan | Status | Bukti |
|---|---|---|
| Runtime Node | Terverifikasi | Node v26.13.0 |
| Pipeline cetak Chromium | Terverifikasi | Chrome for Testing 156.0.8078.4 |
| Inspeksi PDF | Terverifikasi | `pdfinfo`, `pdftotext -bbox`, `pdffonts`, `pdfimages` |
| Pratinjau halaman | Terverifikasi | `pdftoppm` 24.02.0 |
| Penyuntingan PDF | Terverifikasi | `pdf-lib` 1.17.1 |
| Pemuatan konfigurasi | Terverifikasi | `yaml` 2.9.1 |
| Metrik gambar | Terverifikasi | Pillow (Python sistem 3.12) |
| Plugin DSH Host | Terverifikasi terpasang dan bisa dipanggil | `plugin_manager` aplikasi `applied`, 10 tool terlihat |
| OCR | **Tidak didukung** | Tidak ada biner `tesseract` |
| Model visi di dalam mesin | **Tidak tersedia** | Tinjauan visual per halaman harus diberikan secara eksplisit |
| Bookmark PDF | **Belum diimplementasikan** | Outline Chromium hilang saat penggabungan |
| PDF bertag setelah penggabungan | **Tidak dipertahankan** | Penggabungan pdf-lib membuang pohon struktur |
| Pustaka PDF Python / pip | **Tidak tersedia** | Tidak ada pip, tidak ada PyMuPDF/WeasyPrint/reportlab |

Jadi implementasinya memakai Node + Chromium + Poppler + `pdf-lib`, bukan tumpukan Python seperti pada rancangan awal. Pilihan ini diambil karena kondisi lingkungan, dan alasannya terdokumentasi.

## Arsitektur

```
request
  → intent / content planner (generate, transform, preserve)
  → Document IR validation and normalization
  → adaptive design selection (8 families, 6 category templates)
  → reference profile / brand kit resolution
  → HTML cover + body composition
  → Chromium PDF export
  → pdf-lib metadata merge
  → Poppler previews + geometry / font / link inspection
  → Pillow page metrics
  → 10 sequential review roles
  → mandatory gates + weighted scoring
  → targeted repair plan (max 3 iterations, no content deletion)
  → release decision + evidence bundle
```

Model acuannya ada di `src/core/models.js`. Setiap blok yang dirender membawa `data-component-id` yang stabil. Temuan inspeksi dan aksi perbaikan bisa ditelusuri kembali ke IR.

## Mulai cepat (CLI)

```bash
cd ai-pdf-studio
node src/cli.js capabilities
node src/cli.js list-templates
node src/cli.js generate \
  --input examples/01-business-performance-report.json \
  --out outputs/01-business-performance-report
```

Keluaran dari generasi yang berhasil berisi:

```json
{
  "status": "success",
  "document_id": "demo-business-performance-report",
  "pdf_path": ".../demo-business-performance-report.pdf",
  "preview_paths": ["..."],
  "page_count": 7,
  "quality_report_path": ".../quality_report.json",
  "quality_score": 98.4,
  "release_status": "approved",
  "warnings": []
}
```

Perintah lain:

```bash
node src/cli.js preview --pdf outputs/.../document.pdf --out outputs/previews
node src/cli.js inspect --pdf outputs/.../document.pdf
node src/cli.js edit --input outputs/.../document.pdf --operations ops.json
node src/cli.js redesign --pdf source.pdf --theme premium_editorial --out outputs/redesign
node src/cli.js analyze-reference --reference source.pdf --fidelity inspired
node src/cli.js apply-brand --input document.json --brand brand.json
node src/cli.js validate --input document.json
node src/cli.js export --pdf generated.pdf --out export/final.pdf
```

## Plugin DSH

Bundel `@local/ai-pdf-studio` terpasang di profil Web saat ini dan membuka sepuluh tool:

`generate_pdf`, `preview_pdf`, `inspect_pdf`, `edit_pdf`, `redesign_pdf`, `list_templates`, `analyze_design_reference`, `apply_brand_kit`, `validate_document`, `export_pdf`.

Contoh panggilan dari sisi model:

```json
{
  "name": "generate_pdf",
  "arguments": {
    "document_path": "ai-pdf-studio/examples/01-business-performance-report.json",
    "output_dir": "ai-pdf-studio/outputs/from-harness"
  }
}
```

Pemanggilan Harness yang sudah diverifikasi: `generate_pdf` menghasilkan PDF tiga halaman sungguhan di `outputs/tool-generation/dsh-tool-smoke-test.pdf` dengan kualitas 93.7. `preview_pdf` merender 7 halaman, dan `list_templates` mengembalikan 6 template. Plugin mengambil workspace dari `workingDirectory` sesi pemanggil.

## Keluarga desain

Setiap keluarga punya komposisi sampul, irama bagian, sistem huruf, perlakuan tabel, palet grafik, dan bahasa callout serta kutipan yang berbeda:

1. Modern Corporate, sampul terbelah, garis teal, pita KPI.
2. Premium Editorial, kertas krem, folio oxblood, huruf display Gelasio, drop cap.
3. Minimalist Clean, ukuran baris sempit, garis rambut, banyak ruang kosong.
4. Creative Bold, tipografi poster, blok asam dan kobalt, folio besar.
5. Technology Futuristic, panel instrumen gelap, telemetri mono, garis sinyal sian.
6. Luxury Elegant, gading dan tinta, bingkai emas, komposisi serif di tengah.
7. Academic Professional, badan Charter, bagian bernomor, pita abstrak, referensi.
8. Infographic Visual, kanvas krem, kartu fakta modular, aksen data oranye.

Template yang tersedia: laporan bisnis, proposal strategis, e-book edukasi, presentasi investor, brosur produk, dan makalah akademik. Gambar pratinjau ada di `templates/previews/`.

## Model kualitas

Gate wajib, terpisah dari skor:

- `file_valid`, `page_geometry`, `text_searchable`, `content_complete`
- `fonts_embedded`, `no_critical_clipping`, `no_critical_collisions`
- `no_unexpected_blank_pages`, `layout_audit`, `no_javascript`

Dimensi berbobot:

| Dimensi | Bobot |
|---|---:|
| Kualitas konten | 25% |
| Tata letak | 25% |
| Tipografi | 15% |
| Desain visual | 15% |
| Konsistensi merek | 10% (tidak dievaluasi bila tidak ada brand kit) |
| Teknis / aksesibilitas | 10% |

Gate yang gagal tidak bisa dikalahkan skor tinggi. Skor hanya alat diagnosis. Skor bukan bukti kualitas profesional.

## Artefak demonstrasi

Keenam dokumen contoh bersifat sintetis, fiktif, dan diberi label terbuka. Tiap dokumen punya PDF, pratinjau halaman, inspeksi teknis, kritik visual, keputusan rilis, laporan kualitas, metadata, arah desain, dan IR yang diarsipkan.

| No | Dokumen | Kategori | Tema | Halaman | Skor | Rilis |
|---|---|---|---:|---:|---:|---|
| 01 | Q3 2026 Operating Review | report | Modern Corporate | 7 | 98.4 | approved |
| 02 | Strategic growth proposal (ID) | proposal | Premium Editorial | 9 | 98.7 | approved |
| 03 | The Attention Practice | ebook | Minimalist Clean | 16 | 95.3 | approved |
| 04 | Vela investor deck (ID) | presentation | Creative Bold | 9 | 95.3 | approved |
| 05 | Aurelia No. 07 | brochure | Luxury Elegant | 7 | 96.2 | approved |
| 06 | Spacing, Not Novelty | academic | Academic Professional | 10 | 95.1 | approved |

Demonstrasi berbasis referensi ada di `outputs/reference-guided/`. Sebuah sampul laporan orisinal dianalisis menjadi profil dengan keyakinan 57%, lalu dipakai untuk menghasilkan dokumen baru empat halaman dengan skor 96.1. Tebakan gayanya meleset. Sistem menebak `luxury_elegant` pada sampul navy gelap beraksen teal. Keterbatasan itu dicatat di dalam artefak, dan itulah alasan profil buatan pengguna didukung.

## Tes

```bash
node --test --test-concurrency=1 tests/unit tests/integration tests/visual
```

Hasil yang diamati: **41 tes, 41 lulus, 0 gagal** (111 detik).

Cakupannya meliputi validasi skema, keenam rendering contoh, pemilihan desain, brand kit, analisis referensi, struktur dokumen, validasi data grafik, penyuntingan, desain ulang, konten stres (tabel 60 baris, URL panjang, campuran Indonesia dan Inggris, Ångström/日本語/العربية), penghentian loop perbaikan, pelestarian konten, path traversal, pemblokiran aset jarak jauh, escaping skrip, kontrak pesan agen, dan baseline piksel untuk regresi sampul.

## Batasan

- OCR tidak tersedia. Desain ulang PDF hasil pindai gagal dengan error `ocr_not_supported` yang eksplisit.
- Mesin tidak memanggil VLM. Tinjauan visual subjektif hanya dicatat kalau diberikan. Evaluator bawaannya metrik halaman yang deterministik.
- Bookmark PDF tidak dibuat. Struktur PDF bertag hilang saat sampul dan badan digabung.
- Nilai tipografi dan grid dari referensi hanya perkiraan. Nilai palet diambil dari hasil render, bukan dari token sumber.
- Penyuntingan PDF bersifat struktural dan **tidak lossless**. Anotasi rumit dan field formulir bisa terpengaruh.
- Desain ulang hanya memulihkan teks. Tabel, grafik, gambar, dan tata letak persisnya dilaporkan sebagai kehilangan.
- Judul bagian berjalan di header halaman tidak dinamis. Yang dipakai satu header tingkat dokumen.
- Perbaikan dibatasi tiga iterasi. Artefak yang gagal tidak pernah dilabeli approved.
- Contoh bawaan memakai aset SVG orisinal dan referensi terbitan nyata hanya di tempat yang memang diberi label referensi.

## Peta repositori

```
ai-pdf-studio/
  index.js                 DSH Host plugin (10 tools)
  src/
    api/service.js         stable operations
    core/                  models, pipeline, config, paths, errors
    agents/orchestrator.js 10-role sequential review
    content/planner.js     generate/transform/preserve
    design/                themes, selector, reference analyzer, contrast
    render/                components, CSS, Chromium, PDF merge, previews
    visuals/               SVG charts/diagrams, safe assets
    quality/               inspector, page metrics, scoring, repair, reports
    editing/               pdf-lib editing, redesign
    branding/              brand kit validation
    templates/             template registry
  templates/               6 templates + previews
  assets/                  original brand marks and illustration
  examples/                6 Document IR files
  tests/                   unit, integration, stress, visual regression
  outputs/                 actual generated artifacts
  docs/                    architecture, API, testing, limitations, report
  config/                  default.yaml, quality_rules.yaml
```
