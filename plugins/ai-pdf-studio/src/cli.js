#!/usr/bin/env node
/**
 * Command-line interface for AI PDF Studio Ultimate.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createStudio } from './api/service.js'
import { StudioError } from './core/errors.js'

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = argv[index + 1]
      if (next === undefined || next.startsWith('--')) flags[key] = true
      else { flags[key] = next; index += 1 }
    } else {
      positional.push(token)
    }
  }
  return { command: positional[0], args: positional.slice(1), flags }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), 'utf8'))
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

async function main() {
  const { command, args, flags } = parseArgs(process.argv.slice(2))
  const workspaceRoot = path.resolve(flags.workspace ?? process.cwd())
  const studio = createStudio({ workspaceRoot, configPath: flags.config })
  switch (command) {
    case 'capabilities':
      return print(await studio.capabilities())
    case 'generate': {
      const input = flags.input ?? args[0]
      if (!input) throw new StudioError('invalid_cli', 'perintah generate butuh --input <document.json>.')
      const document = await readJson(input)
      return print(await studio.generate_pdf({
        document,
        template_id: flags.template,
        output_dir: flags.out,
        visual_review: flags['visual-review'] ? await readJson(flags['visual-review']) : undefined,
      }))
    }
    case 'preview':
      return print(await studio.preview_pdf({
        pdf_path: flags.pdf ?? args[0],
        output_dir: flags.out,
        dpi: flags.dpi ? Number(flags.dpi) : undefined,
      }))
    case 'inspect':
      return print(await studio.inspect_pdf({
        pdf_path: flags.pdf ?? args[0],
        document_path: flags.document,
        output_dir: flags.out,
        dpi: flags.dpi ? Number(flags.dpi) : undefined,
      }))
    case 'edit':
      return print(await studio.edit_pdf({
        input_path: flags.input ?? args[0],
        operations: await readJson(flags.operations),
        output_path: flags.out,
        output_dir: flags['out-dir'],
        metadata: flags.metadata ? await readJson(flags.metadata) : undefined,
      }))
    case 'redesign':
      return print(await studio.redesign_pdf({
        pdf_path: flags.pdf ?? args[0],
        title: flags.title,
        category: flags.category,
        language: flags.language,
        theme_family: flags.theme,
        output_dir: flags.out,
        visual_review: flags['visual-review'] ? await readJson(flags['visual-review']) : undefined,
      }))
    case 'list-templates':
      return print(await studio.list_templates())
    case 'list-themes':
      return print(await studio.list_themes())
    case 'analyze-reference':
      return print(await studio.analyze_design_reference({
        reference_path: flags.reference ?? args[0],
        output_dir: flags.out,
        fidelity: flags.fidelity,
        user_profile: flags.profile ? await readJson(flags.profile) : undefined,
      }))
    case 'apply-brand':
      return print(await studio.apply_brand_kit({
        document: await readJson(flags.input ?? args[0]),
        brand_kit: await readJson(flags.brand ?? args[1]),
        output_dir: flags.out,
      }))
    case 'validate':
      return print(await studio.validate_document({ document: await readJson(flags.input ?? args[0]) }))
    case 'export':
      return print(await studio.export_pdf({
        pdf_path: flags.pdf ?? args[0],
        output_path: flags.out ?? args[1],
      }))
    default:
      process.stderr.write(`AI PDF Studio Ultimate\n\nPerintah:\n  generate --input <json> [--template id] [--out dir]\n  preview --pdf <pdf> [--out dir]\n  inspect --pdf <pdf> [--document json]\n  edit --input <pdf> --operations <json> [--out file]\n  redesign --pdf <pdf> [--theme family] [--out dir]\n  list-templates\n  list-themes\n  analyze-reference --reference <pdf|image> [--fidelity inspired|brand_matched|layout_guided]\n  apply-brand --input <json> --brand <json>\n  validate --input <json>\n  export --pdf <pdf> --out <pdf>\n  capabilities\n`)
      process.exitCode = command ? 1 : 0
  }
}

main().catch(error => {
  const structured = error instanceof StudioError
    ? error.toJSON()
    : { status: 'error', error: { code: 'unexpected_error', message: error instanceof Error ? error.message : String(error) } }
  process.stderr.write(`${JSON.stringify(structured, null, 2)}\n`)
  process.exitCode = 1
})
