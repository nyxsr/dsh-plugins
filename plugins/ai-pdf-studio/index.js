/**
 * AI PDF Studio Ultimate, plugin Host untuk DeepSeek Harness.
 *
 * Mendaftarkan operasi studio yang stabil sebagai tool native untuk model.
 * Pekerjaan render yang berat ada di ./src, berkas ini hanya adaptor Harness.
 */
import path from 'node:path'
import { createStudio } from './src/api/service.js'

export const inject = ['tools']
export const name = 'ai-pdf-studio'

const SUMMARY_KEYS = [
  'status', 'document_id', 'pdf_path', 'page_count', 'quality_score', 'target_score',
  'release_status', 'quality_report_path', 'technical_inspection_path',
  'visual_critique_path', 'release_decision_path', 'profile_path', 'analysis_dir',
  'reconstruction_report_path', 'output_path', 'output_paths',
]

function textResult(summary, value) {
  const lines = [summary]
  for (const key of SUMMARY_KEYS) {
    const entry = value?.[key]
    if (entry === undefined || entry === null) continue
    if (Array.isArray(entry)) {
      if (entry.length) lines.push(`${key}: ${entry.slice(0, 12).join(', ')}${entry.length > 12 ? ` … (${entry.length} total)` : ''}`)
    } else if (typeof entry !== 'object') {
      lines.push(`${key}: ${entry}`)
    }
  }
  if (value?.failed_gates?.length) lines.push(`pemeriksaan gagal: ${value.failed_gates.join(', ')}`)
  if (value?.warnings?.length) lines.push(`peringatan: ${value.warnings.slice(0, 3).join(' | ')}${value.warnings.length > 3 ? ' …' : ''}`)
  return [{ type: 'text', text: lines.join('\n') }]
}

function defineTool(tools, definition) {
  return tools.register({
    ...definition,
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textResult(definition.summary?.(value) ?? `${definition.name} selesai.`, value),
    },
  })
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  const studios = new Map()
  const studioFor = exec => {
    const workingDirectory = ctx.get('workingDirectory')
    let workspaceRoot = workingDirectory?.defaultDirectory ?? process.cwd()
    try {
      if (workingDirectory && exec?.agent?.session) workspaceRoot = workingDirectory.get(exec.agent.session)
    } catch { /* fall back to the default directory */ }
    workspaceRoot = path.resolve(workspaceRoot)
    if (!studios.has(workspaceRoot)) studios.set(workspaceRoot, createStudio({ workspaceRoot }))
    return studios.get(workspaceRoot)
  }
  const disposers = []
  const register = definition => {
    disposers.push(defineTool(ctx.tools, definition))
  }

  register({
    name: 'generate_pdf',
    description: 'Buat PDF lengkap dari Document IR, teks sumber, atau outline. Plugin memilih desain, merender lewat Chromium, memeriksa hasilnya, lalu memperbaiki cacat tata letak yang bisa diverifikasi. Tersedia enam template kategori dan delapan keluarga desain. Anda juga bisa memberi brand kit, referensi visual, atau tinjauan halaman. Hasilnya path PDF, pratinjau, dan laporan pemeriksaan yang benar-benar dibuat.',
    parameters: {
      type: 'object',
      properties: {
        document: { type: 'object', additionalProperties: true, description: 'Document IR lengkap. Kalau diisi, document_path, source_text, dan outline tidak perlu.' },
        document_path: { type: 'string', description: 'Path relatif workspace ke berkas JSON Document IR.' },
        template_id: { type: 'string', description: 'Id template kategori, misalnya business-performance-report.' },
        source_text: { type: 'string', description: 'Teks yang ditata ulang tanpa mengubah isinya.' },
        outline: { type: 'array', description: 'Kerangka berisi fakta dan konten untuk mode generate.', items: { type: 'object', additionalProperties: true } },
        allow_placeholders: { type: 'boolean', description: 'Izinkan placeholder berlabel untuk bagian yang belum ada isinya.' },
        output_dir: { type: 'string', description: 'Folder keluaran relatif workspace.' },
        brand_kit: { type: 'object', additionalProperties: true, description: 'Objek brand kit.' },
        visual_review: { type: 'object', additionalProperties: true, description: 'Tinjauan visual per halaman dari Anda. Jangan diisi kalau halaman belum benar-benar ditinjau.' },
      },
    },
    timeoutMs: 600000,
    isConcurrencySafe: () => false,
    summary: value => `AI PDF Studio membuat ${value?.page_count ?? '?'} halaman dengan skor ${value?.quality_score ?? '?'} dari target ${value?.target_score ?? '?'} (${value?.release_status ?? value?.status ?? 'status tidak diketahui'}).`,
    execute: (args, exec) => studioFor(exec).generate_pdf(args),
  })

  register({
    name: 'preview_pdf',
    description: 'Render setiap halaman PDF menjadi PNG dengan Poppler. Hasilnya path pratinjau dan ukuran halaman.',
    parameters: {
      type: 'object',
      properties: {
        pdf_path: { type: 'string', description: 'Path relatif workspace ke PDF.' },
        output_dir: { type: 'string', description: 'Folder pratinjau relatif workspace.' },
        dpi: { type: 'number', description: 'Resolusi pratinjau, 60 sampai 220 DPI.' },
      },
      required: ['pdf_path'],
    },
    timeoutMs: 180000,
    isConcurrencySafe: () => true,
    summary: value => `${value?.page_count ?? 0} halaman pratinjau sudah dibuat.`,
    execute: (args, exec) => studioFor(exec).preview_pdf(args),
  })

  register({
    name: 'inspect_pdf',
    description: 'Periksa PDF secara deterministik. Yang dicek: validitas berkas, geometri halaman, kotak kata, teks yang terpotong, tabrakan kata, halaman kosong, font, metadata, anotasi tautan, kelengkapan konten, dan metrik gambar halaman. Laporan bisa ditulis ke folder keluaran.',
    parameters: {
      type: 'object',
      properties: {
        pdf_path: { type: 'string', description: 'Path relatif workspace ke PDF.' },
        document: { type: 'object', additionalProperties: true, description: 'Document IR sebagai pembanding isi. Opsional.' },
        document_path: { type: 'string', description: 'Path relatif workspace ke JSON Document IR.' },
        output_dir: { type: 'string', description: 'Folder keluaran relatif workspace.' },
        dpi: { type: 'number', description: 'DPI pratinjau untuk metrik halaman.' },
      },
      required: ['pdf_path'],
    },
    timeoutMs: 300000,
    isConcurrencySafe: () => true,
    summary: value => `${value?.page_count ?? 0} halaman diperiksa. ${value?.failed_gates?.length ? `${value.failed_gates.length} pemeriksaan wajib gagal` : 'semua pemeriksaan wajib lolos'}.`,
    execute: (args, exec) => studioFor(exec).inspect_pdf(args),
  })

  register({
    name: 'edit_pdf',
    description: 'Ubah struktur PDF: gabung, pisah, putar, urutkan ulang, hapus halaman, ambil teks atau gambar, beri watermark, nomor halaman, header dan footer, metadata, tambah atau ganti halaman. Perubahan bersifat struktural dan tidak sepenuhnya lossless. Anotasi rumit bisa terpengaruh.',
    parameters: {
      type: 'object',
      properties: {
        input_path: { type: 'string', description: 'Path relatif workspace ke PDF sumber.' },
        operations: {
          type: 'array',
          description: 'Daftar operasi edit yang dijalankan berurutan.',
          items: { type: 'object', additionalProperties: true },
        },
        output_path: { type: 'string', description: 'Path relatif workspace untuk PDF hasil.' },
        output_dir: { type: 'string', description: 'Folder keluaran relatif workspace.' },
        metadata: { type: 'object', additionalProperties: true, description: 'Pembaruan metadata. Opsional.' },
      },
      required: ['input_path', 'operations'],
    },
    timeoutMs: 300000,
    isConcurrencySafe: () => false,
    summary: value => `PDF selesai diedit. ${value?.page_count ?? '?'} halaman, ${value?.operations_applied?.length ?? 0} operasi diterapkan.`,
    execute: (args, exec) => studioFor(exec).edit_pdf(args),
  })

  register({
    name: 'redesign_pdf',
    description: 'Bangun ulang PDF berbasis teks menjadi Document IR, lalu render dengan desain baru. Prosesnya heuristik dan kehilangan sebagian informasi. Tabel, grafik, gambar, dan tata letak persis tidak dipulihkan. OCR tidak tersedia di lingkungan ini.',
    parameters: {
      type: 'object',
      properties: {
        pdf_path: { type: 'string', description: 'Path relatif workspace ke PDF sumber.' },
        title: { type: 'string', description: 'Judul pengganti. Opsional.' },
        category: { type: 'string', description: 'Kategori dokumen tujuan.' },
        language: { type: 'string', enum: ['en', 'id'] },
        theme_family: { type: 'string', description: 'Keluarga desain tujuan.' },
        output_dir: { type: 'string', description: 'Folder keluaran relatif workspace.' },
        visual_review: { type: 'object', additionalProperties: true, description: 'Tinjauan visual per halaman. Opsional.' },
      },
      required: ['pdf_path'],
    },
    timeoutMs: 600000,
    isConcurrencySafe: () => false,
    summary: value => `PDF selesai didesain ulang (${value?.reconstruction?.lossy ? 'lossy' : 'rekonstruksi'}). Skor ${value?.quality_score ?? '?'}.`,
    execute: (args, exec) => studioFor(exec).redesign_pdf(args),
  })

  register({
    name: 'list_templates',
    description: 'Tampilkan enam template kategori beserta tema, ukuran halaman, struktur, blok wajib, dan path gambar pratinjau.',
    parameters: { type: 'object', properties: {} },
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    summary: value => `${value?.templates?.length ?? 0} template ditemukan.`,
    execute: (_args, exec) => studioFor(exec).list_templates(),
  })

  register({
    name: 'analyze_design_reference',
    description: 'Analisis PDF atau gambar referensi menjadi Reference Design Profile. Profil berisi palet sampel, perkiraan margin, kepadatan, dugaan jumlah kolom, dan perkiraan gaya. Semua angka diberi label sebagai perkiraan, dan tidak ada karya berhak cipta yang disalin. Kalau analisis gambar tidak cocok, Anda bisa memberi profil sendiri.',
    parameters: {
      type: 'object',
      properties: {
        reference_path: { type: 'string', description: 'Path relatif workspace ke PDF atau gambar referensi.' },
        output_dir: { type: 'string', description: 'Folder analisis relatif workspace.' },
        fidelity: { type: 'string', enum: ['inspired', 'brand_matched', 'layout_guided'] },
        user_profile: { type: 'object', additionalProperties: true, description: 'Profil dari Anda. Kalau diisi, analisis gambar dilewati.' },
      },
      required: ['reference_path'],
    },
    timeoutMs: 180000,
    isConcurrencySafe: () => true,
    summary: value => `Profil referensi sudah ditulis. Perkiraan gaya ${value?.profile?.visual_style ?? 'tidak diketahui'}.`,
    execute: (args, exec) => studioFor(exec).analyze_design_reference(args),
  })

  register({
    name: 'apply_brand_kit',
    description: 'Validasi dan terapkan brand kit ke Document IR. Brand kit berisi organisasi, logo, warna, font, watermark, kontak, dan batasan. Logo dan kontras diperiksa, lalu path IR yang sudah dibranding dikembalikan.',
    parameters: {
      type: 'object',
      properties: {
        document: { type: 'object', additionalProperties: true, description: 'Document IR yang akan dibranding.' },
        document_path: { type: 'string', description: 'Path relatif workspace ke JSON Document IR.' },
        brand_kit: { type: 'object', additionalProperties: true, description: 'Brand kit.' },
        output_dir: { type: 'string', description: 'Folder keluaran relatif workspace.' },
      },
      required: ['brand_kit'],
    },
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    summary: value => `Brand kit sudah divalidasi untuk ${value?.brand_report?.organization ?? value?.brand_kit?.organization ?? 'organisasi'}.`,
    execute: (args, exec) => studioFor(exec).apply_brand_kit(args),
  })

  register({
    name: 'validate_document',
    description: 'Periksa dan rapikan Document IR sebelum dirender. Hasilnya daftar kesalahan, peringatan, dan ringkasan dokumen. Tidak ada PDF yang dibuat.',
    parameters: {
      type: 'object',
      properties: {
        document: { type: 'object', additionalProperties: true, description: 'Document IR yang akan diperiksa.' },
      },
      required: ['document'],
    },
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    summary: value => `Status dokumen ${value?.status ?? 'tidak diketahui'}, ${value?.errors?.length ?? 0} kesalahan.`,
    execute: (args, exec) => studioFor(exec).validate_document(args),
  })

  register({
    name: 'export_pdf',
    description: 'Salin PDF hasil generate ke lokasi baru di workspace. Hasilnya checksum, jumlah halaman, dan ukuran berkas.',
    parameters: {
      type: 'object',
      properties: {
        pdf_path: { type: 'string', description: 'Path relatif workspace ke PDF sumber.' },
        output_path: { type: 'string', description: 'Path relatif workspace untuk PDF tujuan.' },
      },
      required: ['pdf_path', 'output_path'],
    },
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    summary: value => `${value?.page_count ?? '?'} halaman diekspor ke ${value?.pdf_path ?? 'tujuan'}.`,
    execute: (args, exec) => studioFor(exec).export_pdf(args),
  })

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch { /* already disposed */ }
    }
  })
}
