/** Reusable document-category templates. */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { StudioError } from '../core/errors.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = path.resolve(HERE, '../../templates')

let cache

export async function loadTemplates() {
  if (cache) return cache
  const files = (await readdir(TEMPLATE_DIR)).filter(file => file.endsWith('.json')).sort()
  const templates = []
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(TEMPLATE_DIR, file), 'utf8'))
    if (!raw.template_id || !raw.name || !raw.category || !raw.theme) {
      throw new StudioError('invalid_template', `Template ${file} tidak punya template_id, name, category, atau theme.`)
    }
    templates.push({ ...raw, file })
  }
  cache = templates
  return templates
}

export async function listTemplates(filter = {}) {
  const templates = await loadTemplates()
  return templates.filter(template =>
    (!filter.category || template.category === filter.category)
    && (!filter.theme || template.theme === filter.theme))
}

export async function getTemplate(templateId) {
  const templates = await loadTemplates()
  const template = templates.find(candidate => candidate.template_id === templateId)
  if (!template) {
    throw new StudioError('template_not_found', `Template tidak dikenal: ${templateId}`, {
      details: { available: templates.map(t => t.template_id) },
    })
  }
  return template
}

/** Merge category-template defaults into a raw document request. */
export function mergeTemplate(template, request) {
  if (!template) return structuredClone(request)
  const merged = structuredClone(request)
  merged.category ??= template.category
  merged.page = { size: template.page_size, ...(merged.page ?? {}) }
  merged.theme = { family: template.theme, ...(merged.theme ?? {}) }
  merged.cover = { kind: template.cover_kind, ...(merged.cover ?? {}) }
  merged.metadata = {
    ...(merged.metadata ?? {}),
    template_id: template.template_id,
    template_version: template.version,
  }
  if (template.default_audience && !merged.audience) merged.audience = template.default_audience
  if (template.default_purpose && !merged.purpose) merged.purpose = template.default_purpose
  return merged
}
