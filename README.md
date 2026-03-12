# mock-interview-mcp

A study project for learning **Model Context Protocol (MCP)** server development. It runs mock technical interviews through Claude, evaluates answers with AI, and builds a growing knowledge graph across sessions — all visualised in a React dashboard.

The project is a **npm workspaces monorepo** with four packages, each with its own README:

| Package | README | Description |
|---|---|---|
| `interview-mcp` | [README](interview-mcp/README.md) | MCP server — runs the interview state machine, owns all session data, exposes the REST API |
| `report-mcp` | [README](report-mcp/README.md) | MCP server — analytics and reporting on completed sessions, dynamic HTML report UI |
| `ui` | [README](ui/README.md) | React + Vite dashboard — sessions list, tabbed report viewer, D3 knowledge graph |
| `shared` | [README](shared/README.md) | TypeScript types only — single source of truth for all domain types across the monorepo |

---

## How the pieces fit together

```
┌──────────────────────┐      stdio (MCP)      ┌─────────────────────┐
│   Claude Desktop /   │ ─────────────────────► │   interview-mcp     │
│   Claude Code        │                        │                     │
│   (orchestrator LLM) │ ─────────────────────► │   report-mcp        │
└──────────────────────┘      stdio (MCP)       └─────────────────────┘
                                                         │
                                                   data/  (shared files)
                                                         │
                                               ┌─────────▼──────────┐
                                               │  interview-mcp      │
                                               │  HTTP API :3001     │
                                               └─────────┬──────────┘
                                                         │ fetch /api/*
                                               ┌─────────▼──────────┐
                                               │  ui  :5173          │
                                               │  React dashboard    │
                                               └─────────────────────┘
```

**`interview-mcp`** is the data owner. It runs the interview state machine, persists every session to `data/sessions.json`, builds the cumulative `data/graph.json`, and serves all of it over HTTP on port 3001.

**`report-mcp`** is read-mostly. It reads `interview-mcp`'s data files (path configurable via `DATA_DIR`) and exposes tools for report regeneration, graph queries, and interactive HTML report generation. It writes back only to `data/reports/` and `public/generated/`.

**`ui`** is a pure frontend. It has no data of its own — it fetches everything from `interview-mcp`'s REST API via a Vite dev proxy.

**`shared`** is types-only. No runtime code — just TypeScript interfaces imported by the other three packages at compile time.

---

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/eliasjunior/interview-mcp-.git
cd interview-mcp-
npm install   # hoists all workspace dependencies to root node_modules

# 2. Configure interview-mcp
cp interview-mcp/.env.example interview-mcp/.env   # then edit with your API key
# AI_ENABLED=false runs entirely from knowledge files — no API key needed

# 3. Start the HTTP API (port 3001)
cd interview-mcp && npm run dev:http

# 4. Start the React dashboard (port 5173) — in a new terminal
cd ../ui && npm run dev

# 5. Connect the MCP servers to Claude Code — add to .mcp.json:
#    see interview-mcp/README.md and report-mcp/README.md for exact config
```

Open **http://localhost:5173** to browse sessions and reports.
Open **http://localhost:5173/graph** to explore the knowledge graph.

---

## Monorepo scripts (from root)

| Script | Description |
|---|---|
| `npm run dev:interview` | Start `interview-mcp` MCP server (stdio) |
| `npm run dev:report` | Start `report-mcp` MCP server (stdio) |
| `npm run dev:ui` | Start `ui` Vite dev server on port 5173 |
| `npm run build` | Build all three compiled packages |
| `npm run build:interview` | Build `interview-mcp` only |
| `npm run build:report` | Build `report-mcp` only |
| `npm run build:ui` | Build `ui` only |

---

## Project goals (study focus)

This is a learning project. Key MCP concepts explored:

- Defining and exposing MCP **tools** with typed schemas (via Zod)
- Managing **session state** across multiple tool calls
- Splitting a growing server into **microservice-style MCP packages**
- Returning structured data (summaries, graphs, scores) from tools
- Connecting Claude Desktop and Claude Code to local MCP servers
- Building a frontend that consumes MCP server data via a REST API
- Using **npm workspaces** to share types without duplication
