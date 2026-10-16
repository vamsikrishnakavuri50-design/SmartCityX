# SmartCityX — Urban Intelligence Platform

SmartCityX is a front-end demonstration of a smart-city operations and analytics application. It is **not** a DSA study website. The interface models how algorithms and data structures can support incident triage, route optimization, complaint search, infrastructure connectivity analysis, and response resource planning.

## Features

- **City overview:** operational metrics, a schematic road network, priority incident queue, service-performance illustration, and recent activity.
- **Incident command:** create incidents, filter/search records, rank incidents with a binary max-heap priority queue, and mark incidents resolved.
- **Route optimizer:** run Dijkstra's shortest-path algorithm over a small weighted road graph and inspect its node-visit trace.
- **Complaint intelligence:** submit citizen reports and search report text using a Knuth–Morris–Pratt (KMP) string-matching implementation.
- **Infrastructure network:** inspect sample assets, run breadth-first connectivity analysis, and generate a minimum spanning tree with Kruskal’s algorithm to model a minimum-weight connected infrastructure plan.
- **Resource allocation:** produce an explainable greedy proposal that ranks unresolved incidents by severity and allocates a configurable number of response units.
- **Responsive UI:** desktop, tablet, and mobile layouts.

## Important data and demo limitations

This is a self-contained front-end demo. Its records, metrics, service chart, map locations, and edge weights are illustrative sample data. The map is schematic and not geographically accurate. The route weights are demonstration travel-minute estimates, not live traffic. No live city sensors, GIS provider, municipal database, user authentication, dispatch service, or backend is connected.

The greedy resource planner is a transparent heuristic, not a validated operational dispatch system. Real deployment would require verified data, domain rules, security, access control, and operational testing.

## Requirements

- Node.js 18 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## Project structure

```text
SmartCityX/
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── App.jsx
    ├── algorithms.js
    ├── main.jsx
    └── styles.css
```

## Algorithm implementations

- Dijkstra shortest path — `src/algorithms.js`
- KMP string search — `src/algorithms.js`
- Incident priority queue — binary max-heap (severity first; older items break ties)
- Kruskal minimum spanning tree — infrastructure network design
- Infrastructure connectivity — breadth-first search (BFS)
- Resource allocation — greedy priority heuristic

## Data persistence

Incident and complaint records are now saved in the browser with localStorage, so they remain after refresh on the same browser/device. This is local demo persistence, not a shared database or secure multi-user backend. Clearing browser storage removes these records.

## Suggested next production steps

1. Connect a secure backend and database for shared multi-user records (browser localStorage is only a prototype persistence layer).
2. Replace sample incidents and assets with validated data feeds.
3. Integrate a GIS map and real road-network routing data.
4. Add authentication and role-based access controls.
5. Add audit logs, incident assignment workflows, and verified dispatch constraints.
6. Add automated tests for algorithm correctness and end-to-end workflows.
