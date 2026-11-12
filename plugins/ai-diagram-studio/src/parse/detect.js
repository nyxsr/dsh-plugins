/** Diagram-type and language detection tuned for English and Indonesian. */
import { oneLine, titleCase } from '../core/text.js'

const TYPE_ALIASES = new Map(Object.entries({
  auto: 'auto',
  erd: 'erd', er: 'erd', entity_relationship: 'erd', 'entity-relationship': 'erd', database: 'erd', db: 'erd',
  flowchart: 'flowchart', flow: 'flowchart', workflow: 'flowchart', process: 'flowchart', 'process-flow': 'flowchart',
  uml_class: 'uml_class', class: 'uml_class', class_diagram: 'uml_class', 'class-diagram': 'uml_class',
  uml_usecase: 'uml_usecase', usecase: 'uml_usecase', use_case: 'uml_usecase', 'use-case': 'uml_usecase',
  uml_activity: 'uml_activity', activity: 'uml_activity', 'activity-diagram': 'uml_activity',
  uml_state: 'uml_state', state: 'uml_state', state_machine: 'uml_state', statemachine: 'uml_state', 'state-diagram': 'uml_state',
  sequence: 'sequence', sequence_diagram: 'sequence', 'sequence-diagram': 'sequence',
  architecture: 'architecture', arch: 'architecture', software_architecture: 'architecture', 'system-architecture': 'architecture',
  uml: 'uml',
}))

const ID_WORDS = new Set([
  'dan', 'yang', 'dengan', 'untuk', 'dari', 'buatkan', 'buat', 'sistem', 'tabel', 'memiliki',
  'mempunyai', 'relasi', 'hubungan', 'tampilkan', 'ekspor', 'jangan', 'ubah', 'tambahkan',
  'alur', 'proses', 'aktor', 'kelas', 'pesan', 'perpustakaan', 'anggota', 'buku', 'peminjaman',
  'pengembalian', 'denda', 'pengguna', 'aplikasi', 'sebuah', 'adalah', 'pada', 'ke', 'di',
  'status', 'langkah', 'jika', 'maka', 'atau', 'juga', 'agar', 'setelah', 'sebelum', 'oleh',
  'karyawan', 'manajer', 'admin', 'pelanggan', 'pesanan', 'produk', 'pembayaran', 'layanan',
  'komponen', 'batas', 'kelompok', 'gunakan', 'buatlah', 'tolong', 'mohon', 'saya', 'ingin',
])

const EN_WORDS = new Set([
  'the', 'and', 'with', 'for', 'from', 'create', 'build', 'generate', 'system', 'table',
  'has', 'have', 'relationship', 'show', 'export', 'do', 'not', 'add', 'change', 'flow',
  'actor', 'class', 'message', 'library', 'member', 'book', 'loan', 'return', 'fine',
  'user', 'application', 'is', 'on', 'to', 'of', 'when', 'then', 'or', 'also', 'after',
  'before', 'by', 'employee', 'manager', 'customer', 'order', 'product', 'payment', 'service',
  'component', 'boundary', 'group', 'use', 'please', 'want',
])

export function normalizeType(value) {
  if (!value) return null
  const key = String(value).trim().toLowerCase().replace(/\s+/g, '_')
  return TYPE_ALIASES.get(key) ?? null
}

export function detectLanguage(text) {
  const words = String(text ?? '').toLowerCase().match(/[a-z]+/g) ?? []
  let id = 0
  let en = 0
  for (const word of words) {
    if (ID_WORDS.has(word)) id += 1
    if (EN_WORDS.has(word)) en += 1
  }
  if (id > en) return 'id'
  if (en > id) return 'en'
  return /[a-z]/i.test(text) ? 'en' : 'id'
}

function score(text, patterns) {
  let total = 0
  for (const [pattern, weight] of patterns) {
    if (pattern.test(text)) total += weight
  }
  return total
}

export function detectDiagramType(requirement, structuredSpecification = null, requestedType = 'auto') {
  const explicitType = normalizeType(requestedType)
  if (explicitType && explicitType !== 'uml' && explicitType !== 'auto') {
    return { type: explicitType, confidence: 1, reason: `Explicit diagram_type "${requestedType}".` }
  }
  const specType = normalizeType(structuredSpecification?.diagram_type ?? structuredSpecification?.type)
  if (specType && specType !== 'uml') {
    return { type: specType, confidence: 1, reason: 'Structured specification declares the diagram type.' }
  }
  if (specType === 'uml' || explicitType === 'uml' || structuredSpecification?.uml_type) {
    const subtype = normalizeType(structuredSpecification?.uml_type)
    if (subtype && subtype.startsWith('uml_')) {
      return { type: subtype, confidence: 0.95, reason: 'UML subtype declared in the specification.' }
    }
  }

  const text = String(requirement ?? '').toLowerCase()
  const scores = {
    erd: score(text, [
      [/\berd\b/, 6], [/\bentity[ -]?relationship\b/, 6], [/\bprimary key\b|\bforeign key\b/, 4],
      [/\bpk\b|\bfk\b/, 3], [/\btabel\b|\btable\b/, 3], [/\bentitas\b|\bentity\b|\bentities\b/, 2],
      [/\brelasi\b|\brelationship\b|\bcardinality\b|\bkardinalitas\b/, 2], [/\bnormalisasi\b/, 1],
    ]),
    flowchart: score(text, [
      [/\bflow[ -]?chart\b/, 6], [/\bdiagram alur\b|\balur proses\b|\bworkflow\b/, 5],
      [/\bdecision\b|\bkeputusan\b|\bpercabangan\b/, 3], [/\bapproval\b|\bpersetujuan\b|\bpenolakan\b/, 2],
      [/\bloop\b|\bperulangan\b|\bretry\b/, 2], [/\blangkah\b|\bsteps?\b/, 2],
    ]),
    sequence: score(text, [
      [/\bsequence\b/, 7], [/\bsequence diagram\b/, 9], [/\blifeline\b|\bactivation bar\b/, 4],
      [/\bmessage\b|\bpesan\b/, 2], [/\binteraction\b|\binteraksi\b/, 2], [/\balt\b|\bopt\b|\bpar\b/, 1],
    ]),
    uml_class: score(text, [
      [/\bclass diagram\b/, 8], [/\buml class\b/, 8], [/\bclass\b|\bkelas\b/, 3],
      [/\battribute\b|\batribut\b/, 2], [/\bmethod\b|\bmetode\b|\boperation\b/, 2],
      [/\binheritance\b|\bpewarisan\b|\bextends\b/, 2],
    ]),
    uml_usecase: score(text, [
      [/\buse[ -]?case\b/, 8], [/\baktor\b|\bactor\b/, 3], [/\binclude\b|\bextend\b/, 2],
    ]),
    uml_activity: score(text, [
      [/\bactivity diagram\b|\bactivity\b/, 7], [/\baktivitas\b/, 4], [/\bfork\b|\bjoin\b/, 3],
      [/\bswimlane\b|\bpartition\b/, 2],
    ]),
    uml_state: score(text, [
      [/\bstate[ -]?machine\b|\bstate diagram\b|\bstatechart\b/, 8], [/\bstatus\b|\bstate\b/, 3],
      [/\btransisi\b|\btransition\b/, 2], [/\bguard\b/, 1],
    ]),
    architecture: score(text, [
      [/\barsektur\b|\barchitecture\b/, 7], [/\bmicroservice\b|\bmikroservis\b/, 4],
      [/\bapi gateway\b|\bgateway\b/, 3], [/\bkomponen\b|\bcomponent\b/, 3],
      [/\bclient\b|\bfrontend\b|\bbackend\b|\bdatabase\b|\bcache\b|\bqueue\b|\bbroker\b/, 2],
      [/\bboundary\b|\bbatas sistem\b/, 2],
    ]),
  }
  // "database" is common inside architecture descriptions; the word alone
  // should not overpower an explicit architecture signal.
  if (scores.architecture >= 4) scores.erd = Math.min(scores.erd, 3)
  if (scores.uml_usecase >= 6) scores.uml_activity = Math.min(scores.uml_activity, 3)

  let best = null
  for (const [type, value] of Object.entries(scores)) {
    if (value > 0 && (!best || value > best.score)) best = { type, score: value }
  }
  if (!best) {
    if (structuredSpecification && typeof structuredSpecification === 'object') {
      const inferred = inferTypeFromSpecification(structuredSpecification)
      if (inferred) return { type: inferred, confidence: 0.7, reason: 'Inferred from structured specification fields.' }
    }
    return { type: null, confidence: 0, reason: 'No diagram-family signal was found.' }
  }
  return {
    type: best.type,
    confidence: Math.min(1, best.score / 10),
    reason: `Matched ${best.type} vocabulary (score ${best.score}).`,
  }
}

function inferTypeFromSpecification(specification) {
  if (Array.isArray(specification.entities) || Array.isArray(specification.relationships)) return 'erd'
  if (Array.isArray(specification.participants) || Array.isArray(specification.messages)) return 'sequence'
  if (Array.isArray(specification.components) || Array.isArray(specification.connections)) return 'architecture'
  if (Array.isArray(specification.actors) || Array.isArray(specification.use_cases)) return 'uml_usecase'
  if (Array.isArray(specification.classes)) return 'uml_class'
  if (Array.isArray(specification.states)) return 'uml_state'
  if (Array.isArray(specification.steps)) return 'flowchart'
  return null
}

export function extractTitle(requirement, structuredSpecification, fallback = 'Untitled Diagram') {
  const explicit = structuredSpecification?.title ?? requirement?.match(/(?:^|\n)\s*(?:judul|title)\s*[:=]\s*(.+)$/im)?.[1]
  if (explicit) return oneLine(explicit, 100)
  const text = oneLine(requirement, 800)
  if (!text) return fallback
  const forMatch = text.match(/\b(?:untuk|for)\s+(?:sebuah\s+|a\s+|an\s+|the\s+)?((?:sistem|system|aplikasi|application|proses|process|platform)\b[^.;\n]{0,80})/i)
  if (forMatch) {
    return titleCase(forMatch[1]
      .replace(/\b(?:dengan|with|yang|that|dan|and)\b.*$/i, '')
      .trim())
  }
  const heading = text.match(/^\s*(?:(?:buatkan|buat|generate|create|build|draw|gambarkan)\s+)?(?:diagram\s+)?(?:erd|entity relationship(?: diagram)?|flow ?chart|sequence(?: diagram)?|class(?: diagram)?|use ?case(?: diagram)?|activity(?: diagram)?|state(?: machine| diagram)?|arsitektur|architecture)\s+([^:.;\n]{2,60}):/i)
  if (heading) {
    const value = heading[1].replace(/^(?:diagram|sebuah|a|an|the)\s+/i, '').trim()
    if (value && !/^(?:diagram|chart|class|sequence|flow ?chart|use ?case)(?: diagram)?$/i.test(value)) return titleCase(value)
  }
  return fallback
}
