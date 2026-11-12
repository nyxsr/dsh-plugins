import path from 'node:path'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileP = promisify(execFile)
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const TMP_ROOT = path.join(PACKAGE_ROOT, 'tests', '.tmp')

export async function freshDir(name) {
  const dir = path.join(TMP_ROOT, name)
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  return dir
}

export async function readExample(name) {
  return JSON.parse(await readFile(path.join(PACKAGE_ROOT, 'examples', name), 'utf8'))
}

export function miniDocument(overrides = {}) {
  return {
    document_id: 'test-mini-document',
    title: 'Mini Production Fixture',
    subtitle: 'A controlled document used by the automated test suite',
    eyebrow: 'Test fixture',
    category: 'report',
    language: 'en',
    audience: 'Quality engineers',
    purpose: 'Verify generation, inspection, and repair without external services',
    content_mode: 'preserve',
    synthetic: true,
    page: { size: 'A4' },
    theme: { family: 'modern_corporate' },
    metadata: {
      author: 'AI PDF Studio tests',
      organization: 'AI PDF Studio',
      created_at: '2026-11-10T08:00:00Z',
      keywords: ['test', 'synthetic'],
    },
    quality: { target_score: 80, max_repair_iterations: 2 },
    sections: [
      {
        title: 'Summary', kicker: '01 · Overview',
        blocks: [
          { type: 'paragraph', lead: true, text: 'This is a controlled production fixture. It exists so the test suite can verify a complete PDF pipeline, including content completeness, page geometry, embedded fonts, previews, and quality evidence.' },
          { type: 'kpi', items: [
            { label: 'Checks', value: '12', delta: 'all synthetic', tone: 'neutral' },
            { label: 'Pages', value: '3', delta: 'expected', tone: 'neutral' },
          ] },
        ],
      },
      {
        title: 'Evidence', kicker: '02 · Data',
        blocks: [
          { type: 'chart', chart_type: 'bar', title: 'Synthetic evidence', data: { categories: ['Alpha', 'Beta', 'Gamma'], series: [{ name: 'Value', values: [4, 7, 5] }] }, caption: 'Synthetic test data.' },
          { type: 'table', title: 'Test matrix', columns: [{ key: 'check', label: 'Check', width: 40 }, { key: 'result', label: 'Result', width: 30 }, { key: 'note', label: 'Note', width: 30 }], rows: [
            { check: 'PDF validity', result: 'PASS', note: 'pdfinfo' },
            { check: 'Text extraction', result: 'PASS', note: 'pdftotext' },
            { check: 'Previews', result: 'PASS', note: 'pdftoppm' },
          ], caption: 'Synthetic test matrix.' },
        ],
      },
      {
        title: 'Decision', kicker: '03 · Release',
        blocks: [
          { type: 'paragraph', text: 'The fixture is synthetic and must not be described as factual. The release decision is based on mandatory gates first and the weighted quality score second.' },
          { type: 'callout', tone: 'info', title: 'Test boundary', text: 'No real person, organisation, or financial result is represented.' },
        ],
      },
    ],
    ...overrides,
  }
}

export function stressDocument() {
  const rows = Array.from({ length: 60 }, (_, index) => ({
    id: `ROW-${String(index + 1).padStart(3, '0')}`,
    metric: `Synthetic metric ${index + 1}`,
    value: String((index + 1) * 17),
    note: index % 2 === 0 ? 'Stable' : 'Variance observed in the synthetic run',
  }))
  return {
    document_id: 'test-stress-document',
    title: 'Stress Test: Panjang, Campuran Bahasa, dan Tabel Besar',
    subtitle: 'Long paragraphs, mixed Indonesian/English, a large table, multiple charts, long URLs, and unsupported glyphs — all synthetic',
    category: 'report',
    language: 'id',
    audience: 'QA engineers and layout reviewers',
    purpose: 'Exercise pagination and content-preservation edge cases',
    content_mode: 'preserve',
    synthetic: true,
    page: { size: 'A4' },
    theme: { family: 'infographic_visual' },
    metadata: { author: 'AI PDF Studio tests', organization: 'AI PDF Studio', created_at: '2026-11-10T08:00:00Z', keywords: ['stress', 'synthetic'] },
    quality: { target_score: 70, max_repair_iterations: 2 },
    sections: [
      {
        title: 'Ringkasan dan cakupan', kicker: '01 · Mixed language',
        blocks: [
          { type: 'paragraph', text: 'Dokumen ini menguji ketahanan tata letak terhadap paragraf panjang, istilah campuran Indonesia dan English, karakter seperti Ångström, 日本語, العربية, dan tanda kutip “tipografis”. Semua data bersifat sintetis. The same paragraph also includes a deliberately long unbroken URL: https://example.test/a/very/long/path/that/should/wrap/without/overflowing/the/page/and/continuing/for/a/while?query=abcdefghijklmnopqrstuvwxyz0123456789', lead: true },
          { type: 'callout', tone: 'warning', title: 'Peringatan sintetis', text: 'Tidak ada angka nyata, organisasi nyata, atau klaim faktual dalam dokumen ini.' },
        ],
      },
      {
        title: 'Large table', kicker: '02 · Pagination',
        blocks: [
          { type: 'table', title: 'Sixty-row synthetic table', columns: [
            { key: 'id', label: 'ID', width: 16 }, { key: 'metric', label: 'Metric', width: 36 },
            { key: 'value', label: 'Value', align: 'right', width: 16 }, { key: 'note', label: 'Note', width: 32 },
          ], rows, caption: 'Synthetic table designed to span multiple pages with a repeated header.' },
        ],
      },
      {
        title: 'Multiple charts', kicker: '03 · Visual stress',
        blocks: [
          { type: 'chart', chart_type: 'line', title: 'Synthetic trend', data: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], series: [{ name: 'Actual', values: [10, 12, 11, 15, 18, 17, 21, 23, 22, 26] }, { name: 'Plan', values: [11, 11, 12, 14, 16, 18, 20, 21, 23, 24] }] }, caption: 'Synthetic data.' },
          { type: 'chart', chart_type: 'donut', title: 'Synthetic mix', data: { items: [{ label: 'Alpha', value: 38 }, { label: 'Beta', value: 27 }, { label: 'Gamma', value: 21 }, { label: 'Delta', value: 14 }] }, caption: 'Synthetic data.' },
          { type: 'chart', chart_type: 'horizontal_bar', title: 'Synthetic ranking', data: { categories: ['Synthetic category with a long label', 'Another long category label', 'Short'], series: [{ name: 'Score', values: [73, 58, 41] }] }, caption: 'Synthetic data.' },
        ],
      },
      {
        title: 'Panjang dan penutup', kicker: '04 · Long content',
        blocks: [
          { type: 'paragraph', text: 'Paragraf panjang berikut sengaja diulang untuk menguji reflow. '.repeat(24) },
          { type: 'list', ordered: true, items: Array.from({ length: 12 }, (_, index) => ({ title: `Langkah ${index + 1}`, text: 'Langkah sintetis dengan penjelasan singkat untuk menguji daftar panjang dan pemenggalan halaman.' })) },
        ],
      },
    ],
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export async function pdfInfo(pdfPath) {
  const { stdout } = await execFileP('pdfinfo', [pdfPath], { maxBuffer: 4 * 1024 * 1024 })
  const info = {}
  for (const line of stdout.split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index > 0) info[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  return info
}

export async function pdfText(pdfPath) {
  const { stdout } = await execFileP('pdftotext', ['-enc', 'UTF-8', pdfPath, '-'], { maxBuffer: 32 * 1024 * 1024 })
  return stdout
}

export async function describePdf(pdfPath) {
  const info = await pdfInfo(pdfPath)
  return {
    pages: Number(info.Pages ?? 0),
    title: info.Title ?? '',
    author: info.Author ?? '',
    encrypted: info.Encrypted === 'yes',
    tagged: info.Tagged === 'yes',
    page_size: info['Page size'] ?? '',
    text: await pdfText(pdfPath),
  }
}
