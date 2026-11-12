/**
 * Reference-guided design analysis.
 *
 * PDFs are rasterized with Poppler and measured with Pillow; text geometry is
 * read from Poppler word boxes. Images use the same image metrics but cannot
 * yield reliable typography or grid measurements, so those fields are marked
 * estimated/unknown rather than invented.
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run, runChecked } from '../core/process.js'
import { normalizeHex, relativeLuminance, contrastRatio, mixHex } from './contrast.js'
import { resolveAsset } from '../visuals/assets.js'
import { StudioError } from '../core/errors.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PAGE_METRICS = path.resolve(HERE, '../quality/page_metrics.py')

function parseInfo(stdout) {
  const info = {}
  for (const line of stdout.split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index > 0) info[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  return info
}

function parseBbox(html) {
  const pageMatch = /<page\s+width="([\d.]+)"\s+height="([\d.]+)">([\s\S]*?)<\/page>/i.exec(html)
  if (!pageMatch) return null
  const words = []
  const wordPattern = /<word\s+xMin="([-\d.]+)"\s+yMin="([-\d.]+)"\s+xMax="([-\d.]+)"\s+yMax="([-\d.]+)">([\s\S]*?)<\/word>/gi
  let match
  while ((match = wordPattern.exec(pageMatch[3])) !== null) {
    words.push({
      text: match[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
      xMin: Number(match[1]), yMin: Number(match[2]), xMax: Number(match[3]), yMax: Number(match[4]),
    })
  }
  return { width: Number(pageMatch[1]), height: Number(pageMatch[2]), words }
}

function rgb(hex) {
  const value = normalizeHex(hex).slice(1)
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]
}

function saturation(hex) {
  const [r, g, b] = rgb(hex).map(value => value / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
}

function pickPalette(metrics) {
  const bg = normalizeHex(metrics?.background ?? '#FFFFFF')
  const colors = (metrics?.dominant_colors ?? [])
    .filter(entry => /^#[0-9A-F]{6}$/.test(entry.hex))
    .map(entry => ({ ...entry, contrast: contrastRatio(entry.hex, bg), saturation: saturation(entry.hex), luminance: relativeLuminance(entry.hex) }))
    .filter(entry => entry.contrast > 1.35)
  const text = colors.filter(entry => entry.contrast >= 4.5).sort((a, b) => b.contrast - a.contrast)[0]?.hex
    ?? (relativeLuminance(bg) > 0.45 ? '#111111' : '#FFFFFF')
  const chromatic = colors.filter(entry => entry.saturation > 0.16).sort((a, b) => b.saturation - a.saturation)
  const primary = chromatic[0]?.hex ?? colors.sort((a, b) => b.fraction - a.fraction)[0]?.hex ?? '#14213D'
  const distance = (a, b) => {
    const left = rgb(a); const right = rgb(b)
    return Math.sqrt((left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2 + (left[2] - right[2]) ** 2)
  }
  const distinct = chromatic.find(entry => distance(entry.hex, primary) > 36)
  const accent = distinct?.hex ?? mixHex(primary, text, 0.38)
  return { primary, accent, background: bg, text, accent_derived: !distinct }
}

function guessStyle(palette, metrics, isDark) {
  const bgLum = relativeLuminance(palette.background)
  const sat = saturation(palette.accent)
  const colorfulness = metrics?.colorfulness ?? 0
  const ink = metrics?.ink_ratio ?? 0
  const scores = {
    modern_corporate: 0,
    premium_editorial: 0,
    minimalist_clean: 0,
    creative_bold: 0,
    technology_futuristic: 0,
    luxury_elegant: 0,
    academic_professional: 0,
    infographic_visual: 0,
  }
  if (isDark) {
    scores.modern_corporate += 30 + (sat >= 0.3 && sat <= 0.68 && colorfulness < 0.32 ? 22 : 0)
    scores.technology_futuristic += 28 + (sat > 0.7 ? 22 : 0) + (colorfulness > 0.32 ? 12 : 0)
    scores.luxury_elegant += 28 + (sat < 0.55 ? 18 : 0)
    scores.creative_bold += 20 + (colorfulness > 0.24 ? 15 : 0)
  } else {
    scores.minimalist_clean += 34 + (ink < 0.08 ? 20 : 0)
    scores.modern_corporate += 28 + (sat > 0.3 && saturation(palette.primary) > 0.2 ? 18 : 0)
    scores.premium_editorial += 26 + (bgLum < 0.98 ? 14 : 0)
    scores.academic_professional += 24 + (colorfulness < 0.06 ? 12 : 0)
    scores.infographic_visual += 20 + (colorfulness > 0.09 ? 24 : 0)
    scores.creative_bold += 18 + (sat > 0.65 ? 22 : 0)
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const style = ranked[0][0]
  const confidence = Math.min(0.72, 0.34 + ranked[0][1] / 180)
  return { style, confidence, scores: Object.fromEntries(ranked) }
}

function clusterColumns(words, pageWidth) {
  const lefts = words.filter(word => word.yMin > 60 && word.yMax < 900).map(word => word.xMin).sort((a, b) => a - b)
  if (lefts.length < 8) return { columns: 1, confidence: 0.3 }
  const clusters = []
  for (const left of lefts) {
    const cluster = clusters.at(-1)
    if (cluster && Math.abs(cluster.center - left) < 24) {
      cluster.values.push(left)
      cluster.center = cluster.values.reduce((sum, value) => sum + value, 0) / cluster.values.length
    } else {
      clusters.push({ center: left, values: [left] })
    }
  }
  const meaningful = clusters.filter(cluster => cluster.values.length >= 3 && cluster.center > pageWidth * 0.05)
  return { columns: meaningful.length >= 2 ? 2 : 1, confidence: meaningful.length >= 2 ? 0.55 : 0.4, clusters: meaningful.map(cluster => Math.round(cluster.center)) }
}

function inferLayout(bbox, metrics) {
  if (!bbox) {
    const bboxPct = metrics?.content_bbox
    return {
      columns: null,
      whitespace: (metrics?.ink_ratio ?? 0) < 0.08 ? 'generous' : (metrics?.ink_ratio ?? 0) > 0.18 ? 'tight' : 'balanced',
      composition: 'unknown',
      margins_estimated_pct: bboxPct ? { left: bboxPct.left_pct, right: bboxPct.right_pct, top: bboxPct.top_pct, bottom: bboxPct.bottom_pct } : null,
      estimated: true,
      confidence: 0.25,
    }
  }
  const body = bbox.words.filter(word => word.yMin > 55 && word.yMax < bbox.height - 50)
  const marginLeft = body.length ? Math.min(...body.map(word => word.xMin)) : 0
  const marginRight = body.length ? bbox.width - Math.max(...body.map(word => word.xMax)) : 0
  const marginTop = body.length ? Math.min(...body.map(word => word.yMin)) : 0
  const marginBottom = body.length ? bbox.height - Math.max(...body.map(word => word.yMax)) : 0
  const columns = clusterColumns(body, bbox.width)
  const heights = body.map(word => word.yMax - word.yMin).filter(value => value > 3).sort((a, b) => a - b)
  const median = heights[Math.floor(heights.length / 2)] ?? null
  const maximum = heights.at(-1) ?? null
  return {
    columns: columns.columns,
    columns_confidence: columns.confidence,
    whitespace: (metrics?.ink_ratio ?? 0) < 0.07 ? 'generous' : (metrics?.ink_ratio ?? 0) > 0.17 ? 'tight' : 'balanced',
    composition: columns.columns >= 2 ? 'multi_column' : 'single_column',
    margins_estimated_pt: {
      left: Math.round(marginLeft), right: Math.round(marginRight),
      top: Math.round(marginTop), bottom: Math.round(marginBottom),
    },
    heading_scale_ratio: median && maximum ? Number((maximum / median).toFixed(2)) : null,
    hierarchy: maximum && median && maximum / median > 2 ? 'high_contrast' : 'moderate',
    estimated: true,
    confidence: 0.55,
  }
}

async function metricsFor(paths) {
  const result = await run('python3', [PAGE_METRICS], {
    timeoutMs: 60000,
    input: JSON.stringify(paths),
    maxBytes: 4 * 1024 * 1024,
  })
  if (result.code !== 0) throw new StudioError('reference_analysis_failed', 'Metrik gambar halaman gagal dihitung.', { details: { stderr: result.stderr.slice(0, 800) } })
  return JSON.parse(result.stdout)
}

function normalizeUserProfile(input) {
  const profile = input && typeof input === 'object' ? structuredClone(input) : {}
  const colors = {}
  for (const key of ['primary', 'accent', 'background', 'text']) {
    if (typeof profile.colors?.[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(profile.colors[key])) colors[key] = normalizeHex(profile.colors[key])
  }
  return {
    profile_version: '1.0',
    source: { method: 'user_authored', estimated: false, path: null, type: 'profile' },
    visual_style: String(profile.visual_style ?? 'premium_editorial').replace(/\s+/g, '_').toLowerCase(),
    colors,
    typography: {
      heading_style: String(profile.typography?.heading_style ?? 'editorial_serif'),
      body_style: String(profile.typography?.body_style ?? 'clean_sans'),
      hierarchy: String(profile.typography?.hierarchy ?? 'high_contrast'),
      estimated: false,
    },
    layout: {
      columns: Number(profile.layout?.columns ?? 1),
      whitespace: ['generous', 'balanced', 'tight'].includes(profile.layout?.whitespace) ? profile.layout.whitespace : 'generous',
      composition: String(profile.layout?.composition ?? 'asymmetric'),
      estimated: false,
    },
    confidence: 1,
    warnings: ['Profil diberikan oleh pengguna, jadi tidak ada analisis gambar yang dijalankan.'],
    evidence: ['user-authored design profile'],
  }
}

/**
 * @param {{referencePath:string, workDir:string, userProfile?:object, fidelity?:string}} args
 */
export async function analyzeReference({ referencePath, workDir, userProfile = null, fidelity = 'inspired' }) {
  if (userProfile) {
    return {
      profile: normalizeUserProfile(userProfile),
      fidelity,
      analyzed_pages: 0,
      preview_paths: [],
      method: 'user_authored',
      warnings: ['Analisis visual tidak dijalankan. Profil desain dari Anda dipakai sebagai acuan utama.'],
    }
  }
  await mkdir(workDir, { recursive: true })
  const ext = path.extname(referencePath).toLowerCase()
  const isPdf = ext === '.pdf'
  const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)
  if (!isPdf && !isImage) throw new StudioError('unsupported_reference', 'Referensi harus berupa berkas PDF, PNG, JPEG, atau WebP.')
  const previews = []
  let bbox = null
  let pageCount = 1
  let pageSize = null
  if (isPdf) {
    const info = parseInfo((await run('pdfinfo', [referencePath], { timeoutMs: 30000 })).stdout)
    pageCount = Number(info.Pages ?? 1)
    const prefix = path.join(workDir, 'reference')
    await runChecked('pdftoppm', ['-png', '-f', '1', '-l', String(Math.min(2, pageCount)), '-r', '110', '-singlefile', referencePath, prefix], { timeoutMs: 60000 })
    // pdftoppm -singlefile only writes the first page; render page 2 separately for layout.
    const first = path.join(workDir, 'reference.png')
    previews.push(first)
    if (pageCount > 1) {
      const secondPrefix = path.join(workDir, 'reference-layout')
      await runChecked('pdftoppm', ['-png', '-f', '2', '-l', '2', '-r', '110', '-singlefile', referencePath, secondPrefix], { timeoutMs: 60000 })
      previews.push(path.join(workDir, 'reference-layout.png'))
    }
    const bboxPage = Math.min(2, pageCount)
    const bboxResult = await run('pdftotext', ['-bbox', '-enc', 'UTF-8', '-f', String(bboxPage), '-l', String(bboxPage), referencePath, '-'], { timeoutMs: 30000 })
    bbox = bboxResult.code === 0 ? parseBbox(bboxResult.stdout) : null
    pageSize = bbox ? { width: bbox.width, height: bbox.height } : null
  } else {
    const copy = path.join(workDir, `reference${ext}`)
    await copyFile(referencePath, copy)
    previews.push(copy)
  }
  const metrics = await metricsFor(previews)
  if (!metrics[0] || metrics[0].error) throw new StudioError('reference_analysis_failed', 'Tidak berhasil mengukur gambar referensi.', { details: metrics[0] ?? null })
  const coverMetrics = metrics[0]
  const layoutMetrics = metrics[1] ?? metrics[0]
  const palette = pickPalette(coverMetrics)
  const style = guessStyle(palette, coverMetrics, Boolean(coverMetrics.is_dark))
  const layout = inferLayout(bbox, layoutMetrics)
  const warnings = [
    'Nilai palet diambil dari hasil render referensi, bukan token sumber yang persis.',
    ...(palette.accent_derived ? ['Referensi hanya punya satu warna kromatik yang bisa dipakai, jadi aksen sekunder diambil dari turunannya.'] : []),
    'Nilai tipografi dan grid masih perkiraan, kecuali referensi berupa profil desain dari Anda.',
    'Jangan meniru karya, foto, atau ilustrasi khas yang dilindungi tanpa izin.',
  ]
  if (!isPdf) warnings.push('Referensi gambar tidak punya lapisan teks, jadi ukuran kolom, margin, dan skala huruf tidak tersedia atau kurang bisa dipercaya.')
  const profile = {
    profile_version: '1.0',
    source: {
      method: isPdf ? 'pdf_raster_and_text_geometry' : 'image_raster_metrics',
      estimated: true,
      path: referencePath,
      type: isPdf ? 'pdf' : 'image',
      page_count: pageCount,
      page_size_pt: pageSize,
    },
    visual_style: style.style,
    visual_style_confidence: Number(style.confidence.toFixed(2)),
    visual_style_scores: style.scores,
    colors: palette,
    typography: {
      heading_style: ['premium_editorial', 'luxury_elegant', 'academic_professional'].includes(style.style) ? 'editorial_serif' : 'clean_sans',
      body_style: 'clean_sans',
      hierarchy: layout.hierarchy ?? 'moderate',
      estimated: true,
      confidence: 0.35,
    },
    layout: {
      columns: layout.columns,
      whitespace: layout.whitespace,
      composition: layout.composition,
      margins_estimated_pt: layout.margins_estimated_pt ?? null,
      margins_estimated_pct: layout.margins_estimated_pct ?? null,
      heading_scale_ratio: layout.heading_scale_ratio ?? null,
      density: (layoutMetrics.ink_ratio ?? 0) > 0.16 ? 'dense' : (layoutMetrics.ink_ratio ?? 0) < 0.06 ? 'airy' : 'balanced',
      estimated: true,
      confidence: layout.confidence,
    },
    motifs: [],
    confidence: Number(Math.min(0.72, (style.confidence + layout.confidence) / 2).toFixed(2)),
    warnings,
    evidence: [
      `dominant background ${palette.background}`,
      `sampled primary ${palette.primary}`,
      `sampled accent ${palette.accent}`,
      `ink ratio ${layoutMetrics.ink_ratio}`,
      `edge ratio ${layoutMetrics.edge_ratio}`,
      `text word boxes: ${bbox?.words.length ?? 0}`,
      `column estimate: ${layout.columns ?? 'unknown'}`,
    ],
  }
  return {
    profile,
    fidelity,
    analyzed_pages: isPdf ? previews.length : 1,
    preview_paths: previews,
    method: profile.source.method,
    warnings,
    metrics,
    text_bbox_available: Boolean(bbox),
  }
}

export function referenceProfileToDocument(document, profile, fidelity, source = null) {
  if (!['inspired', 'brand_matched', 'layout_guided'].includes(fidelity)) {
    throw new StudioError('invalid_reference_fidelity', 'fidelity harus inspired, brand_matched, atau layout_guided.')
  }
  const next = structuredClone(document)
  next.reference = {
    fidelity,
    profile: structuredClone(profile),
    source: source ?? profile?.source?.path ?? null,
  }
  if (profile?.visual_style && !next.theme?.family) next.theme.family = profile.visual_style
  return next
}

export async function analyzeReferenceOperation({ reference_path, output_dir, user_profile, fidelity = 'inspired' }, options = {}) {
  const { resolveInputFile, resolveOutputDir } = await import('../core/paths.js')
  const { loadConfig } = await import('../core/configuration.js')
  const config = options.config ?? await loadConfig({ workspaceRoot: options.workspaceRoot ?? process.cwd() })
  const resolved = await resolveInputFile(config.workspace_root, reference_path)
  const outputDir = await resolveOutputDir({
    workspaceRoot: config.workspace_root, outputRoot: config.output_root,
    outputDir: output_dir, documentId: 'reference-analysis',
  })
  const result = await analyzeReference({
    referencePath: resolved,
    workDir: outputDir,
    userProfile: user_profile,
    fidelity,
  })
  return {
    status: 'success',
    ...result,
    analysis_dir: outputDir,
    profile_path: path.join(outputDir, 'reference-profile.json'),
    preview_paths: result.preview_paths,
  }
}
