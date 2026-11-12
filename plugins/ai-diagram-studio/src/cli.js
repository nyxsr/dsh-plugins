#!/usr/bin/env node
/** Standalone CLI for the same engine used by the DSH tools. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createStudio } from './api/studio.js'

const HELP = `AI Diagram Studio

Usage:
  ai-diagram-studio generate "<requirement>" [options]
  ai-diagram-studio revise <diagram-id> "<instruction>" [options]
  ai-diagram-studio validate [--id <diagram-id> | "<requirement>"] [options]
  ai-diagram-studio export <diagram-id> [options]
  ai-diagram-studio list
  ai-diagram-studio revisions <diagram-id>

Options:
  --type <auto|erd|flowchart|uml_class|uml_usecase|uml_activity|uml_state|sequence|architecture|uml>
  --formats <svg,png,pdf>       default: svg,png,pdf
  --theme <professional|light|dark|monochrome>
  --orientation <auto|portrait|landscape>
  --density <auto|compact|comfortable|spacious>
  --title <title>
  --language <auto|id|en>
  --scale <1-3>                 default: 2
  --spec <file.json>            structured specification
  --style <theme=...,orientation=...,density=...> for revise
  --json                        print the full result JSON
  --help

Examples:
  ai-diagram-studio generate "Buatkan ERD perpustakaan dengan anggota, buku, peminjaman" --formats pdf
  ai-diagram-studio revise dg-erd-... "Tambahkan tabel payments dan hubungkan dengan orders"
`

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) { positional.push(token); continue }
    const key = token.slice(2)
    if (key === 'json' || key === 'help') { flags[key] = true; continue }
    const value = argv[index + 1]
    if (value === undefined || (value.startsWith('--') && value !== '--')) throw new Error(`Missing value for --${key}`)
    flags[key] = value
    index += 1
  }
  return { positional, flags }
}

async function readSpec(file) {
  if (!file) return null
  const raw = await fs.readFile(path.resolve(file), 'utf8')
  return JSON.parse(raw)
}

function formats(value) {
  if (!value) return undefined
  return String(value).split(',').map(item => item.trim()).filter(Boolean)
}

function style(value) {
  if (!value) return undefined
  const output = {}
  for (const pair of String(value).split(',')) {
    const [key, val] = pair.split('=').map(item => item.trim())
    if (key && val) output[key] = val
  }
  return output
}

function print(result, asJson) {
  if (asJson) { process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); return }
  const lines = [`${result.status}`]
  for (const key of ['diagram_id', 'diagram_type', 'title', 'revision', 'selected_renderer']) if (result[key]) lines.push(`${key}: ${result[key]}`)
  for (const artifact of result.artifacts ?? []) lines.push(`${artifact.format}: ${artifact.relative_path ?? artifact.path} (${artifact.bytes} bytes)`)
  for (const warning of (result.warnings ?? []).slice(0, 5)) lines.push(`warning: ${warning}`)
  for (const clarification of result.clarifications ?? []) lines.push(`clarification: ${clarification}`)
  for (const error of result.errors ?? []) lines.push(`error [${error.code}]: ${error.message}`)
  if (result.diagram_types) {
    lines.push(`types: ${result.diagram_types.map(item => item.type).join(', ')}`)
    lines.push(`renderer: ${result.selected_renderer}`)
    lines.push(`stored: ${result.stored_diagrams?.length ?? 0}`)
  }
  if (result.revisions) lines.push(`revisions: ${result.revisions.length}`)
  process.stdout.write(`${lines.join('\n')}\n`)
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  if (flags.help || !positional.length) { process.stdout.write(HELP); return 0 }
  const command = positional.shift()
  const workspaceRoot = path.resolve(flags.workspace ?? process.cwd())
  const studio = createStudio({ workspaceRoot, storeRoot: flags.store ?? '.diagram-studio', chromiumPath: flags.chromium })
  const spec = await readSpec(flags.spec)
  const base = {
    diagram_type: flags.type,
    title: flags.title,
    structured_specification: spec,
    output_formats: formats(flags.formats),
    theme: flags.theme,
    orientation: flags.orientation,
    layout_density: flags.density,
    language: flags.language,
    scale: flags.scale ? Number(flags.scale) : undefined,
  }
  let result
  switch (command) {
    case 'generate':
      result = await studio.generate({ ...base, requirement: positional.join(' ') })
      break
    case 'revise': {
      const [diagramId, ...instruction] = positional
      if (!diagramId) throw new Error('revise requires a diagram id')
      result = await studio.revise({ ...base, diagram_id: diagramId, instruction: instruction.join(' '), style: style(flags.style), structured_patch: spec })
      break
    }
    case 'validate':
      result = flags.id
        ? await studio.validate({ diagram_id: flags.id })
        : await studio.validate({ ...base, requirement: positional.join(' ') })
      break
    case 'export': {
      const diagramId = flags.id ?? positional[0]
      if (!diagramId) throw new Error('export requires a diagram id')
      result = await studio.export({ diagram_id: diagramId, output_formats: formats(flags.formats), scale: flags.scale ? Number(flags.scale) : undefined })
      break
    }
    case 'list':
      result = await studio.list()
      break
    case 'revisions': {
      const diagramId = positional[0] ?? flags.id
      if (!diagramId) throw new Error('revisions requires a diagram id')
      result = await studio.revisions(diagramId)
      break
    }
    default:
      throw new Error(`Unknown command: ${command}`)
  }
  print(result, flags.json)
  return result.status === 'FAILED' || result.status === 'NEEDS_CLARIFICATION' ? 1 : 0
}

main().then(code => { process.exitCode = code }).catch(error => {
  process.stderr.write(`ai-diagram-studio: ${error.message}\n`)
  process.exitCode = 2
})
