# mock-interview-mcp

A study project that runs **mock technical interviews through Claude**, evaluates your answers with AI, and builds a cumulative knowledge graph across sessions — all visualised in a React dashboard.

It is structured as an **npm workspaces monorepo** with four packages and two MCP servers that Claude connects to simultaneously.

---

## What it does

1. **Conducts interviews** — Claude picks questions from curated knowledge files (or generates them with AI), asks them one at a time, follows up, and enforces a strict state machine so the session never gets out of sync.
2. **Evaluates answers** — after each answer, the server scores it (1–5), writes detailed feedback, and surfaces a stronger model answer. Scoring can be done by a background worker LLM or by the orchestrator Claude itself (no API key needed).
3. **Builds a knowledge graph** — every completed session extracts concepts and merges them into a growing graph. Topics, strengths, and gaps accumulate across sessions. The full-screen D3 canvas supports zoom, drag, and one-click cluster filtering to highlight only *core concepts*, *tradeoffs*, etc.
4. **Generates flashcards** — questions you scored below 4 are automatically turned into spaced-repetition flashcards (SM-2 algorithm). Due cards surface daily.
5. **Produces reports** — a Markdown report and an interactive HTML viewer are generated per session, showing scores, feedback, and model answers side-by-side.
6. **Visualises everything** — a React dashboard shows session history, the knowledge graph (D3), report viewer, and a flashcard review UI.

---

## Monorepo structure

```
mock-interview-mcp/
├── interview-mcp/   MCP server — interview state machine, data owner, REST API
├── report-mcp/      MCP server — analytics, report generation, knowledge graph queries
├── ui/              React + Vite dashboard (sessions, graph, reports, flashcards)
└── shared/          TypeScript types only — shared across all packages
```

### Package responsibilities

| Package | Role |
|---|---|
| `interview-mcp` | **Data owner.** Runs the interview, persists sessions, graph, and flashcards in SQLite, serves the REST API on port 3001. |
| `report-mcp` | **Read-mostly analytics.** Reads the shared SQLite database owned by `interview-mcp`, regenerates reports, queries weak subjects, produces the interactive HTML report viewer. |
| `ui` | **Frontend only.** No local data — fetches everything from `interview-mcp`'s REST API via a Vite proxy. |
| `shared` | **Types only.** No runtime code. TypeScript interfaces imported at compile time by the other three packages. |

---

## Architecture

```
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

---

## MCP tools reference

### interview-mcp — 14 tools

This server drives the interview session from start to finish.

| Tool | What it does |
|---|---|
| `server_status` | Preflight check — returns version, loaded topics, session counts, graph size. |
| `help_tools` | Lists all tools with short descriptions and example payloads. |
| `list_topics` | Lists all knowledge topics available for interviews. |
| `start_interview` | Creates a new session, loads questions from a knowledge file (or generates via AI). Returns `sessionId`. |
| `ask_question` | Returns the current question for a session in `ASK_QUESTION` state. |
| `submit_answer` | Records the candidate's answer and advances state to `EVALUATE_ANSWER`. |
| `evaluate_answer` | Scores the answer (1–5), writes feedback and a model answer. Advances to `FOLLOW_UP`. |
| `ask_followup` | Generates and asks a follow-up question based on the candidate's answer. |
| `next_question` | Moves to the next question, or ends the session if all questions are done. |
| `end_interview` | Force-ends the session, builds the Markdown report, merges concepts into the graph, generates flashcards for weak answers. |
| `get_session` | Returns the full session record (state, questions, evaluations, graph). |
| `list_sessions` | Lists all sessions with summary metadata. |
| `get_due_flashcards` | Returns flashcards due for review today (sorted most-overdue first). Supports optional topic filter. |
| `review_flashcard` | Submits a recall rating (1=Again, 2=Hard, 3=Good, 4=Easy) for a card; applies SM-2 and schedules the next review. |

**Session state machine:** `ASK_QUESTION → WAIT_FOR_ANSWER → EVALUATE_ANSWER → FOLLOW_UP` (loops per question) → `ENDED`

### report-mcp — 7 tools

This server is focused on analysing and presenting completed sessions.

| Tool | What it does |
|---|---|
| `server_status` | Preflight check — returns version and AI mode. |
| `help_tools` | Lists all tools with short descriptions and example payloads. |
| `regenerate_report` | Re-runs deeper dives (AI mode) and rewrites the `.md` report for any completed session. |
| `get_report_weak_subjects` | Identifies low-scoring questions and returns structured context, ready to pipe into `generate_report_ui`. |
| `get_report_full_context` | Returns all evaluated Q/A pairs for a session, with a pre-filled `nextCall` scaffold for `generate_report_ui`. |
| `generate_report_ui` | Writes a per-session JSON dataset and returns a viewer URL (`/generated/report-ui.html?sessionId=…`). |
| `get_graph` | Returns the full cumulative knowledge graph from the shared SQLite store. |

---

## REST API (interview-mcp, port 3001)

The UI and `report-mcp` both consume this API.

| Endpoint | Description |
|---|---|
| `GET /api/sessions` | All session records |
| `GET /api/reports` | Report metadata list |
| `GET /api/reports/:id` | Single report Markdown |
| `GET /api/graph` | Full knowledge graph JSON |
| `GET /api/flashcards` | All flashcards |
| `POST /api/flashcards/:id/review` | Submit a review rating `{ rating: 1\|2\|3\|4 }`, applies SM-2, returns updated card |
| `GET /generated/report-ui.html` | Interactive HTML report viewer |

---

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/eliasjunior/interview-mcp-.git
cd interview-mcp-
npm install

# 2. Configure interview-mcp
cp interview-mcp/.env.example interview-mcp/.env
# AI_ENABLED=false runs entirely from knowledge files — no API key needed

# 3. Start the HTTP API (required for the UI)
npm run dev:http

# 4. Start the React dashboard — new terminal
npm run dev:ui
```

Open **http://localhost:5173** to browse sessions and reports.
Open **http://localhost:5173/graph** to explore the knowledge graph.
Open **http://localhost:5173/flashcards** for flashcard review.

### Connecting the MCP servers to Claude

Add both servers to your `.mcp.json` (Claude Desktop) or project `.mcp.json` (Claude Code). See `interview-mcp/README.md` and `report-mcp/README.md` for the exact config blocks.

For `interview-mcp`, prefer the compiled server entrypoint instead of `tsx`:

```json
{
  "mcpServers": {
    "interview-mcp": {
      "command": "/usr/bin/env",
      "args": [
        "node",
        "/Users/eliasjunior/Projects/first-mcp/interview-mcp/dist/server.js"
      ],
      "cwd": "/Users/eliasjunior/Projects/first-mcp/interview-mcp"
    }
  }
}
```

Build the package before reloading Codex/Desktop:

```bash
npm run build:interview
```

After the host reconnects, always run `server_status` first. Only start an interview after that preflight succeeds.

---

## Monorepo scripts

Run these from the repo root.

| Script | Description |
|---|---|
| `npm run dev:interview` | Start `interview-mcp` MCP server (stdio) |
| `npm run dev:http` | Start `interview-mcp` HTTP API on port 3001 |
| `npm run dev:report` | Start `report-mcp` MCP server (stdio) |
| `npm run dev:ui` | Start `ui` Vite dev server on port 5173 |
| `npm run build` | Build all packages |
| `npm run build:interview` | Build `interview-mcp` only |
| `npm run build:report` | Build `report-mcp` only |
| `npm run build:ui` | Build `ui` only |

---

## Knowledge topics

Knowledge files live in `interview-mcp/data/knowledge/*.md`. Current topics:

| File | Topic |
|---|---|
| `jwt.md` | JWT — JSON Web Token |
| `rest-spring-jpa.md` | REST API Design, Spring Boot & JPA |
| `payment-api-design.md` | Payment API Design |
| `url-shortener.md` | URL Shortener System Design |
| `mtls-tls.md` | mTLS / TLS |
| `java-concurrency.md` | Java Concurrency |
| `java-os-jvm.md` | Java, OS & JVM internals |
| `rotate-matrix-algorithm.md` | Rotate Matrix (algorithm) |

Set `AI_ENABLED=true` to let the server generate questions for any topic not in the knowledge base.

---

## Flashcard system

After `end_interview`, the server automatically generates flashcards for any question scored below 4. Cards are stored in `data/app.db` and scheduled with the **SM-2 spaced repetition algorithm**.

A scheduled task (`flashcard-daily-review`) fires every day at **9:00 AM** and prints a summary of due cards grouped by topic.

**Ratings:**

| Rating | Label | Effect |
|---|---|---|
| 1 | Again | Reset: interval=1 day, ease factor −0.2 |
| 2 | Hard | Advance with penalty: ease factor −0.14 |
| 3 | Good | Normal advance: 1 → 6 → interval × ease factor days |
| 4 | Easy | Full advance with ease factor bonus |

---

## Modes

| Mode | How | Cost |
|---|---|---|
| `AI_ENABLED=false` (default) | Questions from knowledge files; orchestrator Claude evaluates using the rubric | Free |
| `AI_ENABLED=true` | Worker LLM (haiku model) generates questions, scores answers, extracts concepts, writes deeper dives | Anthropic API credits |

---

## Extra information

### Two LLMs are in play

When `AI_ENABLED=true`, two separate Claude models are active:

| | Orchestrator | Worker |
|---|---|---|
| **What** | Claude inside Claude Desktop/Code | Claude via Anthropic API (`src/ai/`) |
| **Job** | Drives the conversation, decides which tools to call | Generates questions, scores answers, extracts concepts |
| **We control it?** | No — it's the host | Yes — it's our `AIProvider` |

The worker LLM uses the `claude-haiku-4-5-20251001` model (low latency, called multiple times per turn).

### What MCP actually is

MCP (Model Context Protocol) is a standardised JSON protocol over stdio. Claude Desktop spawns each MCP server as a child process and communicates by writing JSON to its stdin and reading responses from its stdout — no HTTP, no WebSocket. Claude decides when to call a tool; the server owns state and returns structured data.

### Shared types

All domain types live in `shared/src/types.ts` and are imported as `@mock-interview/shared`. Never add a local `types.ts` to any package.

### Storage

Runtime state lives in SQLite (`interview-mcp/data/app.db`). Knowledge source files and generated report artifacts remain in `interview-mcp/data/` and `interview-mcp/public/generated/`.
