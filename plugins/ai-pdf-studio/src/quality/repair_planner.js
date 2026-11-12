/**
 * Targeted repair planning and application.
 *
 * Repairs prefer reflow, table compaction, page breaks, and margin correction.
 * They never delete content and never shrink type indiscriminately. Each action
 * has a stable signature so the loop can reject oscillation.
 */
import { findBlock, findSection, forkDocument } from '../core/models.js'
import { StudioError } from '../core/errors.js'

const SEVERITY_RANK = { minor: 1, major: 2, critical: 3 }

function blockHeight(block) {
  switch (block.type) {
    case 'paragraph': return 22 + Math.ceil((block.text?.length ?? 0) / 85) * 14
    case 'table': return 48 + (block.rows?.length ?? 0) * 22
    case 'chart': return 250
    case 'diagram': return 240
    case 'image': return 290
    case 'kpi': return 120
    case 'list': return 20 + (block.items?.length ?? 0) * 18
    case 'timeline': return 20 + (block.items?.length ?? 0) * 34
    case 'quote': return 90
    case 'callout': return 80
    default: return 50
  }
}

function componentTarget(document, message) {
  if (!message.component_id) return null
  const block = findBlock(document, message.component_id)
  if (block) return { type: 'block', section: block.section, block: block.block }
  const section = findSection(document, message.component_id)
  if (section) return { type: 'section', section }
  return null
}

function action(action, target, extra = {}) {
  return { action, ...target, ...extra }
}

function signature(repair) {
  return JSON.stringify({
    action: repair.action,
    component_id: repair.component_id ?? repair.section_id ?? null,
    side: repair.side ?? null,
    delta_pt: repair.delta_pt ?? null,
  })
}

function ruleForMessage(document, message) {
  const target = componentTarget(document, message)
  const componentId = message.component_id
  const section = target?.section ?? null

  const breakBefore = (sectionId, component) => action('add_page_break_before', { section_id: sectionId, component_id: component })
  switch (message.issue_type) {
    case 'content_outside_page':
    case 'near_edge_text':
    case 'gate_no_critical_clipping':
    case 'gate_page_geometry':
      return [action('increase_margins', { side: 'left', delta_pt: 8 }), action('increase_margins', { side: 'right', delta_pt: 8 })]
    case 'word_collision':
    case 'gate_no_critical_collisions':
      return section ? [breakBefore(section.id, componentId)] : [action('split_section', { section_id: document.sections[0]?.id })]
    case 'unexpected_blank_page':
    case 'gate_no_unexpected_blank_pages':
      return [action('remove_redundant_pagebreak', { section_id: section?.id ?? null })]
    case 'overcrowded_page':
    case 'gate_content_complete':
      return section ? [action('split_section', { section_id: section.id })] : []
    case 'element_overflow':
    case 'gate_layout_audit': {
      if (target?.block?.type === 'table') return [action('compact_table', { component_id: target.block.id })]
      return section ? [breakBefore(section.id, componentId)] : []
    }
    case 'wide_table':
      return target?.block?.type === 'table' ? [action('compact_table', { component_id: target.block.id })] : []
    case 'missing_synthetic_disclosure':
    case 'missing_disclosure':
      return [action('add_synthetic_disclosure', {})]
    default:
      return []
  }
}

/**
 * @param {object} args
 * @param {object} args.document
 * @param {Array} args.messages
 * @param {object} args.inspection
 * @param {Array} [args.history]
 * @param {number} [args.iteration]
 */
export function planRepairs({ document, messages, inspection, history = [], iteration = 1 }) {
  const priorSignatures = new Set(history.map(entry => entry.signature))
  const priorTypes = new Set(history.map(entry => entry.action))
  const actions = []
  const skipped = []
  const seen = new Set()
  const ordered = [...messages]
    .filter(message => message.severity !== 'minor' || message.issue_type.includes('disclosure'))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
  for (const message of ordered) {
    const repairs = ruleForMessage(document, message)
    if (repairs.length === 0) {
      if (message.severity !== 'minor') skipped.push({ issue_type: message.issue_type, reason: 'Tidak ada perbaikan otomatis yang aman. Perlu input modul atau keputusan manusia.' })
      continue
    }
    for (const repair of repairs) {
      const sig = signature(repair)
      if (priorSignatures.has(sig) || seen.has(sig)) {
        skipped.push({ issue_type: message.issue_type, action: repair.action, reason: 'Sudah dicoba sebelumnya, jadi diulang lagi untuk mencegah osilasi.' })
        continue
      }
      if (repair.action === 'increase_margins' && priorTypes.has('increase_margins')) {
        skipped.push({ issue_type: message.issue_type, action: repair.action, reason: 'Perbaikan margin global sudah dicoba sekali.' })
        continue
      }
      if (repair.action === 'add_synthetic_disclosure' && !document.synthetic) {
        skipped.push({ issue_type: message.issue_type, action: repair.action, reason: 'Dokumen tidak ditandai sintetis.' })
        continue
      }
      seen.add(sig)
      actions.push(repair)
      if (actions.length >= 4) break
    }
    if (actions.length >= 4) break
  }
  return {
    iteration,
    max_actions: 4,
    actions,
    skipped,
    strategy: actions.some(repair => repair.action === 'add_page_break_before' || repair.action === 'split_section')
      ? 'reflow_before_shrinking'
      : 'targeted_geometry_correction',
    preserve_content: true,
  }
}

function insertPagebreakBefore(section, block) {
  if (!section) return false
  const index = section.blocks.findIndex(candidate => candidate.id === block.id)
  if (index <= 0) return false
  if (section.blocks[index - 1]?.type === 'pagebreak') return false
  section.blocks.splice(index, 0, { type: 'pagebreak', id: `${block.id}-repair-break` })
  return true
}

function splitSection(section) {
  if (!section) return false
  if (section.blocks.length < 2) return false
  let bestIndex = -1
  let bestHeight = 0
  for (let index = 1; index < section.blocks.length; index += 1) {
    const height = blockHeight(section.blocks[index])
    if (height > bestHeight) { bestHeight = height; bestIndex = index }
  }
  if (bestIndex < 0) return false
  if (section.blocks[bestIndex - 1]?.type === 'pagebreak') return false
  section.blocks.splice(bestIndex, 0, { type: 'pagebreak', id: `${section.id}-repair-split-${bestIndex}` })
  return true
}

function removeRedundantPagebreaks(document) {
  let removed = 0
  for (const section of document.sections) {
    const cleaned = []
    for (const block of section.blocks) {
      if (block.type === 'pagebreak' && (cleaned.length === 0 || cleaned.at(-1)?.type === 'pagebreak')) {
        removed += 1
        continue
      }
      cleaned.push(block)
    }
    section.blocks = cleaned
    section.component_ids = section.blocks.map(block => block.id)
  }
  // A leading break on the first rendered section creates a blank first page.
  const first = document.sections.find(section => section.divider || section.blocks.length)
  if (first && first.page_break_before) {
    first.page_break_before = false
    removed += 1
  }
  return removed > 0
}

/**
 * Apply a repair plan to a clone of the document.
 * @param {object} document
 * @param {Array} actions
 * @param {number} iteration
 */
export function applyRepairs(document, actions, iteration = 1) {
  const next = forkDocument(document)
  next.document_version = (document.document_version ?? 1) + 1
  next.layout.repair_hints = { ...(next.layout.repair_hints ?? {}) }
  const applied = []
  for (const repair of actions) {
    if (repair.action === 'increase_margins') {
      const side = repair.side
      const delta = repair.delta_pt ?? 4
      const page = next.page
      const maxSide = Math.min(page.width_pt, page.height_pt) * 0.22
      if ((side === 'left' || side === 'right') && page.margins[side] + delta <= maxSide) {
        page.margins[side] += delta
        applied.push({ ...repair, before: page.margins[side] - delta, after: page.margins[side] })
      }
    } else if (repair.action === 'compact_table') {
      const found = findBlock(next, repair.component_id)
      if (found?.block.type === 'table' && !found.block.compact) {
        found.block.compact = true
        next.layout.repair_hints[repair.component_id] = { ...(next.layout.repair_hints[repair.component_id] ?? {}), compact: true }
        applied.push(repair)
      }
    } else if (repair.action === 'add_page_break_before') {
      const section = repair.section_id ? findSection(next, repair.section_id) : null
      const found = repair.component_id ? findBlock(next, repair.component_id) : null
      if (found?.block && found.block.type !== 'pagebreak') {
        if (insertPagebreakBefore(found.section, found.block)) applied.push(repair)
      } else if (section && !section.page_break_before) {
        section.page_break_before = true
        applied.push(repair)
      }
    } else if (repair.action === 'split_section') {
      const section = repair.section_id ? findSection(next, repair.section_id) : null
      if (splitSection(section)) applied.push(repair)
    } else if (repair.action === 'remove_redundant_pagebreak') {
      if (removeRedundantPagebreaks(next)) applied.push(repair)
    } else if (repair.action === 'add_synthetic_disclosure') {
      if (next.synthetic) {
        const last = [...next.sections].reverse().find(section => !section.divider)
        const exists = next.sections.some(section => section.blocks.some(block =>
          block.type === 'callout' && /synthetic|sintetis|demonstration|demonstrasi/i.test(`${block.title ?? ''} ${block.text ?? ''}`)))
        if (last && !exists) {
          last.blocks.push({
            type: 'callout', id: `${last.id}-synthetic-disclosure`, tone: 'warning',
            title: next.language === 'id' ? 'Peringatan data sintetis' : 'Synthetic data notice',
            text: next.language === 'id'
              ? 'Dokumen ini adalah demonstrasi. Seluruh angka dan temuan bersifat sintetis dan tidak boleh dikutip sebagai fakta.'
              : 'Dokumen ini demonstrasi. Semua angka dan temuannya sintetis dan tidak boleh dikutip sebagai fakta.',
          })
          last.component_ids = last.blocks.map(block => block.id)
          applied.push(repair)
        }
      }
    }
  }
  if (applied.length === 0) {
    throw new StudioError('repair_noop', 'Perencana perbaikan tidak menghasilkan perubahan yang bisa dipakai.', {
      details: { requested: actions.length, iteration },
    })
  }
  return {
    document: next,
    applied,
    signature: applied.map(signature).join('|'),
    iteration,
    revision: next.document_version,
  }
}

export function measureRepairEffect(beforeInspection, beforeScore, afterInspection, afterScore) {
  const gatesBefore = Object.values(beforeInspection.gates).filter(Boolean).length
  const gatesAfter = Object.values(afterInspection.gates).filter(Boolean).length
  return {
    gate_delta: gatesAfter - gatesBefore,
    score_delta: Number((afterScore.score - beforeScore.score).toFixed(1)),
    critical_delta: afterInspection.errors.length - beforeInspection.errors.length,
    improved: gatesAfter > gatesBefore || afterScore.score > beforeScore.score + 0.4,
    regressed: gatesAfter < gatesBefore || afterScore.score < beforeScore.score - 0.4,
  }
}
