import test from 'node:test'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { assertResult, makeStudio, strictShopSpec, sequenceSpec, architectureSpec } from './helpers.js'
import { detectLanguage } from '../src/parse/detect.js'
import { emptyIR, normalizeIR } from '../src/ir/index.js'
import { validateDiagram } from '../src/validate/semantic.js'
import { layoutDiagram } from '../src/layout/index.js'
import { refineLayout } from '../src/quality/refine.js'

test('1. ERD from natural-language Indonesian requirements', async t => {
  const { studio, cleanup } = await makeStudio('erd-nl')
  t.after(cleanup)
  const result = await studio.generate({
    requirement: 'Buatkan ERD untuk sistem manajemen perpustakaan yang memiliki anggota, buku, peminjaman, pengembalian, dan denda. Buat relasinya secara benar, tampilkan PK dan FK, lalu ekspor ke SVG.',
    diagram_type: 'auto',
    output_formats: ['svg'],
  })
  assertResult(t, result)
  assert.equal(result.diagram_type, 'erd')
  assert.ok(result.diagram.node_count >= 5)
  assert.ok(result.diagram.edge_count >= 4)
  assert.equal(result.validation.semantic, 'PASSED')
})

test('2. ERD from strict entity definitions preserves the supplied tables', async t => {
  const { studio, cleanup } = await makeStudio('erd-strict')
  t.after(cleanup)
  const result = await studio.generate({ structured_specification: strictShopSpec(), output_formats: ['svg'] })
  assertResult(t, result)
  assert.equal(result.diagram.node_count, 4)
  assert.equal(result.diagram.edge_count, 3)
  assert.equal(result.validation.semantic, 'PASSED')
  const stored = await studio.store.load(result.diagram_id)
  assert.deepEqual(stored.nodes.map(n => n.name).sort(), ['order_items', 'orders', 'products', 'users'])
})

test('3. Invalid foreign-key target is detected before rendering', () => {
  const ir = normalizeIR({
    ...emptyIR({ diagramType: 'erd', title: 'Invalid FK' }),
    nodes: [
      { id: 'n-customers', kind: 'entity', name: 'customers', attributes: [{ name: 'email', type: 'TEXT' }] },
      { id: 'n-orders', kind: 'entity', name: 'orders', attributes: [
        { name: 'id', type: 'INTEGER', primary_key: true },
        { name: 'customer_email', type: 'TEXT', foreign_key: true, references: { entity_id: 'n-customers', attribute_name: 'email' } },
      ] },
    ],
    edges: [{ id: 'e-orders-customers', source: 'n-orders', target: 'n-customers', kind: 'relationship', source_cardinality: 'many', target_cardinality: 'one' }],
  })
  const result = validateDiagram(ir)
  assert.equal(result.status, 'FAILED')
  assert.ok(result.errors.some(error => ['erd_fk_not_unique', 'erd_fk_target_missing', 'erd_fk_not_primary'].includes(error.code)))
})

test('4. Cardinality consistency is preserved from the FK holder to the parent', () => {
  const ir = normalizeIR({
    ...emptyIR({ diagramType: 'erd', title: 'Cardinality' }),
    nodes: [
      { id: 'n-users', kind: 'entity', name: 'users', attributes: [{ name: 'id', type: 'INTEGER', primary_key: true }] },
      { id: 'n-orders', kind: 'entity', name: 'orders', attributes: [
        { name: 'id', type: 'INTEGER', primary_key: true },
        { name: 'user_id', type: 'INTEGER', foreign_key: true, references: { entity_id: 'n-users', attribute_name: 'id' } },
      ] },
    ],
    edges: [{ id: 'e-orders-users', source: 'n-orders', target: 'n-users', kind: 'relationship', source_cardinality: 'many', target_cardinality: 'one', source_optional: true }],
  })
  const result = validateDiagram(ir)
  assert.equal(result.status, 'PASSED')
  assert.equal(result.errors.length, 0)
})

test('5. Flowchart with decisions, labelled branches, and a loop', async t => {
  const { studio, cleanup } = await makeStudio('flow')
  t.after(cleanup)
  const result = await studio.generate({
    requirement: 'Flowchart approval: Start -> Periksa berkas -> {Lengkap?} -> yes: Setujui -> End; no: Tolak -> Perbaiki -> Periksa berkas.',
    diagram_type: 'flowchart',
    language: 'id',
    output_formats: ['svg'],
  })
  assertResult(t, result)
  assert.equal(result.validation.semantic, 'PASSED')
  const ir = await studio.store.load(result.diagram_id)
  assert.ok(ir.nodes.some(n => n.kind === 'decision'))
  assert.ok(ir.edges.some(e => e.label === 'Ya'))
  assert.ok(ir.edges.some(e => e.label === 'Tidak'))
})

test('6. UML class diagram with inheritance, realization, and composition', async t => {
  const { studio, cleanup } = await makeStudio('class')
  t.after(cleanup)
  const result = await studio.generate({
    requirement: 'Class diagram: abstract class User { id: UUID; login(): Boolean } class Customer extends User { email: String } class Order { id: UUID; pay(): Boolean } class OrderItem { quantity: Integer } interface Payable { pay(): Boolean } Customer ..|> Payable. Order *-- "1..*" OrderItem.',
    diagram_type: 'uml_class',
    output_formats: ['svg'],
  })
  assertResult(t, result)
  const ir = await studio.store.load(result.diagram_id)
  assert.ok(ir.nodes.some(n => n.kind === 'interface'))
  assert.ok(ir.edges.some(e => e.kind === 'inheritance'))
  assert.ok(ir.edges.some(e => e.kind === 'realization'))
  assert.ok(ir.edges.some(e => e.kind === 'composition'))
  const svg = await fs.readFile(result.artifacts[0].path, 'utf8')
  assert.match(svg, /marker-start="url\(#diamond-filled\)"/)
})

test('7. UML state machine has one initial and one final pseudostate', async t => {
  const { studio, cleanup } = await makeStudio('state')
  t.after(cleanup)
  const result = await studio.generate({
    requirement: 'State machine Order: [*] -> Draft. Draft -> Submitted [submit]. Submitted -> Approved [approve] / sendEmail. Submitted -> Rejected [reject]. Approved -> [*]. Rejected -> [*].',
    diagram_type: 'uml_state',
    output_formats: ['svg'],
  })
  assertResult(t, result)
  const ir = await studio.store.load(result.diagram_id)
  assert.equal(ir.nodes.filter(n => n.kind === 'initial').length, 1)
  assert.equal(ir.nodes.filter(n => n.kind === 'final').length, 1)
})

test('8. Sequence diagram with alternative frame and ordered messages', async t => {
  const { studio, cleanup } = await makeStudio('sequence')
  t.after(cleanup)
  const result = await studio.generate({ structured_specification: sequenceSpec(), output_formats: ['svg'] })
  assertResult(t, result)
  const ir = await studio.store.load(result.diagram_id)
  assert.equal(ir.nodes.length, 4)
  assert.equal(ir.edges.length, 4)
  assert.equal(ir.frames.length, 1)
  assert.deepEqual(ir.edges.map(e => e.order), [1, 2, 3, 4])
})

test('9. Architecture diagram with grouped components and clean boundaries', async t => {
  const { studio, cleanup } = await makeStudio('architecture')
  t.after(cleanup)
  const result = await studio.generate({ structured_specification: architectureSpec(), output_formats: ['svg'] })
  assertResult(t, result)
  const ir = await studio.store.load(result.diagram_id)
  assert.equal(ir.groups.length, 3)
  assert.ok(ir.groups.every(group => group.node_ids.length > 0))
  const layoutGroups = ir.layout.groups
  for (let i = 0; i < layoutGroups.length; i++) {
    for (let j = i + 1; j < layoutGroups.length; j++) {
      const a = layoutGroups[i]
      const b = layoutGroups[j]
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
      assert.equal(overlap, false, `group ${a.label} overlaps ${b.label}`)
    }
  }
})

test('10. Indonesian request language detection', () => {
  assert.equal(detectLanguage('Buatkan diagram alur untuk proses pengajuan cuti dengan persetujuan atasan.'), 'id')
})

test('11. English request language detection', () => {
  assert.equal(detectLanguage('Create a sequence diagram for the checkout flow with a payment service.'), 'en')
})

test('18. Large diagram is bounded and rendered', async t => {
  const { studio, cleanup } = await makeStudio('large')
  t.after(cleanup)
  const components = Array.from({ length: 30 }, (_, index) => ({ name: `Service ${index + 1}`, kind: 'service' }))
  const connections = components.slice(0, -1).map((component, index) => ({ from: component.name, to: components[index + 1].name }))
  const result = await studio.generate({
    structured_specification: { diagram_type: 'architecture', title: 'Large Service Map', components, connections },
    output_formats: ['svg'],
  })
  assertResult(t, result)
  assert.equal(result.diagram.node_count, 30)
})

test('19. Automatic layout refinement is bounded and semantic-preserving', () => {
  const ir = normalizeIR({
    ...emptyIR({ diagramType: 'erd', title: 'Refine' }),
    nodes: [
      { id: 'n-a', kind: 'entity', name: 'a', attributes: [{ name: 'id', type: 'INTEGER', primary_key: true }] },
      { id: 'n-b', kind: 'entity', name: 'b', attributes: [{ name: 'id', type: 'INTEGER', primary_key: true }] },
    ],
    edges: [{ id: 'e-a-b', source: 'n-a', target: 'n-b', kind: 'relationship' }],
  })
  const laidOut = layoutDiagram(ir)
  const refined = refineLayout(laidOut, { maxAttempts: 3 })
  assert.ok(refined.attempts.length <= 3)
  assert.equal(refined.semanticPreserved, true)
  const before = JSON.stringify({ nodes: laidOut.nodes, edges: laidOut.edges })
  const after = JSON.stringify({ nodes: refined.ir.nodes, edges: refined.ir.edges })
  assert.equal(after, before)
})

test('22. Refinement preserves the semantic IR fingerprint exactly', () => {
  const ir = normalizeIR({
    ...emptyIR({ diagramType: 'flowchart', title: 'Semantic Guard' }),
    nodes: [
      { id: 'n-s', kind: 'start', name: 'Start' },
      { id: 'n-p', kind: 'process', name: 'Process' },
      { id: 'n-e', kind: 'end', name: 'End' },
    ],
    edges: [
      { id: 'e1', source: 'n-s', target: 'n-p', kind: 'flow' },
      { id: 'e2', source: 'n-p', target: 'n-e', kind: 'flow' },
    ],
  })
  const before = JSON.stringify({ nodes: ir.nodes, edges: ir.edges, groups: ir.groups, frames: ir.frames })
  const refined = refineLayout(layoutDiagram(ir), { maxAttempts: 3, density: 'compact' })
  const after = JSON.stringify({ nodes: refined.ir.nodes, edges: refined.ir.edges, groups: refined.ir.groups, frames: refined.ir.frames })
  assert.equal(after, before)
  assert.equal(refined.semanticPreserved, true)
})
