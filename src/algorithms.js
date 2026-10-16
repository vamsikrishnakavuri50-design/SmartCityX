// Core algorithms used by SmartCityX's operational features.

export function dijkstra(graph, start, end) {
  const distances = Object.fromEntries(Object.keys(graph).map(n => [n, Infinity]));
  const previous = {};
  const visited = new Set();
  const steps = [];
  distances[start] = 0;

  while (visited.size < Object.keys(graph).length) {
    let current = null;
    for (const node of Object.keys(graph)) {
      if (!visited.has(node) && (current === null || distances[node] < distances[current])) current = node;
    }
    if (current === null || distances[current] === Infinity) break;
    visited.add(current);
    steps.push({ current, distance: distances[current], visited: [...visited] });
    if (current === end) break;

    for (const edge of graph[current]) {
      if (visited.has(edge.to)) continue;
      const candidate = distances[current] + edge.weight;
      if (candidate < distances[edge.to]) {
        distances[edge.to] = candidate;
        previous[edge.to] = current;
      }
    }
  }

  const path = [];
  let cursor = end;
  if (cursor === start) path.push(cursor);
  else if (previous[cursor] || distances[cursor] !== Infinity) {
    while (cursor) {
      path.unshift(cursor);
      if (cursor === start) break;
      cursor = previous[cursor];
    }
  }
  return { path: path[0] === start ? path : [], distance: distances[end], steps, distances };
}

export function kmpSearch(text, pattern) {
  if (!pattern) return { matches: [], lps: [], comparisons: 0, trace: [] };
  const lps = Array(pattern.length).fill(0);
  let len = 0, i = 1;
  while (i < pattern.length) {
    if (pattern[i] === pattern[len]) lps[i++] = ++len;
    else if (len !== 0) len = lps[len - 1];
    else lps[i++] = 0;
  }
  const matches = [], trace = [];
  let ti = 0, pi = 0, comparisons = 0;
  while (ti < text.length) {
    comparisons++;
    trace.push({ textIndex: ti, patternIndex: pi, match: text[ti] === pattern[pi] });
    if (text[ti] === pattern[pi]) { ti++; pi++; }
    if (pi === pattern.length) {
      matches.push(ti - pi);
      pi = lps[pi - 1];
    } else if (ti < text.length && text[ti] !== pattern[pi]) {
      if (pi !== 0) pi = lps[pi - 1];
      else ti++;
    }
  }
  return { matches, lps, comparisons, trace };
}

// Binary max-heap priority queue: higher severity first, then older incident first.
export function prioritizeIncidents(incidents) {
  const severity = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const score = (item) => severity[item.severity] || 0;
  const before = (a, b) => score(a) > score(b) ||
    (score(a) === score(b) && new Date(a.createdAt || 0) < new Date(b.createdAt || 0));
  const heap = [];
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (!before(heap[i], heap[parent])) break;
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    }
  };
  const pop = () => {
    if (!heap.length) return null;
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const left = 2 * i + 1, right = left + 1;
        let best = i;
        if (left < heap.length && before(heap[left], heap[best])) best = left;
        if (right < heap.length && before(heap[right], heap[best])) best = right;
        if (best === i) break;
        [heap[i], heap[best]] = [heap[best], heap[i]];
        i = best;
      }
    }
    return top;
  };
  incidents.forEach(push);
  const ordered = [];
  while (heap.length) ordered.push(pop());
  return ordered;
}

// Kruskal's minimum spanning tree: select low-cost edges without creating cycles.
export function kruskalMST(nodes, edges) {
  const parent = Object.fromEntries(nodes.map(n => [n.id, n.id]));
  const rank = Object.fromEntries(nodes.map(n => [n.id, 0]));
  const find = (x) => {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a, b) => {
    let ra = find(a), rb = find(b);
    if (ra === rb) return false;
    if (rank[ra] < rank[rb]) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    if (rank[ra] === rank[rb]) rank[ra]++;
    return true;
  };
  const selected = [], rejected = [];
  const sorted = [...edges].sort((a, b) => a.weight - b.weight);
  for (const edge of sorted) (union(edge.from, edge.to) ? selected : rejected).push(edge);
  return { edges: selected, rejected, totalWeight: selected.reduce((sum, e) => sum + e.weight, 0), connected: selected.length === Math.max(0, nodes.length - 1) };
}

export function analyzeNetwork(nodes, edges) {
  const adjacency = Object.fromEntries(nodes.map(n => [n.id, []]));
  edges.forEach(e => {
    if (adjacency[e.from] && adjacency[e.to]) {
      adjacency[e.from].push(e.to);
      adjacency[e.to].push(e.from);
    }
  });
  const seen = new Set();
  const components = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const queue = [node.id], component = [];
    seen.add(node.id);
    while (queue.length) {
      const current = queue.shift();
      component.push(current);
      for (const next of adjacency[current]) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    components.push(component);
  }
  return { components, connected: components.length <= 1, adjacency };
}

export function greedyResourceAllocation(incidents, availableUnits) {
  let remaining = availableUnits;
  return prioritizeIncidents(incidents.filter(i => i.status !== "Resolved")).map(item => {
    const unitsNeeded = item.severity === "Critical" ? 2 : 1;
    const assigned = remaining >= unitsNeeded;
    if (assigned) remaining -= unitsNeeded;
    return { ...item, unitsNeeded, assigned };
  });
}