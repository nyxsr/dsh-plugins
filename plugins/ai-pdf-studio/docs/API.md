# Kontrak API

Service di `src/api/service.js` membuka sepuluh operasi stabil. Plugin DSH mendaftarkan nama yang sama sebagai tool native. CLI membukanya sebagai subperintah.

Semua path diselesaikan di dalam workspace sesi. Respons selalu memuat path absolut yang nyata untuk file keluaran. Tidak ada placeholder karangan.

## `generate_pdf`

Permintaan:

```json
{
  "document": { "title": "..." },
  "document_path": "optional/workspace/path.json",
  "template_id": "business-performance-report",
  "source_text": "optional prose",
  "outline": [{ "title": "Section", "summary": "..." }],
  "allow_placeholders": false,
  "output_dir": "outputs/my-document",
  "brand_kit": {
    "organization": "Acme",
    "logo_path": "assets/logo.svg",
    "colors": { "primary": "#0B6E6E", "accent": "#D98E2B" }
  },
  "visual_review": {
    "reviewed": true,
    "reviewer": "reviewer-name",
    "pages_reviewed": [1, 2, 3],
    "score": 94,
    "findings": []
  }
}
```

Respons (diringkas):

```json
{
  "status": "success",
  "document_id": "demo-business-performance-report",
  "pdf_path": ".../demo-business-performance-report.pdf",
  "preview_paths": ["..."],
  "page_count": 7,
  "quality_report_path": ".../quality_report.json",
  "quality_markdown_path": ".../quality_report.md",
  "technical_inspection_path": ".../technical_inspection.json",
  "visual_critique_path": ".../visual_critique.json",
  "release_decision_path": ".../release_decision.json",
  "quality_score": 98.4,
  "target_score": 90,
  "release_status": "approved",
  "gates": { "file_valid": true, "...": true },
  "failed_gates": [],
  "warnings": [],
  "iterations": 1,
  "repair_history": [],
  "checksum_sha256": "..."
}
```

Arti status:

- `success`: artefak dihasilkan, semua gate wajib lolos, rilis disetujui atau disetujui dengan peringatan.
- `needs_review`: artefak dihasilkan dan gate lolos, tetapi ada temuan tinjauan besar atau target skor belum tercapai.
- `quality_failed`: artefak dihasilkan tetapi satu atau lebih gate wajib gagal. Respons memuat `failed_gates`, error, dan path ke artefak terverifikasi terbaik. Status ini tidak pernah dilabeli approved.

Error terstruktur mencakup `invalid_request`, `invalid_document`, `content_required`, `cover_overflow`, `asset_unsafe`, `asset_not_found`, `render_failed`, `inspection_failed`, dan `output_outside_workspace`.

## `preview_pdf`

```json
{ "pdf_path": "outputs/doc.pdf", "output_dir": "outputs/previews", "dpi": 110 }
```

Mengembalikan `preview_paths`, `previews` per halaman dengan width/height/dpi/bytes, dan `page_count`.

## `inspect_pdf`

```json
{ "pdf_path": "outputs/doc.pdf", "document_path": "outputs/document.ir.json", "output_dir": "outputs/inspection" }
```

Mengembalikan gate, metadata, dimensi, font, anotasi, fragmen konten yang diharapkan dan yang hilang, geometri halaman, metrik visual, dan `technical_inspection.json` yang ikut ditulis.

## `edit_pdf`

```json
{
  "input_path": "outputs/doc.pdf",
  "operations": [
    { "operation": "rotate", "degrees": 90, "pages": [2] },
    { "operation": "watermark", "text": "DRAFT", "opacity": 0.12, "rotation": 0 },
    { "operation": "page_numbers", "align": "center" },
    { "operation": "metadata", "metadata": { "title": "Final" } }
  ],
  "output_path": "outputs/doc-edited.pdf"
}
```

Operasi yang didukung: `merge`, `split`, `rotate`, `reorder`, `remove_pages`, `extract_text`, `extract_images`, `watermark`, `page_numbers`, `header_footer`, `metadata`, `add_pages`, `replace_pages`.

Respons selalu memuat `lossless: false` dan peringatan soal efek samping overlay atau perubahan struktur.

## `redesign_pdf`

```json
{ "pdf_path": "source.pdf", "title": "Reconstructed", "theme_family": "premium_editorial", "output_dir": "outputs/redesign" }
```

Mengembalikan hasil generasi biasa ditambah `reconstruction_report_path` dan objek `reconstruction` berisi halaman sumber, karakter yang diekstrak, baris berulang yang dibuang, metode, `lossy: true`, elemen yang tidak didukung, dan batasannya. PDF hasil pindai mengembalikan `ocr_not_supported`.

## `list_templates`

Tanpa parameter. Mengembalikan enam template dengan `template_id`, nama, kategori, tema, ukuran halaman, tanda tangan struktural, blok wajib, versi, dan path pratinjau.

## `analyze_design_reference`

```json
{ "reference_path": "reference.pdf", "fidelity": "inspired", "output_dir": "outputs/reference" }
```

Mengembalikan Reference Design Profile:

```json
{
  "profile_version": "1.0",
  "source": { "method": "pdf_raster_and_text_geometry", "estimated": true },
  "visual_style": "luxury_elegant",
  "visual_style_confidence": 0.57,
  "colors": { "primary": "#207577", "accent": "#...", "background": "#0B1F33", "text": "#..." },
  "typography": { "heading_style": "...", "hierarchy": "...", "estimated": true },
  "layout": { "columns": 1, "whitespace": "...", "margins_estimated_pt": { "...": 0 }, "estimated": true },
  "confidence": 0.57,
  "warnings": ["..."],
  "evidence": ["..."]
}
```

Kalau `user_profile` diberikan, tidak ada analisis gambar. Metodenya `user_authored` dan keyakinannya 1. Fidelity salah satu dari `inspired`, `brand_matched`, `layout_guided`.

## `apply_brand_kit`

```json
{
  "document": { "title": "..." },
  "brand_kit": {
    "organization": "Acme",
    "logo_path": "assets/logo.svg",
    "colors": { "primary": "#0B6E6E", "background": "#FFFFFF", "text": "#111111" },
    "fonts": { "heading": "Inter", "body": "Inter" },
    "watermark": "INTERNAL",
    "contact": "...",
    "restrictions": ["no gradients"]
  }
}
```

Mengembalikan `document`, `document_path`, `brand_report`, `summary`, `warnings`. Perbaikan kontras dilaporkan, tidak disembunyikan.

## `validate_document`

```json
{ "document": { "title": "...", "sections": [] } }
```

Mengembalikan `{ status: "valid" | "invalid", errors, warnings, document }`. `document` bernilai `null` kalau ada error.

## `export_pdf`

```json
{ "pdf_path": "outputs/doc.pdf", "output_path": "export/final.pdf" }
```

Menyalin di dalam workspace dan mengembalikan `checksum_sha256`, `bytes`, dan `page_count`.

## Pemakaian tool DSH

Plugin terpasang sebagai `@local/ai-pdf-studio` dan tool-nya membaca `workingDirectory` dari sesi pemanggil. Panggilan model bisa sesingkat:

```json
{ "pdf_path": "ai-pdf-studio/outputs/01-business-performance-report/demo-business-performance-report.pdf", "output_dir": "ai-pdf-studio/outputs/previews" }
```

atau selengkap Document IR penuh. Keluaran tool menampilkan ringkasan status singkat, sedangkan nilai JSON terstruktur memuat path nyata untuk dipakai langkah berikutnya.
