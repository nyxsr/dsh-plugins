import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createStudio } from '../src/api/studio.js'

export const OK = new Set(['SUCCESS', 'SUCCESS_WITH_WARNINGS'])

export async function makeStudio(label = 'test') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `ai-diagram-${label}-`))
  const studio = createStudio({ workspaceRoot: root, storeRoot: '.diagram-store' })
  await studio.init()
  return {
    root,
    studio,
    cleanup: () => fs.rm(root, { recursive: true, force: true }),
  }
}

export function assertResult(test, result, { allowWarnings = true } = {}) {
  assert.ok(result && typeof result === 'object', 'result is an object')
  if (result.status === 'FAILED') {
    assert.fail(`unexpected FAILED: ${JSON.stringify(result.errors)}`)
  }
  assert.ok(allowWarnings ? OK.has(result.status) : result.status === 'SUCCESS', `unexpected status ${result.status}`)
}

export function strictShopSpec() {
  return {
    diagram_type: 'erd',
    title: 'Shop ERD',
    entities: [
      { name: 'users', attributes: [
        { name: 'id', type: 'INTEGER', primary_key: true },
        { name: 'email', type: 'TEXT', unique: true },
      ] },
      { name: 'orders', attributes: [
        { name: 'id', type: 'INTEGER', primary_key: true },
        { name: 'user_id', type: 'INTEGER', references: { entity: 'users', column: 'id' } },
      ] },
      { name: 'products', attributes: [
        { name: 'id', type: 'INTEGER', primary_key: true },
        { name: 'name', type: 'TEXT' },
        { name: 'price', type: 'DECIMAL' },
      ] },
      { name: 'order_items', attributes: [
        { name: 'id', type: 'INTEGER', primary_key: true },
        { name: 'order_id', type: 'INTEGER', references: { entity: 'orders', column: 'id' } },
        { name: 'product_id', type: 'INTEGER', references: { entity: 'products', column: 'id' } },
      ] },
    ],
    relationships: [
      { source: 'orders', target: 'users', source_cardinality: 'many', target_cardinality: 'one' },
      { source: 'order_items', target: 'orders', source_cardinality: 'many', target_cardinality: 'one' },
      { source: 'order_items', target: 'products', source_cardinality: 'many', target_cardinality: 'one' },
    ],
  }
}

export function sequenceSpec() {
  return {
    diagram_type: 'sequence',
    title: 'Checkout',
    participants: [
      { name: 'User', kind: 'actor' },
      { name: 'Web' },
      { name: 'API' },
      { name: 'DB', kind: 'database' },
    ],
    messages: [
      { from: 'User', to: 'Web', text: 'buka checkout' },
      { from: 'Web', to: 'API', text: 'POST /orders' },
      { from: 'API', to: 'DB', text: 'insert order' },
      { from: 'DB', to: 'API', text: 'order id', kind: 'return' },
    ],
    frames: [{ kind: 'alt', label: 'pembayaran gagal', message_ids: [1, 2, 3] }],
  }
}

export function architectureSpec() {
  return {
    diagram_type: 'architecture',
    title: 'Ecommerce',
    components: [
      { name: 'Client', kind: 'client' },
      { name: 'API Gateway', kind: 'gateway' },
      { name: 'Order Service', kind: 'service' },
      { name: 'PostgreSQL', kind: 'database' },
      { name: 'RabbitMQ', kind: 'queue' },
      { name: 'Email Worker', kind: 'worker' },
    ],
    groups: [
      { id: 'frontend', label: 'Frontend', node_ids: ['Client'] },
      { id: 'backend', label: 'Backend', node_ids: ['API Gateway', 'Order Service', 'Email Worker'] },
      { id: 'data', label: 'Data', node_ids: ['PostgreSQL', 'RabbitMQ'] },
    ],
    connections: [
      { from: 'Client', to: 'API Gateway', label: 'HTTPS' },
      { from: 'Order Service', to: 'PostgreSQL', label: 'SQL' },
      { from: 'Order Service', to: 'RabbitMQ', label: 'AMQP' },
      { from: 'RabbitMQ', to: 'Email Worker', label: 'consume' },
    ],
  }
}
