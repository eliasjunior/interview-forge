# Architecture

[← Back to README](../README.md)

## Monorepo structure

```text
interview-forge/
├── interview-mcp/   MCP server — interview state machine, data owner, REST API
├── report-mcp/      MCP server — analytics, report generation, knowledge graph queries
├── ui/              React + Vite dashboard (topics, sessions, graph, reports, flashcards)
└── shared/          TypeScript types only — shared across all packages
```

## Package responsibilities

| Package | Role |
|---|---|
| `interview-mcp` | **Data owner.** Runs the interview, persists sessions, graph, and flashcards in SQLite, serves the REST API on port 3001. |
| `report-mcp` | **Read-mostly analytics.** Reads the shared SQLite database owned by `interview-mcp`, regenerates reports, queries weak subjects, produces the interactive HTML report viewer. |
| `ui` | **Frontend only.** No local data — fetches everything from `interview-mcp`'s REST API via a Vite proxy. |
| `shared` | **Types only.** No runtime code. TypeScript interfaces imported at compile time by the other three packages. |

## System diagram

```text
┌──────────────────────┐
│   You (the user)     │
│   Claude Desktop /   │
│   Claude Code        │
└──────┬───────────────┘
       │  natural language
       ▼
┌──────────────────────┐     stdio (MCP)     ┌─────────────────────────┐
│  Claude (orchestrator│ ──────────────────► │  interview-mcp          │
│  LLM)                │                    │  state machine + data   │
│                      │ ──────────────────► │  report-mcp             │
└──────────────────────┘     stdio (MCP)     │  analytics + reports    │
                                             └────────────┬────────────┘
                                                          │
                                             interview-mcp/data/
                                              (app.db, reports/)
                                                          │
                                             ┌────────────▼────────────┐
                                             │  interview-mcp          │
                                             │  HTTP API  :3001        │
                                             └────────────┬────────────┘
                                                          │  fetch /api/*
                                             ┌────────────▼────────────┐
                                             │  ui  :5173              │
                                             │  React dashboard        │
                                             └─────────────────────────┘
```

**Data ownership:** `interview-mcp` is the single source of truth for runtime data in `interview-mcp/data/app.db`. `report-mcp` reads from that database and writes reports back to `interview-mcp/data/` — its path is configurable via `DATA_DIR`.

## Two LLMs are in play

When `AI_ENABLED=true`, two separate Claude models are active:

| | Orchestrator | Worker |
|---|---|---|
| **What** | Claude inside Claude Desktop/Code | Claude via Anthropic API (`src/ai/`) |
| **Job** | Drives the conversation, decides which tools to call | Generates questions, scores answers, extracts concepts |
| **We control it?** | No — it's the host | Yes — it's our `AIProvider` |

The worker LLM uses the `claude-haiku-4-5-20251001` model (low latency, called multiple times per turn).

## What MCP actually is

MCP (Model Context Protocol) is a standardised JSON protocol over stdio. Claude Desktop spawns each MCP server as a child process and communicates by writing JSON to its stdin and reading responses from its stdout — no HTTP, no WebSocket. Claude decides when to call a tool; the server owns state and returns structured data.

## Shared types

All domain types live in `shared/src/types.ts` and are imported as `@mock-interview/shared`. Never add a local `types.ts` to any package.

## Storage

Runtime state lives in SQLite (`interview-mcp/data/app.db`). Knowledge source files and generated report artifacts remain in `interview-mcp/data/` and `interview-mcp/public/generated/`.
