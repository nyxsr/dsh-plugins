/** Configuration loading and validation. */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { StudioError } from './errors.js'
import { assertInside } from './paths.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const PACKAGE_ROOT = path.resolve(HERE, '../..')

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge(base, overlay) {
  if (!isObject(base)) return structuredClone(overlay)
  const output = structuredClone(base)
  for (const [key, value] of Object.entries(overlay ?? {})) {
    if (isObject(value) && isObject(output[key])) output[key] = deepMerge(output[key], value)
    else output[key] = structuredClone(value)
  }
  return output
}

async function readYaml(filePath) {
  try {
    return parseYaml(await readFile(filePath, 'utf8')) ?? {}
  } catch (error) {
    throw new StudioError('config_invalid', `Tidak bisa membaca konfigurasi: ${filePath}`, { cause: error })
  }
}

/**
 * @param {{workspaceRoot:string, configPath?:string, overrides?:object}} options
 */
export async function loadConfig(options) {
  const workspaceRoot = path.resolve(options.workspaceRoot)
  const defaults = await readYaml(path.join(PACKAGE_ROOT, 'config', 'default.yaml'))
  const qualityRules = await readYaml(path.join(PACKAGE_ROOT, 'config', 'quality_rules.yaml'))
  let userConfig = {}
  if (options.configPath) {
    const resolved = assertInside(workspaceRoot, path.resolve(workspaceRoot, options.configPath), 'config_outside_workspace')
    userConfig = await readYaml(resolved)
  }
  const config = deepMerge(deepMerge(defaults, userConfig), options.overrides ?? {})
  const errors = []
  const target = Number(config.target_score)
  if (!Number.isFinite(target) || target < 50 || target > 100) errors.push('target_score harus di antara 50 dan 100')
  const repairs = Number(config.max_repair_iterations)
  if (!Number.isInteger(repairs) || repairs < 0 || repairs > 3) errors.push('max_repair_iterations harus bilangan bulat 0 sampai 3')
  const dpi = Number(config.preview_dpi)
  if (!Number.isFinite(dpi) || dpi < 60 || dpi > 220) errors.push('preview_dpi harus di antara 60 dan 220')
  if (!isObject(config.rendering)) errors.push('rendering harus berupa objek')
  if (!isObject(config.security)) errors.push('security harus berupa objek')
  if (errors.length) throw new StudioError('config_invalid', 'Validasi konfigurasi gagal.', { details: { errors } })
  return {
    ...config,
    target_score: target,
    max_repair_iterations: repairs,
    preview_dpi: dpi,
    quality_rules: qualityRules,
    workspace_root: workspaceRoot,
    package_root: PACKAGE_ROOT,
    config_path: options.configPath ? path.resolve(workspaceRoot, options.configPath) : null,
  }
}
