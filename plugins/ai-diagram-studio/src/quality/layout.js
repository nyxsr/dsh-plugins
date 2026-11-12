/** Programmatic layout inspection: geometry only, no claims of human visual review. */
function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function segmentIntersection(a, b, c, d) {
  const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const same = (p, q) => Math.abs(p.x - q.x) < 0.01 && Math.abs(p.y - q.y) < 0.01
  if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) return false
  const o1 = orient(a, b, c)
  const o2 = orient(a, b, d)
  const o3 = orient(c, d, a)
  const o4 = orient(c, d, b)
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)
}

function countCrossings(edges) {
  const list = edges.slice(0, 260)
  let count = 0
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i]
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j]
      for (let si = 1; si < a.points.length; si += 1) {
        for (let sj = 1; sj < b.points.length; sj += 1) {
          if (segmentIntersection(a.points[si - 1], a.points[si], b.points[sj - 1], b.points[sj])) count += 1
        }
      }
    }
  }
  return count
}


function collinearOverlap(a1, a2, b1, b2, minimum = 100) {
  const horizontal = Math.abs(a1.y - a2.y) < 0.5 && Math.abs(b1.y - b2.y) < 0.5 && Math.abs(a1.y - b1.y) < 0.5
  if (horizontal) {
    const start = Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x))
    const end = Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x))
    return Math.max(0, end - start) >= minimum
  }
  const vertical = Math.abs(a1.x - a2.x) < 0.5 && Math.abs(b1.x - b2.x) < 0.5 && Math.abs(a1.x - b1.x) < 0.5
  if (vertical) {
    const start = Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y))
    const end = Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y))
    return Math.max(0, end - start) >= minimum
  }
  return false
}

function countEdgeOverlaps(edges) {
  let count = 0
  const examples = []
  const list = edges.slice(0, 220)
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      let found = false
      for (let a = 1; a < list[i].points.length && !found; a += 1) {
        for (let b = 1; b < list[j].points.length && !found; b += 1) {
          if (collinearOverlap(list[i].points[a - 1], list[i].points[a], list[j].points[b - 1], list[j].points[b])) {
            found = true
            count += 1
            if (examples.length < 4) examples.push(`${list[i].id} / ${list[j].id}`)
          }
        }
      }
    }
  }
  return { count, examples }
}

function coincidentEndpoints(edges) {
  const buckets = new Map()
  for (const edge of edges) {
    if (!edge.points?.length) continue
    for (const point of [edge.points[0], edge.points.at(-1)]) {
      const key = `${point.x.toFixed(1)},${point.y.toFixed(1)}`
      const entry = buckets.get(key) ?? { edges: new Set(), point }
      entry.edges.add(edge.id)
      buckets.set(key, entry)
    }
  }
  return [...buckets.values()].filter(entry => entry.edges.size > 1)
}

export function inspectLayout(ir) {
  const layout = ir.layout
  const checks = []
  const errors = []
  const warnings = []
  const add = (id, status, detail) => {
    checks.push({ id, status, detail })
    if (status === 'FAILED') errors.push({ code: id, message: detail, severity: 'error' })
    else if (status === 'WARNING') warnings.push({ code: id, message: detail, severity: 'warning' })
  }
  if (!layout) {
    return { status: 'FAILED', checks: [{ id: 'layout_missing', status: 'FAILED' }], errors: [{ code: 'layout_missing', message: 'Diagram has no layout.' }], warnings: [], stats: {} }
  }
  const nodes = layout.nodes ?? []
  const edges = layout.edges ?? []
  if (!nodes.length) add('layout_empty', 'FAILED', 'The diagram has no renderable nodes.')
  else add('layout_nodes', 'PASSED', `${nodes.length} nodes are laid out.`)

  let overlaps = 0
  const overlapping = []
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (intersects(nodes[i], nodes[j])) {
        overlaps += 1
        if (overlapping.length < 6) overlapping.push(`${nodes[i].name} / ${nodes[j].name}`)
      }
    }
  }
  add('layout_node_overlap', overlaps ? 'FAILED' : 'PASSED', overlaps ? `${overlaps} overlapping node pair(s): ${overlapping.join(', ')}.` : 'No node rectangles overlap.')

  const outside = nodes.filter(node => node.x < 0 || node.y < 0 || node.x + node.w > layout.width || node.y + node.h > layout.height)
  add('layout_node_bounds', outside.length ? 'FAILED' : 'PASSED', outside.length ? `${outside.length} node(s) fall outside the canvas.` : 'All nodes are inside the canvas.')

  const tight = []
  for (const edge of edges) {
    if (!edge.points?.length) continue
    const length = edge.points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - edge.points[index].x, point.y - edge.points[index].y), 0)
    if (length < 12) tight.push(edge.id)
  }
  add('layout_edge_length', tight.length ? 'WARNING' : 'PASSED', tight.length ? `${tight.length} edge(s) are shorter than 12 px.` : 'All edges have usable length.')

  const labelOutside = edges.filter(edge => edge.labelLines?.length && (edge.labelX < 4 || edge.labelX > layout.width - 4 || edge.labelY < 4 || edge.labelY > layout.height - 4))
  add('layout_edge_labels', labelOutside.length ? 'WARNING' : 'PASSED', labelOutside.length ? `${labelOutside.length} edge label(s) are near or beyond the canvas edge.` : 'Edge labels are inside the canvas.')

  const badGroups = (layout.groups ?? []).filter(group => group.x < 0 || group.y < 0 || group.x + group.w > layout.width || group.y + group.h > layout.height)
  add('layout_group_bounds', badGroups.length ? 'WARNING' : 'PASSED', badGroups.length ? `${badGroups.length} group(s) extend beyond the canvas.` : 'Groups are inside the canvas.')

  const groupOverlap = []
  const groups = layout.groups ?? []
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) if (intersects(groups[i], groups[j])) groupOverlap.push(`${groups[i].label} / ${groups[j].label}`)
  }
  add('layout_group_overlap', groupOverlap.length ? 'WARNING' : 'PASSED', groupOverlap.length ? `Group boundaries overlap: ${groupOverlap.join(', ')}.` : 'Group boundaries do not overlap.')

  const headerOverlap = groups.filter(group => group.y < (layout.header?.height ?? 0) + 4)
  add('layout_group_header', headerOverlap.length ? 'WARNING' : 'PASSED', headerOverlap.length ? `${headerOverlap.length} group(s) overlap the title band.` : 'Groups stay below the title band.')

  const overlapResult = countEdgeOverlaps(edges)
  add('layout_edge_overlap', overlapResult.count ? 'WARNING' : 'PASSED', overlapResult.count ? `${overlapResult.count} overlapping collinear edge segment pair(s): ${overlapResult.examples.join(', ')}.` : 'No long collinear edge segments overlap.')

  const sharedPorts = coincidentEndpoints(edges).filter(entry => entry.edges.size > 2)
  add('layout_coincident_endpoints', sharedPorts.length ? 'WARNING' : 'PASSED', sharedPorts.length ? `${sharedPorts.length} endpoint(s) are shared by three or more edges.` : 'Edge endpoints use distinct ports or simple two-way fans.')

  const crossings = countCrossings(edges)
  const crossingLimit = Math.max(8, Math.ceil(edges.length * 1.4))
  add('layout_crossings', crossings > crossingLimit ? 'WARNING' : 'PASSED', `${crossings} connector crossing(s), advisory limit ${crossingLimit}.`)

  const area = layout.width * layout.height
  const density = area ? nodes.length / (area / 100000) : 0
  add('layout_density', density > 14 ? 'WARNING' : 'PASSED', `${density.toFixed(1)} nodes per 100,000 px².`)

  const nodeBox = nodes.length ? {
    x: Math.min(...nodes.map(node => node.x)), y: Math.min(...nodes.map(node => node.y)),
    w: Math.max(...nodes.map(node => node.x + node.w)) - Math.min(...nodes.map(node => node.x)),
    h: Math.max(...nodes.map(node => node.y + node.h)) - Math.min(...nodes.map(node => node.y)),
  } : null
  const usableHeight = layout.height - (layout.header?.height ?? 0) - (layout.footer?.height ?? 0)
  const fill = nodeBox && usableHeight > 0 ? nodeBox.h / usableHeight : 0
  add('layout_vertical_fill', fill < 0.18 ? 'WARNING' : 'PASSED', `Vertical content fill is ${(fill * 100).toFixed(0)}%.`)

  const status = errors.length ? 'FAILED' : warnings.length ? 'WARNING' : 'PASSED'
  return {
    status,
    checks,
    errors,
    warnings,
    stats: { nodes: nodes.length, edges: edges.length, groups: groups.length, overlaps, crossings, density: Number(density.toFixed(2)), verticalFill: Number(fill.toFixed(3)) },
    score: errors.length * 1000 + overlaps * 400 + outside.length * 300 + crossings * 0.4 + groupOverlap.length * 20 + Math.max(0, 0.5 - fill) * 40,
  }
}
