/**
 * Stable service operations for the CLI, HTTP adapters, tests, and DSH tools.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { loadConfig } from '../core/configuration.js'
import { validateDocument, summarizeDocument } from '../core/models.js'
import { generatePdf, previewPdfOperation, validateDocumentOperation, listTemplatesOperation } from '../core/pipeline.js'
import { inspectPdf } from '../quality/inspector.js'
import { previewPdf } from '../render/preview_renderer.js'
import { findChromium } from '../render/chromium.js'
import { editPdf } from '../editing/pdf_editor.js'
import { redesignPdf } from '../editing/redesign.js'
import { analyzeReference } from '../design/reference_analyzer.js'
import { applyBrandKit, validateBrandKit } from '../branding/brandkit.js'
import { resolveInputFile, resolveOutputDir, assertInside, sanitizeFilename } from '../core/paths.js'
import { run } from '../core/process.js'
import { StudioError } from '../core/errors.js'
import { THEME_LIST, themePreviewMeta } from '../design/themes.js'

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

async function minimalDocument(pdfPath) {
  const info = (await run('pdfinfo', [pdfPath], { timeoutMs: 30000 })).stdout
  const pageMatch = info.match(/^Page size:\s+([\d.]+)\s*x\s+([\d.]+)\s*pts/m)
  const title = /^Title:\s+(.+)$/m.exec(info)?.[1]?.trim() || path.basename(pdfPath, '.pdf')
  const width = Number(pageMatch?.[1] ?? 595.28)
  const height = Number(pageMatch?.[2] ?? 841.89)
  return {
    document_id: `inspect-${sanitizeFilename(path.basename(pdfPath, '.pdf'))}`,
    document_version: 1,
    title, subtitle: '', category: 'report', language: 'en', synthetic: false,
    page: {
      size: 'A4', width_pt: width, height_pt: height,
      orientation: width > height ? 'landscape' : 'portrait',
      margins: { top: 54, right: 54, bottom: 54, left: 54 },
    },
    theme: { family: 'modern_corporate', tokens: {} },
    sections: [], citations: [],
    metadata: { title, created_at: new Date().toISOString() },
    quality: { target_score: 90, max_repair_iterations: 0 },
    layout: { section_start: 'page' },
  }
}

export function createStudio(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd())
  let configPromise
  const getConfig = async () => {
    if (!configPromise) {
      configPromise = loadConfig({
        workspaceRoot,
        configPath: options.configPath,
        overrides: options.configOverrides,
      })
    }
    return configPromise
  }

  async function resolveDocument(request) {
    if (request.document && typeof request.document === 'object') return request.document
    if (request.document_path) {
      const file = await resolveInputFile(workspaceRoot, request.document_path)
      return JSON.parse(await readFile(file, 'utf8'))
    }
    return null
  }

  return {
    workspaceRoot,
    getConfig,

    async generate_pdf(request) {
      const config = options.config ?? await getConfig()
      return generatePdf(request, { config, workspaceRoot })
    },

    async preview_pdf(request) {
      const config = options.config ?? await getConfig()
      return previewPdfOperation(request, { config, workspaceRoot })
    },

    async inspect_pdf(request) {
      const config = options.config ?? await getConfig()
      const pdfPath = await resolveInputFile(workspaceRoot, request.pdf_path)
      let document = await resolveDocument(request)
      if (!document) {
        const sidecar = path.join(path.dirname(pdfPath), 'document.ir.json')
        try { document = JSON.parse(await readFile(sidecar, 'utf8')) } catch { document = await minimalDocument(pdfPath) }
      }
      const outputDir = await resolveOutputDir({
        workspaceRoot, outputRoot: config.output_root,
        outputDir: request.output_dir ?? path.join(config.output_root, 'inspections', sanitizeFilename(path.basename(pdfPath, '.pdf'))),
        documentId: document.document_id ?? 'inspection',
      })
      const previewArtifact = await previewPdf({
        pdfPath, outputDir: path.join(outputDir, 'previews'),
        dpi: request.dpi ?? config.preview_dpi,
      })
      const inspection = await inspectPdf({
        pdfPath, document, previews: previewArtifact.previews,
        layoutAudit: null, render: null,
      })
      const inspectionPath = path.join(outputDir, 'technical_inspection.json')
      await writeFile(inspectionPath, JSON.stringify(inspection, null, 2))
      return {
        status: 'success',
        pdf_path: pdfPath,
        inspection_path: inspectionPath,
        preview_paths: previewArtifact.preview_paths,
        page_count: inspection.pages,
        gates: inspection.gates,
        failed_gates: Object.entries(inspection.gates).filter(([, passed]) => !passed).map(([name]) => name),
        warnings: inspection.warnings,
        metadata: inspection.metadata,
        content: inspection.content,
        typography: inspection.typography,
        visual: inspection.visual,
      }
    },

    async edit_pdf(request) {
      const config = options.config ?? await getConfig()
      return editPdf({ ...request, workspaceRoot, config })
    },

    async redesign_pdf(request) {
      const config = options.config ?? await getConfig()
      return redesignPdf(request, { config, workspaceRoot })
    },

    async list_templates() {
      return listTemplatesOperation()
    },

    async list_themes() {
      return { themes: THEME_LIST.map(theme => ({ ...themePreviewMeta().find(item => item.family === theme.key), fonts: theme.fonts, layout: theme.layout })) }
    },

    async analyze_design_reference(request) {
      const config = options.config ?? await getConfig()
      const referencePath = await resolveInputFile(workspaceRoot, request.reference_path)
      const outputDir = await resolveOutputDir({
        workspaceRoot, outputRoot: config.output_root,
        outputDir: request.output_dir ?? path.join(config.output_root, 'reference-analysis'),
        documentId: 'reference-analysis',
      })
      const result = await analyzeReference({
        referencePath,
        workDir: outputDir,
        userProfile: request.user_profile ?? null,
        fidelity: request.fidelity ?? 'inspired',
      })
      const profilePath = path.join(outputDir, 'reference-profile.json')
      await writeFile(profilePath, JSON.stringify(result.profile, null, 2))
      return {
        status: 'success',
        ...result,
        profile_path: profilePath,
        analysis_dir: outputDir,
      }
    },

    async apply_brand_kit(request) {
      const config = options.config ?? await getConfig()
      if (!request.brand_kit) throw new StudioError('invalid_request', 'brand_kit wajib diisi.')
      const validated = await validateBrandKit(request.brand_kit, {
        workspaceRoot, baseDir: workspaceRoot, allowRemote: false,
      })
      let document = await resolveDocument(request)
      if (!document) {
        return { status: 'success', brand_report: validated, document: null, warnings: validated.warnings }
      }
      const validation = validateDocument(document)
      if (validation.errors.length) throw new StudioError('invalid_document', 'Validasi Document IR gagal.', { details: { errors: validation.errors } })
      const applied = await applyBrandKit(validation.document, request.brand_kit, { workspaceRoot, baseDir: workspaceRoot })
      const outputDir = await resolveOutputDir({
        workspaceRoot, outputRoot: config.output_root,
        outputDir: request.output_dir ?? path.join(config.output_root, 'branded'),
        documentId: applied.document.document_id,
      })
      const documentPath = path.join(outputDir, 'document.branded.ir.json')
      await writeFile(documentPath, JSON.stringify(applied.document, null, 2))
      return {
        status: 'success',
        ...applied,
        document_path: documentPath,
        summary: summarizeDocument(applied.document),
      }
    },

    async validate_document(request) {
      return validateDocumentOperation(request)
    },

    async export_pdf(request) {
      const config = options.config ?? await getConfig()
      const source = await resolveInputFile(workspaceRoot, request.pdf_path)
      const target = assertInside(workspaceRoot, path.resolve(workspaceRoot, request.output_path), 'output_outside_workspace')
      await mkdir(path.dirname(target), { recursive: true })
      await copyFile(source, target)
      const bytes = await readFile(target)
      const info = (await run('pdfinfo', [target], { timeoutMs: 30000 })).stdout
      return {
        status: 'success',
        pdf_path: target,
        source_pdf: source,
        bytes: bytes.byteLength,
        checksum_sha256: sha256(bytes),
        page_count: Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? 0),
      }
    },

    async capabilities() {
      const config = await getConfig()
      let chromium = process.env.AI_PDF_CHROMIUM || 'deteksi otomatis'
      try {
        const executable = await findChromium()
        const version = await run(executable, ['--version'], { timeoutMs: 5000 })
        chromium = (version.stdout || version.stderr).trim() || executable
      } catch { /* kapabilitas tetap deteksi otomatis */ }
      const pdfinfo = await run('pdfinfo', ['-v'], { timeoutMs: 5000 })
      const pdftoppm = await run('pdftoppm', ['-v'], { timeoutMs: 5000 })
      return {
        status: 'success',
        workspace_root: workspaceRoot,
        output_root: path.resolve(workspaceRoot, config.output_root),
        node: process.version,
        platform: process.platform,
        chromium,
        pdfinfo: (pdfinfo.stdout || pdfinfo.stderr).split('\n')[0],
        pdftoppm: (pdftoppm.stdout || pdftoppm.stderr).split('\n')[0],
        supports: {
          generate: true, preview: true, inspect: true, edit: true, redesign_text_pdf: true,
          ocr: false, vision_model_inside_engine: false, bookmarks: false, tagged_pdf_preserved_after_merge: false,
        },
        themes: THEME_LIST.map(theme => theme.key),
      }
    },
  }
}
