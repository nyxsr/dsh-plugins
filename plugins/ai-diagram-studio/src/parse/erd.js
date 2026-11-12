/** Rule-based ERD extraction from Indonesian or English prose. */
import { DiagramError } from '../core/errors.js'
import { oneLine } from '../core/text.js'
import { cleanName, IRBuilder, singular, splitTopLevel } from './common.js'
import { diagrams } from './templates.js'

const SQL_TYPES = /^(?:int|integer|bigint|smallint|serial|bigserial|varchar|char|text|string|uuid|boolean|bool|date|datetime|timestamp|timestamptz|time|decimal|numeric|float|double|real|json|jsonb|blob|bytea|enum|money|inet|cidr|xml)(?:\s*\([^)]*\))?/i

function parseAttribute(raw, entityName) {
  const text = oneLine(raw, 220)
  if (!text) return null
  const match = text.match(/^[\s`"'[]*([A-Za-z_][A-Za-z0-9_]*)[\s`"'\]]*(.*)$/)
  if (!match) return null
  const name = match[1]
  let rest = match[2].trim()
  let type = ''
  const typeMatch = rest.match(SQL_TYPES)
  if (typeMatch) {
    type = oneLine(typeMatch[0], 80)
    rest = rest.slice(typeMatch[0].length).trim()
  }
  const lower = rest.toLowerCase()
  const referenceMatch = rest.match(/(?:references?|ref|->|→)\s*([A-Za-z_][A-Za-z0-9_]*)(?:\s*(?:\.|\(|::)\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)?)?/i)
  return {
    name,
    type,
    primary_key: /\b(?:pk|primary[\s_-]*key)\b/.test(lower),
    foreign_key: /\b(?:fk|foreign[\s_-]*key)\b/.test(lower) || Boolean(referenceMatch),
    unique: /\bunique\b/.test(lower),
    nullable: !/\b(?:not[\s_-]*null|required|wajib)\b/.test(lower),
    references: referenceMatch
      ? {
          entity_id: referenceMatch[1],
          attribute_id: null,
          attribute_name: referenceMatch[2] ?? null,
        }
      : null,
    notes: '',
    __typeExplicit: true,
    __source: text,
  }
}

function extractBlocks(text) {
  const blocks = []
  const patterns = [
    /(?:tabel|table|entitas|entity)\s+[`"']?([A-Za-z_][A-Za-z0-9_]*)[`"']?\s*\(([^)]*)\)/gi,
    /(?:^|[\n;,.]\s*(?:(?:dan|and|serta)\s+)?)[`"']?([A-Za-z_][A-Za-z0-9_]*)[`"']?\s*\(([^()]*(?:PK|FK|primary[\s_-]*key|foreign[\s_-]*key|references)[^()]*)\)/gi,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text))) {
      const name = cleanName(match[1])
      const attributes = splitTopLevel(match[2], ',').map(part => parseAttribute(part, name)).filter(Boolean)
      if (!name || !attributes.length) continue
      if (!blocks.some(block => block.name.toLowerCase() === name.toLowerCase())) {
        blocks.push({ name, attributes, raw: match[2].trim() })
      }
    }
  }
  return blocks
}

function splitList(value) {
  return splitTopLevel(value, ',')
    .flatMap(part => part.split(/\s+(?:dan|and|serta)\s+/i))
    .map(part => cleanName(part).replace(/^(?:dan|and|serta)\s+/i, ''))
    .filter(Boolean)
}

function extractEntityNames(text, blocks) {
  const names = []
  const push = name => {
    const cleaned = cleanName(name)
    if (!cleaned || cleaned.length > 42) return
    if (cleaned.split(/\s+/).length > 3) return
    if (/^(?:relasi|relationship|primary|foreign|key|pk|fk|atribut|attribute|kolom|column|data|type|tipe|pdf|png|svg|erd|diagram|sistem|system|tabel|table|entitas|entity)\b/i.test(cleaned)) return
    if (/\b(?:yang|dengan|untuk|dari|pada|agar|jika|maka|secara|benar|lain|lainnya)\b/i.test(cleaned)) return
    if (!names.some(existing => existing.toLowerCase() === cleaned.toLowerCase())) names.push(cleaned)
  }
  for (const block of blocks) push(block.name)

  const listPatterns = [
    /(?:memiliki|mempunyai|has|have|terdiri\s+dari|consists?\s+of|includes?|with\s+(?:the\s+)?(?:following\s+)?(?:tables?|entities))\s*:?\s*([^.;\n]+)/gi,
    /(?:entitas|entities|tables?)\s*[:=]\s*([^.;\n]+)/gi,
    /(?:sistem|system|aplikasi|application)\s+(?:manajemen|management)?\s*[^.;\n]*?\b(?:dengan|with)\s+([^.;\n]+)/gi,
    /\b(?:dengan|with)\s+([A-Za-z_][\w-]*(?:\s*,\s*[A-Za-z_][\w-]*)+)/gi,
  ]
  for (const pattern of listPatterns) {
    let match
    while ((match = pattern.exec(text))) {
      for (const part of splitList(match[1])) {
        if (/\((?:[^)]*)$/.test(part)) continue
        push(part)
      }
    }
  }
  return names
}

function parseRelationshipSentences(text, builder) {
  const added = new Set()
  const add = (sourceName, targetName, sourceCard, targetCard, label = '') => {
    const source = builder.resolve(sourceName)
    const target = builder.resolve(targetName)
    if (!source || !target || source === target) return
    const key = `${source}|${target}|${sourceCard}|${targetCard}`
    if (added.has(key)) return
    added.add(key)
    builder.addEdge({
      kind: 'relationship',
      source,
      target,
      label: oneLine(label, 80),
      source_cardinality: sourceCard,
      target_cardinality: targetCard,
    })
  }
  const patterns = [
    { re: /([A-Za-z_][A-Za-z0-9_]*)\s+(?:has|have|owns|contains|memiliki|mempunyai|berisi)\s+(many|banyak|several|beberapa|one|satu|a|an)?\s*([A-Za-z_][A-Za-z0-9_]*)/gi, kind: 'has' },
    { re: /([A-Za-z_][A-Za-z0-9_]*)\s+(?:belongs\s+to|is\s+owned\s+by|milik|dimiliki\s+oleh|merujuk\s+ke)\s+([A-Za-z_][A-Za-z0-9_]*)/gi, kind: 'belongs' },
    { re: /([A-Za-z_][A-Za-z0-9_]*)\s*(?:1|one)\s*(?:-|to|:)\s*(?:many|n|\*)\s*([A-Za-z_][A-Za-z0-9_]*)/gi, kind: 'one-many' },
    { re: /([A-Za-z_][A-Za-z0-9_]*)\s*(?:many|n|\*)\s*(?:-|to|:)\s*(?:many|n|\*)\s*([A-Za-z_][A-Za-z0-9_]*)/gi, kind: 'many-many' },
    { re: /([A-Za-z_][A-Za-z0-9_]*)\s*(?:<-|←|--|<)\s*([A-Za-z_][A-Za-z0-9_]*)/g, kind: 'arrow-left' },
    { re: /([A-Za-z_][A-Za-z0-9_]*)\s*(?:->|→|⇒)\s*([A-Za-z_][A-Za-z0-9_]*)/g, kind: 'arrow' },
  ]
  for (const { re, kind } of patterns) {
    let match
    while ((match = re.exec(text))) {
      if (kind === 'has') {
        const count = String(match[2] ?? '').toLowerCase()
        const many = ['many', 'banyak', 'several', 'beberapa'].includes(count)
        add(match[1], match[3], 'one', many ? 'many' : 'one')
      } else if (kind === 'belongs') {
        add(match[1], match[2], 'many', 'one')
      } else if (kind === 'one-many') {
        add(match[1], match[2], 'one', 'many')
      } else if (kind === 'many-many') {
        add(match[1], match[2], 'many', 'many')
      } else if (kind === 'arrow-left') {
        add(match[2], match[1], 'one', 'many')
      } else {
        add(match[1], match[2], 'one', 'many')
      }
    }
  }
  const pair = text.match(/(?:relasi|relationship|kardinalitas|cardinality)\s*(?:antara|between)?\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:dan|and)\s*([A-Za-z_][A-Za-z0-9_]*)/i)
  if (pair) {
    const source = builder.resolve(pair[1])
    const target = builder.resolve(pair[2])
    if (source && target) add(pair[1], pair[2], 'one', 'many')
  }
}

function inferReferencedEntity(builder, attributeName) {
  const base = attributeName
    .replace(/_(?:id|fk|ref)$/i, '')
    .replace(/^(?:id|fk)_/i, '')
  if (!base || base === attributeName) return null
  return builder.resolve(base) ?? builder.resolve(`${base}s`) ?? null
}

function addSyntheticForeignKey(builder, holderId, referencedId, holderName, referencedName, unique = false) {
  const holder = builder.ir.nodes.find(node => node.id === holderId)
  if (!holder) return
  const referenced = builder.ir.nodes.find(node => node.id === referencedId)
  if (!referenced) return
  const base = referencedName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
  const name = `${singular(base)}_id`
  if (holder.attributes.some(attribute => attribute.name.toLowerCase() === name)) return
  holder.attributes.push({
    name,
    type: '',
    primary_key: false,
    foreign_key: true,
    unique,
    nullable: false,
    references: { entity_id: referencedId, attribute_id: null, attribute_name: null },
  })
  builder.assume(`Foreign key "${holderName}.${name}" was added to make the inferred relationship visible.`)
}

export function parseERD({ requirement, title, language, theme, orientation, density }) {
  const text = String(requirement ?? '')
  const builder = new IRBuilder({ diagramType: 'erd', title, language, requirement })
  const blocks = extractBlocks(text)
  const names = extractEntityNames(text, blocks)
  const synthetic = new Set()

  for (const name of names) {
    if (!name) continue
    const block = blocks.find(item => item.name.toLowerCase() === name.toLowerCase())
    const attributes = block ? block.attributes.map(({ __typeExplicit, __source, ...attribute }) => attribute) : []
    const node = builder.addNode({
      kind: 'entity',
      name,
      label: name,
      attributes,
    })
    if (node && !block) synthetic.add(node.id)
  }

  // An ERD request with no discoverable element is genuinely ambiguous.
  if (!builder.ir.nodes.length) {
    builder.clarify('No entities or tables were found. List the entities or provide table definitions with attributes.')
    return builder.finish({ theme, orientation, density })
  }

  // Conventional surrogate keys are disclosed, never silently fabricated.
  for (const node of builder.ir.nodes) {
    if (node.attributes.length) {
      if (!node.attributes.some(attribute => attribute.primary_key)) {
        const idAttribute = node.attributes.find(attribute => attribute.name.toLowerCase() === 'id')
        if (idAttribute) {
          idAttribute.primary_key = true
          idAttribute.nullable = false
          builder.assume(`"${node.name}.id" was treated as the primary key because it is the conventional identifier.`)
        }
      }
      continue
    }
    node.attributes.push({
      name: 'id',
      type: '',
      primary_key: true,
      foreign_key: false,
      unique: true,
      nullable: false,
      references: null,
    })
    builder.assume(`Entity "${node.name}" had no declared attributes; a conventional surrogate "id" primary key was added for display.`)
  }

  // Mark associative entities before relationship creation so their shape can
  // be rendered differently.
  for (const node of builder.ir.nodes) {
    const fkCount = node.attributes.filter(attribute => attribute.foreign_key || attribute.references).length
    if (fkCount >= 2 && /(?:^|[_\s])(?:item|items|detail|details|line|lines|junction|mapping|pivot|link)(?:$|[_\s])/i.test(node.name)) {
      node.kind = 'associative_entity'
    }
  }

  parseRelationshipSentences(text, builder)

  // Resolve explicit and name-inferred foreign keys.
  for (const node of builder.ir.nodes) {
    for (const attribute of node.attributes) {
      if (!attribute.foreign_key && !attribute.references) continue
      const explicitReference = Boolean(attribute.references?.entity_id)
      let targetId = attribute.references?.entity_id ? builder.resolve(attribute.references.entity_id) : null
      if (!targetId) targetId = inferReferencedEntity(builder, attribute.name)
      if (targetId && targetId !== node.id) {
        const target = builder.ir.nodes.find(candidate => candidate.id === targetId)
        const referencedName = attribute.references?.attribute_name ?? null
        attribute.references = {
          entity_id: targetId,
          attribute_id: null,
          attribute_name: referencedName,
        }
        attribute.foreign_key = true
        if (!attribute.references.entity_id) attribute.references.entity_id = targetId
        if (!explicitReference) {
          builder.assume(`Foreign key "${node.name}.${attribute.name}" was inferred to reference "${target?.name ?? targetId}".`)
        }
        const existing = builder.ir.edges.find(edge => edge.source === node.id && edge.target === targetId)
        if (!existing) {
          builder.addEdge({
            kind: 'relationship',
            source: node.id,
            target: targetId,
            label: '',
            source_cardinality: attribute.unique ? 'one' : 'many',
            target_cardinality: 'one',
            source_optional: attribute.nullable,
          })
        } else if (attribute.unique) {
          existing.target_cardinality = 'one'
        }
      }
    }
  }

  // If the model has no relationship evidence, use a documented domain
  // template only for well-known entity sets. Unknown domains stay untouched.
  if (!builder.ir.edges.length && builder.ir.nodes.length > 1) {
    const template = diagrams.find(item => item.matches(builder))
    if (template) {
      const resolveAny = value => (Array.isArray(value) ? value : [value]).map(candidate => builder.resolve(candidate)).find(Boolean) ?? null
      for (const relation of template.relations) {
        const source = resolveAny(relation.source)
        const target = resolveAny(relation.target)
        if (!source || !target) continue
        builder.addEdge({
          kind: 'relationship',
          source,
          target,
          label: relation.label ?? '',
          source_cardinality: relation.sourceCardinality,
          target_cardinality: relation.targetCardinality,
        })
        if (relation.foreignKey && synthetic.has(target)) {
          addSyntheticForeignKey(builder, target, source,
            builder.ir.nodes.find(node => node.id === target)?.name ?? 'child',
            builder.ir.nodes.find(node => node.id === source)?.name ?? 'parent',
            Boolean(relation.unique))
        }
      }
      builder.assume(template.assumption)
    }
  }

  const relationWords = /\b(?:relasi|relationship|hubungkan|connect|one-to-many|many-to-many|memiliki|has|belongs)\b/i.test(text)
  if (builder.ir.nodes.length > 1 && !builder.ir.edges.length && relationWords) {
    builder.clarify('The relationship rules are ambiguous. State which entity relates to which, and the cardinality.')
  }
  if (/\b(?:jangan|do\s+not|tanpa|without)\b[^.;\n]{0,40}\b(?:tabel|table|entitas|entity)\b/i.test(text)) {
    builder.ir.constraints.no_additional_entities = true
  }
  if (/\b(?:jangan|do\s+not)\b[^.;\n]{0,40}\b(?:relasi|relationship)\b/i.test(text)) {
    builder.ir.constraints.no_additional_relationships = true
  }
  return builder.finish({ theme, orientation, density })
}
