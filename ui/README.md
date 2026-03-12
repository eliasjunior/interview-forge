# ui

A **React + Vite** dashboard for browsing interview sessions, reading full reports, and exploring the cumulative knowledge graph. Reads all data from `interview-mcp`'s HTTP API on port 3001.

> **Monorepo:** this package is one of four. See the [root README](../README.md) for the full picture.
> Related: [interview-mcp](../interview-mcp/README.md) · [report-mcp](../report-mcp/README.md) · [shared](../shared/README.md)

---

## What it does

- **Sessions page** — card grid of all interview sessions, split into in-progress and completed, sorted newest first.
- **Report page** — full report viewer for a completed session with three tabs: Overview (summary + concepts by cluster), Questions (collapsible Q/A cards with score bars, feedback, and deeper dives), and Transcript (chat-style message bubbles).
- **Graph page** — interactive D3 v7 force-directed graph of the cumulative knowledge graph: zoom, pan, drag nodes, hover tooltips, color-coded clusters, and a legend.

---

## Architecture

```
ui/
├── src/
│   ├── main.tsx              # React 18 entry point
│   ├── App.tsx               # Router setup (React Router v6)
│   ├── api.ts                # Typed fetch wrappers for all API endpoints
│   ├── components/
│   │   ├── NavBar.tsx        # Top navigation bar
│   │   └── ScoreBadge.tsx    # Score chip (1–5, colour-coded)
│   └── pages/
│       ├── SessionsPage.tsx  # Session card grid
│       ├── ReportPage.tsx    # Tabbed report viewer
│       └── GraphPage.tsx     # D3 force-directed knowledge graph
├── index.html
└── vite.config.ts            # Dev proxy: /api → http://localhost:3001
```

> **Shared types** live in `../shared/src/types.ts` (`@mock-interview/shared`). Do not add a local `types.ts`.

---

## Pages

### Sessions (`/`)

Fetches `GET /api/sessions` and renders a card for each session showing topic, state badge, progress (`2 / 5 questions`), average score, and date. Completed sessions link to their report. In-progress sessions show a resume prompt.

### Report (`/report/:id`)

Fetches `GET /api/sessions` (filtered by ID) and renders three tabs:

- **Overview** — session metadata table (topic, date, average score, question count) + concepts grouped by cluster with colour-coded chips.
- **Questions** — one collapsible card per question. Each card shows the question, the candidate's answer, a `ScoreBadge`, written feedback, and AI-generated "deeper dive" bullet points.
- **Transcript** — all messages rendered as chat bubbles, alternating interviewer / candidate alignment.

### Graph (`/graph`)

Fetches `GET /api/graph` and renders a D3 v7 force-directed simulation:

- **Nodes** — one per extracted concept; size scales with the number of clusters the concept belongs to.
- **Edges** — co-occurrence within a cluster session; width scales with edge weight.
- **Colours** — four fixed cluster colours (`core concepts`, `practical usage`, `tradeoffs`, `best practices`); a node takes the colour of its first cluster.
- **Interactions** — zoom/pan via `d3.zoom`, node drag via `d3.drag`, hover tooltip showing concept label and cluster list.
- **Legend** — shows all four cluster colours; each entry is a static label.

---

## API Client (`api.ts`)

Thin wrappers around `fetch` — all proxied through Vite's `/api` prefix to `http://localhost:3001`.

| Function | Endpoint | Returns |
|---|---|---|
| `getSessions()` | `GET /api/sessions` | `Session[]` |
| `getSession(id)` | `GET /api/sessions` (filtered) | `Session \| null` |
| `getReports()` | `GET /api/reports` | `ReportMeta[]` |
| `getGraph()` | `GET /api/graph` | `KnowledgeGraph` |

---

## Dependencies

| Package | Role |
|---|---|
| `react` + `react-dom` | UI framework (v18) |
| `react-router-dom` | Client-side routing (v6) |
| `d3` | Force-directed graph simulation and SVG rendering (v7) |
| `@mock-interview/shared` | Shared TypeScript types (workspace package — no runtime cost) |
| `vite` | Dev server + bundler |
| `@vitejs/plugin-react` | React fast refresh in Vite |
| `typescript` | Type checking and build |

---

## Setup

```bash
# From monorepo root — installs all workspaces
npm install

# Start interview-mcp's HTTP API first (required — ui has no data of its own)
cd interview-mcp && npm run dev:http

# In a second terminal, start the ui dev server
npm run dev:ui   # from monorepo root  — or —  cd ui && npm run dev
```

The app is available at **http://localhost:5173**.

### Vite proxy

The `vite.config.ts` proxy forwards all `/api/*` and `/generated/*` requests to `http://localhost:3001` so the frontend never needs to know the API port:

```
/api/sessions     → http://localhost:3001/api/sessions
/api/graph        → http://localhost:3001/api/graph
/generated/...    → http://localhost:3001/generated/...
```

This proxy is **dev only**. For production, configure your reverse proxy (nginx, Caddy, etc.) to do the same.

### Build

```bash
npm run build:ui   # from monorepo root  — or —  cd ui && npm run build
```

Output goes to `ui/dist/`. Serve it with any static file server pointed at `http://localhost:3001` for the API.
