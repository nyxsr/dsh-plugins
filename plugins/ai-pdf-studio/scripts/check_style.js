#!/usr/bin/env node
/**
 * Memeriksa aturan gaya bahasa di docs/WRITING_STYLE.md.
 * Pemakaian: node scripts/check_style.js [berkas atau direktori ...]
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const DEFAULTS = ['README.md', 'docs', 'locale/id.json', 'templates', 'examples']

const BANNED = [
  'di era digital', 'di tengah perkembangan zaman', 'tak dapat dipungkiri',
  'perlu diketahui bahwa', 'solusi terbaik', 'one-stop solution',
  'mengedepankan', 'berkomitmen untuk memberikan yang terbaik',
  'seamless', 'leverage', 'unlock', 'empower', 'robust', 'cutting-edge',
  'game-changer', 'delve into', "in today's fast-paced world", 'it is worth noting',
  'end-to-end', 'holistik', 'sinergi',
]
const BANNED_RE = new RegExp(`\\b(${BANNED.map(escapeRe).join('|')})\\b`, 'gi')

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function collect(targets) {
  const files = []
  for (const target of targets) {
    const full = path.resolve(ROOT, target)
    let info
    try { info = await stat(full) } catch { continue }
    if (info.isDirectory()) {
      for (const entry of await readdir(full)) {
        const child = path.join(full, entry)
        if ((await stat(child)).isFile()) files.push(child)
      }
    } else if (info.isFile()) {
      files.push(full)
    }
  }
  return files.filter(file => /\.(md|json)$/.test(file) && !file.endsWith('docs/WRITING_STYLE.md'))
}

function stripMarkdown(text) {
  return text
    .replace(/^```[\s\S]*?^```/gm, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/^\s*\|.*\|\s*$/gm, '')
}

function jsonStrings(value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach(item => jsonStrings(item, out))
  else if (value && typeof value === 'object') Object.values(value).forEach(item => jsonStrings(item, out))
  return out
}

function proseOf(file, raw) {
  if (file.endsWith('.md')) return stripMarkdown(raw)
  if (file.endsWith('.json')) {
    try {
      return jsonStrings(JSON.parse(raw))
        .filter(text => /\s/.test(text) && !/^[a-z0-9_./-]+$/i.test(text))
        .join('\n')
    } catch {
      return raw
    }
  }
  return raw
}

const RULES = [
  { id: 'titik-koma', label: 'titik koma', test: text => text.split(';').length - 1 },
  { id: 'tanda-pisah', label: 'em dash atau en dash', test: text => (text.match(/[—–]/g) ?? []).length },
  { id: 'emoji', label: 'emoji', test: text => (text.match(/\p{Extended_Pictographic}/gu) ?? []).length },
  { id: 'klise', label: 'frasa klise', test: text => (text.match(BANNED_RE) ?? []).length },
]

const files = await collect(process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS)
const findings = []
for (const file of files) {
  const raw = await readFile(file, 'utf8')
  const prose = proseOf(file, raw)
  for (const rule of RULES) {
    const count = rule.test(prose)
    if (count > 0) findings.push({ file: path.relative(ROOT, file), rule: rule.label, count })
  }
}

if (findings.length === 0) {
  console.log(`Gaya bahasa bersih di ${files.length} berkas.`)
  process.exit(0)
}
console.error('Ada teks yang melanggar panduan gaya:')
for (const item of findings) console.error(`  ${item.file}: ${item.count} ${item.rule}`)
process.exit(1)
