/**
 * Deterministic layout engine. It writes only to ir.layout and never changes
 * diagram semantics. Rerunning it replaces the previous layout.
 */
import { DIAGRAM_LABELS, cloneIR } from '../ir/index.js'
import { textWidth, wrapText } from '../core/text.js'
import { measureNode, resolveDensity } from './metrics.js'

const MARGIN = 64

function headerSubtitle(ir) {
  const label = DIAGRAM_LABELS[ir.diagram_type] ?? ir.diagram_type
  return String(ir.title ?? '').trim().toLowerCase() === label.toLowerCase() ? '' : label
}

function nodeOrderMap(nodes) {
  return new Map(nodes.map((node, index) => [node.id, index]))
}

/** Remove back edges before ranking so cycles do not inflate layer numbers. */
function acyclicEdges(nodes, edges) {
  const adjacency = new Map(nodes.map(node => [node.id, []]))
  for (const edge of edges) {
    if (edge.source === edge.target) continue
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue
    adjacency.get(edge.source).push(edge)
  }
  const color = new Map(nodes.map(node => [node.id, 0]))
  const kept = []
  const visit = start => {
    const stack = [{ id: start, index: 0 }]
    color.set(start, 1)
    while (stack.length) {
      const frame = stack.at(-1)
      const outgoing = adjacency.get(frame.id) ?? []
      if (frame.index >= outgoing.length) {
        color.set(frame.id, 2)
        stack.pop()
        continue
      }
      const edge = outgoing[frame.index]
      frame.index += 1
      const state = color.get(edge.target)
      if (state === 1) continue // back edge: keep for drawing, skip for ranking
      kept.push(edge)
      if (state === 0) {
        color.set(edge.target, 1)
        stack.push({ id: edge.target, index: 0 })
      }
    }
  }
  for (const node of nodes) if (color.get(node.id) === 0) visit(node.id)
  return kept
}

function computeRanks(nodes, edges) {
  const rank = new Map(nodes.map(node => [node.id, 0]))
  const rankingEdges = acyclicEdges(nodes, edges)
  const indegree = new Map(nodes.map(node => [node.id, 0]))
  const outgoing = new Map(nodes.map(node => [node.id, []]))
  for (const edge of rankingEdges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
    outgoing.get(edge.source)?.push(edge)
  }
  const queue = nodes.filter(node => (indegree.get(node.id) ?? 0) === 0).map(node => node.id)
  let cursor = 0
  while (cursor < queue.length) {
    const id = queue[cursor]
    cursor += 1
    for (const edge of outgoing.get(id) ?? []) {
      rank.set(edge.target, Math.max(rank.get(edge.target) ?? 0, (rank.get(id) ?? 0) + 1))
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) - 1)
      if ((indegree.get(edge.target) ?? 0) === 0) queue.push(edge.target)
    }
  }
  // Nodes left in cycles (possible after DFS filtering) keep a safe fallback.
  for (const node of nodes) {
    if ((indegree.get(node.id) ?? 0) > 0) {
      let value = 0
      for (const edge of edges) {
        if (edge.target === node.id && rank.has(edge.source) && !(indegree.get(edge.source) > 0)) {
          value = Math.max(value, (rank.get(edge.source) ?? 0) + 1)
        }
      }
      rank.set(node.id, value)
    }
  }
  return rank
}

function chooseDirection(ir, diagramType) {
  if (diagramType === 'sequence') return 'TB'
  const orientation = ir.style?.orientation ?? 'auto'
  if (orientation === 'landscape') return 'LR'
  if (orientation === 'portrait') return 'TB'
  return diagramType === 'erd' || diagramType === 'uml_usecase' ? 'LR' : 'TB'
}

function buildLayers(nodes, rank, order) {
  const map = new Map()
  for (const node of nodes) {
    const value = rank.get(node.id) ?? 0
    if (!map.has(value)) map.set(value, [])
    map.get(value).push(node)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, layer]) => layer.sort((a, b) => order.get(a.id) - order.get(b.id)))
}

function groupLayouts(groups, nodeById, pad, topLimit) {
  return groups.map((group, index) => {
    const members = group.node_ids.map(id => nodeById.get(id)).filter(Boolean)
    if (!members.length) return null
    const memberMinX = Math.min(...members.map(node => node.x))
    const memberMinY = Math.min(...members.map(node => node.y))
    const maxX = Math.max(...members.map(node => node.x + node.w))
    const maxY = Math.max(...members.map(node => node.y + node.h))
    return {
      id: group.id,
      label: group.label,
      kind: group.kind,
      index,
      x: memberMinX - pad,
      y: Math.max(topLimit, memberMinY - pad - 24),
      w: maxX - memberMinX + pad * 2,
      h: maxY - memberMinY + pad * 2 + 24,
      members: members.map(node => node.id),
    }
  }).filter(Boolean)
}

function routeEdge(edge, source, target, direction, index) {
  const sc = { x: source.x + source.w / 2, y: source.y + source.h / 2 }
  const tc = { x: target.x + target.w / 2, y: target.y + target.h / 2 }
  if (source.id === target.id) {
    const x = source.x + source.w
    return {
      points: [
        { x, y: sc.y - 8 },
        { x: x + 34 + index * 2, y: sc.y - 8 },
        { x: x + 34 + index * 2, y: sc.y + 26 },
        { x, y: sc.y + 26 },
      ],
      self: true,
    }
  }
  if (direction === 'LR') {
    if (target.x >= source.x + source.w) {
      const x1 = source.x + source.w
      const x2 = target.x
      const lane = ((index % 3) - 1) * 16
      const mid = Math.min(x2 - 12, Math.max(x1 + 12, (x1 + x2) / 2 + lane))
      const port = ((index % 4) - 1.5) * 36
      const y1 = Math.min(source.y + source.h - 12, Math.max(source.y + 12, sc.y + port))
      const y2 = Math.min(target.y + target.h - 12, Math.max(target.y + 12, tc.y - port))
      return { points: [{ x: x1, y: y1 }, { x: mid, y: y1 }, { x: mid, y: y2 }, { x: x2, y: y2 }] }
    }
    if (source.y + source.h <= target.y || target.y + target.h <= source.y) {
      const sourceAbove = source.y < target.y
      const x1 = sc.x
      const y1 = sourceAbove ? source.y + source.h : source.y
      const x2 = tc.x
      const y2 = sourceAbove ? target.y : target.y + target.h
      const mid = (y1 + y2) / 2
      return { points: [{ x: x1, y: y1 }, { x: x1, y: mid }, { x: x2, y: mid }, { x: x2, y: y2 }] }
    }
    const side = source.x > target.x ? 'right' : 'left'
    const x1 = side === 'right' ? source.x + source.w : source.x
    const x2 = side === 'right' ? target.x + target.w : target.x
    const lane = Math.max(source.y + source.h, target.y + target.h) + 24 + index * 7
    return { points: [{ x: x1, y: sc.y }, { x: x1, y: lane }, { x: x2, y: lane }, { x: x2, y: tc.y }] }
  }
  // Long realization links around intervening classes: exit below, run outside,
  // and enter the target from its outer side instead of cutting through a node.
  if (['realization', 'generalization'].includes(edge.kind) && target.y + target.h <= source.y
    && (target.x >= source.x + source.w || target.x + target.w <= source.x)) {
    const lane = tc.x
    const drop = Math.max(source.y + source.h, target.y + target.h) + 24
    return { points: [
      { x: sc.x, y: source.y + source.h },
      { x: sc.x, y: drop },
      { x: lane, y: drop },
      { x: lane, y: target.y + target.h },
    ] }
  }
  // Class inheritance/realization looks best as a direct vertical link.
  if (['inheritance', 'realization', 'generalization'].includes(edge.kind) && target.y + target.h <= source.y) {
    const left = Math.max(source.x, target.x)
    const right = Math.min(source.x + source.w, target.x + target.w)
    if (right - left >= 24) {
      const x = (left + right) / 2
      return { points: [{ x, y: source.y }, { x, y: target.y + target.h }] }
    }
  }
  // Top-to-bottom layout.
  if (target.y >= source.y + source.h) {
    const y1 = source.y + source.h
    const y2 = target.y
    const mid = (y1 + y2) / 2
    const port = ((index % 4) - 1.5) * 22
    const x1 = Math.min(source.x + source.w - 12, Math.max(source.x + 12, sc.x + port))
    const x2 = Math.min(target.x + target.w - 12, Math.max(target.x + 12, tc.x - port))
    return { points: [{ x: x1, y: y1 }, { x: x1, y: mid }, { x: x2, y: mid }, { x: x2, y: y2 }] }
  }
  if (source.x + source.w <= target.x || target.x + target.w <= source.x) {
    const sourceLeft = source.x < target.x
    const y1 = sc.y
    const x1 = sourceLeft ? source.x + source.w : source.x
    const y2 = tc.y
    const x2 = sourceLeft ? target.x : target.x + target.w
    const mid = (x1 + x2) / 2
    return { points: [{ x: x1, y: y1 }, { x: mid, y: y1 }, { x: mid, y: y2 }, { x: x2, y: y2 }] }
  }
  const side = source.y > target.y ? 'bottom' : 'top'
  const y1 = side === 'bottom' ? source.y + source.h : source.y
  const y2 = side === 'bottom' ? target.y + target.h : target.y
  const lane = Math.max(source.x + source.w, target.x + target.w) + 26 + index * 7
  return { points: [{ x: sc.x, y: y1 }, { x: lane, y: y1 }, { x: lane, y: y2 }, { x: sc.x === tc.x ? tc.x : tc.x, y: y2 }] }
}

function polylineLength(points) {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y)
  }
  return total
}

function pointAt(points, ratio) {
  const total = polylineLength(points)
  if (total === 0) return { ...points[0], angle: 0 }
  let target = total * ratio
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (target <= length || index === points.length - 1) {
      const t = length ? target / length : 0
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) }
    }
    target -= length
  }
  return { ...points.at(-1), angle: 0 }
}

function edgeLabel(edge, diagramType) {
  if (diagramType === 'erd') {
    const parts = []
    if (edge.label) parts.push(edge.label)
    else if (edge.source_role || edge.target_role) parts.push([edge.source_role, edge.target_role].filter(Boolean).join(' → '))
    return parts.join(' ')
  }
  if (diagramType === 'uml_state') return [edge.guard ? `[${edge.guard}]` : '', edge.action ? `/ ${edge.action}` : '', edge.label && edge.label !== edge.guard ? edge.label : ''].filter(Boolean).join(' ')
  if (diagramType === 'uml_class' || diagramType === 'uml_usecase') {
    return [edge.label, edge.source_role ? `${edge.source_role}` : '', edge.target_role ? `${edge.target_role}` : ''].filter(Boolean).join(' ')
  }
  return edge.label || edge.text || ''
}


/**
 * Architecture diagrams use directory-style clusters: each group becomes a
 * non-overlapping row, so boundaries stay legible even when the dependency
 * graph has cycles. Nodes are routed with the normal TB router afterwards.
 */
function layoutArchitectureClusters(ir, density) {
  const used = new Set()
  const clusters = []
  for (const group of ir.groups) {
    const nodes = group.node_ids.map(id => ir.nodes.find(node => node.id === id)).filter(node => node && !used.has(node.id))
    if (!nodes.length) continue
    nodes.forEach(node => used.add(node.id))
    clusters.push({ group, nodes })
  }
  for (const node of ir.nodes) if (!used.has(node.id)) clusters.push({ group: null, nodes: [node] })
  if (!clusters.length) return null

  const rank = computeRanks(ir.nodes, ir.edges)
  for (const cluster of clusters) {
    cluster.minRank = Math.min(...cluster.nodes.map(node => rank.get(node.id) ?? 0))
    cluster.avgRank = cluster.nodes.reduce((sum, node) => sum + (rank.get(node.id) ?? 0), 0) / cluster.nodes.length
  }
  clusters.sort((a, b) => a.minRank - b.minRank || a.avgRank - b.avgRank)

  const pad = Math.max(20, density.pad)
  const gap = density.gap
  const measured = new Map(ir.nodes.map(node => [node.id, measureNode(node, ir.diagram_type, density)]))
  const rowSizes = clusters.map(cluster => {
    const sizes = cluster.nodes.map(node => measured.get(node.id))
    return {
      width: sizes.reduce((sum, item) => sum + item.w, 0) + Math.max(0, sizes.length - 1) * gap + pad * 2,
      height: Math.max(...sizes.map(item => item.h)) + 54,
      maxNodeHeight: Math.max(...sizes.map(item => item.h)),
    }
  })
  const maxRowWidth = Math.max(...rowSizes.map(row => row.width))
  const titleWidth = Math.min(980, Math.max(420, textWidth(ir.title, 25, 700) + 80))
  const width = Math.max(680, maxRowWidth + MARGIN * 2, Math.min(780, titleWidth + MARGIN * 2))
  const headerTitleLines = wrapText(ir.title, width - MARGIN * 2 - 24, 25, 2, 700)
  const headerHeight = 48 + headerTitleLines.length * 33
  let y = headerHeight + 20
  const layoutNodes = []
  const nodeById = new Map()
  const layoutGroups = []
  clusters.forEach((cluster, clusterIndex) => {
    const row = rowSizes[clusterIndex]
    const x = (width - row.width) / 2
    if (cluster.group) {
      layoutGroups.push({
        id: cluster.group.id,
        label: cluster.group.label,
        kind: cluster.group.kind,
        x,
        y,
        w: row.width,
        h: row.height,
        members: cluster.nodes.map(node => node.id),
      })
    }
    let cursor = x + pad
    for (const node of cluster.nodes) {
      const metrics = measured.get(node.id)
      const entry = {
        id: node.id,
        name: node.name,
        kind: node.kind,
        x: cursor,
        y: y + 34 + (row.maxNodeHeight - metrics.h) / 2,
        w: metrics.w,
        h: metrics.h,
        ...metrics,
        lifelineX: cursor + metrics.w / 2,
      }
      layoutNodes.push(entry)
      nodeById.set(node.id, entry)
      cursor += metrics.w + gap
    }
    y += row.height + density.layerGap
  })

  const edges = ir.edges.map((edge, index) => {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target) return null
    const route = routeEdge(edge, source, target, 'TB', index)
    const labelText = edgeLabel(edge, ir.diagram_type)
    const labelLines = labelText ? wrapText(labelText, 170, 10.5, 2, 550) : []
    const anchor = pointAt(route.points, 0.5)
    return {
      id: edge.id, kind: edge.kind, dashed: edge.dashed, points: route.points, self: Boolean(route.self),
      label: labelText, labelLines, labelX: anchor.x, labelY: anchor.y - 8, angle: anchor.angle, cardinality: null,
    }
  }).filter(Boolean)

  const bottom = Math.max(...layoutNodes.map(node => node.y + node.h), ...layoutGroups.map(group => group.y + group.h), headerHeight + 200)
  const height = bottom + 42 + 18
  return {
    version: 1, direction: 'TB', density: density.name, width: Math.ceil(width), height: Math.ceil(height), margin: MARGIN,
    header: { height: headerHeight, titleLines: headerTitleLines, subtitle: headerSubtitle(ir), revision: ir.revision },
    nodes: layoutNodes, edges, groups: layoutGroups, frames: [], lifelines: [], activations: [],
    footer: { text: `AI Diagram Studio · revision ${ir.revision}`, height: 42 },
    stats: { nodes: layoutNodes.length, edges: edges.length, groups: layoutGroups.length, clusters: clusters.length },
  }
}

function layoutGraph(ir) {
  const diagramType = ir.diagram_type
  const density = resolveDensity(ir.style?.layout_density, diagramType)
  const direction = chooseDirection(ir, diagramType)
  if (diagramType === 'architecture' && ir.groups.length) {
    const clustered = layoutArchitectureClusters(ir, density)
    if (clustered) return clustered
  }
  const order = nodeOrderMap(ir.nodes)
  const measured = ir.nodes.map(node => ({ node, metrics: measureNode(node, diagramType, density) }))
  const metricById = new Map(measured.map(item => [item.node.id, item.metrics]))
  const rankingEdges = diagramType === 'uml_class'
    ? ir.edges.map(edge => ['inheritance', 'realization'].includes(edge.kind) ? { ...edge, source: edge.target, target: edge.source } : edge)
    : ir.edges
  const rank = computeRanks(ir.nodes, rankingEdges)
  const layers = buildLayers(ir.nodes, rank, order)

  const rowSizes = layers.map(layer => {
    const sizes = layer.map(node => metricById.get(node.id))
    return {
      width: sizes.reduce((sum, item) => sum + item.w, 0) + Math.max(0, layer.length - 1) * density.gap,
      height: Math.max(...sizes.map(item => item.h)),
      depth: Math.max(...sizes.map(item => item.w)),
    }
  })
  const contentWidth = direction === 'TB'
    ? Math.max(...rowSizes.map(row => row.width))
    : rowSizes.reduce((sum, row) => sum + row.depth, 0) + Math.max(0, rowSizes.length - 1) * density.layerGap
  const contentHeight = direction === 'TB'
    ? rowSizes.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rowSizes.length - 1) * density.layerGap
    : Math.max(...rowSizes.map(row => row.height))

  const headerTitleWidth = Math.min(980, Math.max(420, textWidth(ir.title, 25, 700) + 80))
  const width = Math.max(680, contentWidth + MARGIN * 2, Math.min(780, headerTitleWidth + MARGIN * 2))
  const headerTitleLines = wrapText(ir.title, width - MARGIN * 2 - 24, 25, 2, 700)
  const headerHeight = 48 + headerTitleLines.length * 33
  const top = headerHeight + 24
  const nodeById = new Map()
  const layoutNodes = []

  if (direction === 'TB') {
    let y = top
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
      const layer = layers[layerIndex]
      const row = rowSizes[layerIndex]
      let x = (width - row.width) / 2
      for (const node of layer) {
        const metrics = metricById.get(node.id)
        const entry = {
          id: node.id,
          name: node.name,
          kind: node.kind,
          x,
          y: y + (row.height - metrics.h) / 2,
          w: metrics.w,
          h: metrics.h,
          ...metrics,
          lifelineX: x + metrics.w / 2,
        }
        layoutNodes.push(entry)
        nodeById.set(node.id, entry)
        x += metrics.w + density.gap
      }
      y += row.height + density.layerGap
    }
  } else {
    let x = (width - contentWidth) / 2
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
      const layer = layers[layerIndex]
      const row = rowSizes[layerIndex]
      let y = top + (contentHeight - row.height) / 2
      for (const node of layer) {
        const metrics = metricById.get(node.id)
        const entry = {
          id: node.id,
          name: node.name,
          kind: node.kind,
          x,
          y,
          w: metrics.w,
          h: metrics.h,
          ...metrics,
          lifelineX: x + metrics.w / 2,
        }
        layoutNodes.push(entry)
        nodeById.set(node.id, entry)
        y += metrics.h + density.gap
      }
      x += row.depth + density.layerGap
    }
  }

  const groups = groupLayouts(ir.groups, nodeById, density.pad, headerHeight + 8)
  const bottom = Math.max(
    ...layoutNodes.map(node => node.y + node.h),
    ...groups.map(group => group.y + group.h),
    top + 220,
  )
  const edges = ir.edges.map((edge, index) => {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target) return null
    const route = routeEdge(edge, source, target, direction, index)
    const labelText = edgeLabel(edge, diagramType)
    const labelLines = labelText ? wrapText(labelText, 170, 10.5, 2, 550) : []
    const anchor = pointAt(route.points, 0.5)
    return {
      id: edge.id,
      kind: edge.kind,
      dashed: edge.dashed,
      points: route.points,
      self: Boolean(route.self),
      label: labelText,
      labelLines,
      labelX: anchor.x,
      labelY: anchor.y - 8,
      angle: anchor.angle,
      cardinality: diagramType === 'erd' || diagramType === 'uml_class' ? {
        source: edge.source_cardinality,
        target: edge.target_cardinality,
        source_optional: edge.source_optional,
        target_optional: edge.target_optional,
      } : null,
    }
  }).filter(Boolean)

  const footerHeight = 42
  const height = bottom + footerHeight + 18
  return {
    version: 1,
    direction,
    density: density.name,
    width: Math.ceil(width),
    height: Math.ceil(height),
    margin: MARGIN,
    header: {
      height: headerHeight,
      titleLines: headerTitleLines,
      subtitle: headerSubtitle(ir),
      revision: ir.revision,
    },
    nodes: layoutNodes,
    edges,
    groups,
    frames: [],
    footer: {
      text: `AI Diagram Studio · revision ${ir.revision}`,
      height: footerHeight,
    },
    stats: { nodes: layoutNodes.length, edges: edges.length, groups: groups.length },
  }
}

function layoutSequence(ir) {
  const density = resolveDensity(ir.style?.layout_density, 'sequence')
  const orderedNodes = [...ir.nodes]
  const metrics = new Map(orderedNodes.map(node => [node.id, measureNode(node, 'sequence', density)]))
  const widest = Math.max(120, ...[...metrics.values()].map(item => item.w))
  const columns = Math.max(2, orderedNodes.length)
  const colWidth = Math.max(150, widest + 42)
  const width = Math.max(760, columns * colWidth + MARGIN * 2)
  const headerTitleLines = wrapText(ir.title, width - MARGIN * 2 - 24, 25, 2, 700)
  const headerHeight = 48 + headerTitleLines.length * 33
  const participantY = headerHeight + 16
  const layoutNodes = []
  const nodeById = new Map()
  for (let index = 0; index < orderedNodes.length; index += 1) {
    const node = orderedNodes[index]
    const metric = metrics.get(node.id)
    const columnLeft = MARGIN + index * ((width - MARGIN * 2) / columns)
    const entry = {
      id: node.id,
      name: node.name,
      kind: node.kind,
      x: columnLeft + (colWidth - metric.w) / 2,
      y: participantY,
      w: metric.w,
      h: metric.h,
      ...metric,
      lifelineX: columnLeft + colWidth / 2,
    }
    layoutNodes.push(entry)
    nodeById.set(node.id, entry)
  }

  let y = participantY + 112
  const edges = []
  const sorted = [...ir.edges].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  for (const edge of sorted) {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target) continue
    const labelText = edge.text || edge.label || ''
    const labelLines = labelText ? wrapText(labelText, 190, 10.5, 2, 550) : []
    const step = labelLines.length > 1 ? 30 : 20
    const points = source.id === target.id
      ? [
          { x: source.lifelineX, y },
          { x: source.lifelineX + 42, y },
          { x: source.lifelineX + 42, y: y + 30 },
          { x: source.lifelineX, y: y + 30 },
        ]
      : [
          { x: source.lifelineX, y },
          { x: target.lifelineX, y },
        ]
    const labelX = (source.lifelineX + target.lifelineX) / 2
    edges.push({
      id: edge.id,
      kind: edge.kind,
      points,
      self: source.id === target.id,
      label: labelText,
      labelLines,
      labelX: source.id === target.id ? source.lifelineX + 54 : labelX,
      labelY: y - 9,
      y,
      angle: 0,
    })
    y += 58 + step
  }

  const messageBottom = edges.length ? Math.max(...edges.map(edge => edge.y + 30)) : participantY + 90
  const frames = ir.frames.map((frame, index) => {
    const members = frame.message_ids.map(id => edges.find(edge => edge.id === id)).filter(Boolean)
    if (!members.length) return null
    const ids = new Set(members.flatMap(edge => [edge.points[0].x, edge.points.at(-1).x]))
    const xs = [...ids]
    const minX = Math.min(...xs) - 44
    const maxX = Math.max(...xs) + 44
    const minY = Math.min(...members.map(edge => edge.y)) - 56
    const maxY = Math.max(...members.map(edge => edge.y)) + 34
    return {
      id: frame.id,
      kind: frame.kind,
      label: frame.label,
      index,
      x: minX,
      y: minY,
      w: Math.max(120, maxX - minX),
      h: maxY - minY,
      memberCount: members.length,
    }
  }).filter(Boolean).sort((a, b) => a.w * a.h - b.w * b.h)

  const lifelineBottom = Math.max(messageBottom + 40, participantY + 220)
  const height = lifelineBottom + 70

  const activations = []
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index]
    if (edge.kind !== 'sync' && edge.kind !== 'async') continue
    const call = sorted.find(candidate => candidate.id === edge.id)
    if (!call) continue
    const close = edges.slice(index + 1).find(candidate => {
      const original = sorted.find(item => item.id === candidate.id)
      return original && original.kind === 'return' && original.source === call.target && original.target === call.source
    })
    const target = nodeById.get(call.target)
    if (!target) continue
    activations.push({ x: target.lifelineX, y: edge.y, h: Math.max(24, (close?.y ?? edge.y + 36) - edge.y) })
  }

  return {
    version: 1,
    direction: 'TB',
    density: density.name,
    width: Math.ceil(width),
    height: Math.ceil(height),
    margin: MARGIN,
    header: {
      height: headerHeight,
      titleLines: headerTitleLines,
      subtitle: headerSubtitle(ir),
      revision: ir.revision,
    },
    nodes: layoutNodes,
    edges,
    groups: [],
    frames,
    lifelines: layoutNodes.map(node => ({ id: node.id, x: node.lifelineX, y: node.y + node.h, bottom: lifelineBottom })),
    activations,
    footer: { text: `AI Diagram Studio · revision ${ir.revision}`, height: 42 },
    stats: { nodes: layoutNodes.length, edges: edges.length, frames: frames.length },
  }
}

export function layoutDiagram(input) {
  const ir = cloneIR(input)
  ir.layout = ir.diagram_type === 'sequence' ? layoutSequence(ir) : layoutGraph(ir)
  return ir
}
