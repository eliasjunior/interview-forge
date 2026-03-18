# report-mcp

A **Model Context Protocol (MCP) server** focused on analytics and reporting for completed interview sessions. It reads the shared data written by `interview-mcp` and exposes tools for regenerating reports, querying the knowledge graph, and producing interactive HTML report UIs.

> **Monorepo:** this package is one of four. See the [root README](../README.md) for the full picture.
> Related: [interview-mcp](../interview-mcp/README.md) · [ui](../ui/README.md) · [shared](../shared/README.md)

---

## What it does

1. **Regenerates Markdown reports** for any completed session — useful after editing knowledge files or prompt tuning.
2. **Queries weak subjects** — identifies low-scoring questions and surfaces them as a structured report context.
3. **Builds full report context** — returns all evaluated Q/A pairs formatted for the dynamic report viewer.
4. **Generates interactive HTML report UIs** — writes a per-session JSON dataset and returns a viewer URL served by `interview-mcp`'s HTTP server.
5. **Queries the knowledge graph** — returns the full cumulative concept graph built across all sessions.

---

## Architecture

```
report-mcp/
├── src/
│   ├── server.ts           # MCP bootstrap/composition root
│   ├── reportUtils.ts      # Pure report-building utilities
│   ├── tools/              # One file per MCP tool + registerAllTools
│   └── ai/                 # AIProvider port + Anthropic adapter + caching decorator
└── .env                    # ANTHROPIC_API_KEY + AI_ENABLED (not committed)
```

**Data access:** `report-mcp` does not own runtime data. It reads from the shared SQLite database in `interview-mcp/data/app.db` and writes report artifacts to `interview-mcp/data/` and `interview-mcp/public/` (configurable via `DATA_DIR` and `PUBLIC_DIR` env vars). This keeps the data layer in a single place owned by `interview-mcp`.

```
interview-mcp/data/
├── app.db            ← report-mcp reads sessions + graph from this
├── reports/          ← report-mcp writes .md files here (regenerate_report)
└── knowledge/        ← report-mcp does not touch this
```

> **Shared types** live in `../shared/src/types.ts` (`@mock-interview/shared`). Do not add a local `types.ts`.

---

## Tools

The server exposes **7 MCP tools**.

| Tool | Description |
|---|---|
| `server_status` | Returns version and current AI mode. |
| `help_tools` | Lists all tools with short descriptions and example payloads. |
| `regenerate_report` | Re-runs `generateDeeperDives` (AI mode) and rewrites the `.md` report for a completed session. |
| `get_report_weak_subjects` | Identifies low-scoring questions for a session and returns structured context plus a `nextCall` scaffold for `generate_report_ui`. |
| `get_report_full_context` | Returns all evaluated Q/A pairs for a session plus a `nextCall` scaffold for `generate_report_ui`. |
| `generate_report_ui` | Writes a per-session JSON dataset to `interview-mcp/data/public/generated/` and returns a viewer URL. |
| `get_graph` | Returns the full cumulative knowledge graph from the shared SQLite store. |

### Dynamic Report Viewer Flow

1. Call `get_report_full_context` (or `get_report_weak_subjects`) with a `sessionId`.
2. The response includes a `nextCall` object pre-filled with all questions — fill each `strongAnswer` field (max 3 lines).
3. Call `generate_report_ui` with `sessionId + questions`.
4. Open the returned URL: `http://localhost:3001/generated/report-ui.html?sessionId=<sessionId>`.

The report page is reusable — session content lives in the per-session JSON dataset, not in the HTML.

### Example (JWT session)

```json
// Step 1 — get context
{ "tool": "get_report_full_context", "arguments": { "sessionId": "1772743307856-xe3eld" } }

// Step 2 — fill strongAnswer in each question, then:
{ "tool": "generate_report_ui", "arguments": {
    "sessionId": "1772743307856-xe3eld",
    "title": "Full Report — JWT authentication",
    "questions": [/* questions with strongAnswer filled */]
  }
}

// Step 3 — open in browser:
// http://localhost:3001/generated/report-ui.html?sessionId=1772743307856-xe3eld
```

---

## Pure Utilities (`reportUtils.ts`)

Side-effect-free functions used by the report tools.

| Function | Description |
|---|---|
| `calcAvgScore(evaluations)` | Returns average score as a formatted string (e.g. `"3.6"`) |
| `buildSummary(session)` | Short Markdown summary with score breakdown per question |
| `buildReport(session)` | Full Markdown report: header table, per-question sections, deeper dives, concepts, transcript |
| `escapeHtml(str)` | Escapes `< > & " '` for safe inline HTML injection |
| `serializeForInlineScript(data)` | JSON-serialises data for embedding in `<script>` tags |
| `countLines(str)` | Returns the number of lines in a string |
| `pickSessionByTopic(sessions, topic)` | Finds the most recent completed session for a given topic |
| `extractWeakSubjects(session)` | Returns questions with score ≤ 3, sorted by score ascending |
| `buildFullQuestionContext(session)` | Maps all evaluations to a structured context array for the report viewer |

---

## The Anthropic API (`src/ai/`)

Used only by `regenerate_report` (to re-run `generateDeeperDives`). The same `AIProvider` port/adapter pattern as `interview-mcp` — swap the implementation in `src/ai/index.ts` to change the model without touching tool logic.

Set `AI_ENABLED=false` to disable API calls entirely. In this mode `regenerate_report` will skip deeper-dive generation and only rebuild the static parts of the report.

---

## Dependencies

| Package | Role |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server primitives |
| `@anthropic-ai/sdk` | Anthropic client — used in `src/ai/` for `regenerate_report` |
| `@mock-interview/shared` | Shared TypeScript types (workspace package — no runtime cost) |
| `zod` | Runtime schema validation for MCP tool input parameters |
| `dotenv` | Loads `ANTHROPIC_API_KEY` and `DATA_DIR` from `.env` |
| `tsx` | Runs TypeScript directly without a compile step (dev only) |
| `typescript` | Type checking and build |

---

## Setup

```bash
# From monorepo root — installs all workspaces
npm install

# Create .env inside report-mcp/
cat > report-mcp/.env << 'EOF'
# Anthropic key — only needed if AI_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-...

# Point to interview-mcp's data directory (default shown)
# DATA_DIR=../interview-mcp/data
# PUBLIC_DIR=../interview-mcp/public

# Set to false to skip AI calls in regenerate_report
AI_ENABLED=false
EOF

# Run the MCP server (stdio — for Claude Desktop / Claude Code)
npm run dev:report
```

### Connecting to Claude Code

Add to `.mcp.json` in the monorepo root alongside `interview-mcp`:

```json
{
  "mcpServers": {
    "interview-mcp": {
      "command": "/path/to/node_modules/.bin/tsx",
      "args": ["/path/to/interview-mcp/src/server.ts"]
    },
    "report-mcp": {
      "command": "/path/to/node_modules/.bin/tsx",
      "args": ["/path/to/report-mcp/src/server.ts"]
    }
  }
}
```

> **Note:** Do not set `ANTHROPIC_API_KEY` in the `env` block — Claude Code injects it as an empty string which prevents `dotenv` from loading the `.env` value.

---

## Data Flow

```
Claude (orchestrator)
    │  MCP tools over stdio
    ▼
report-mcp/server.ts
    │
    ├── reads ──► interview-mcp/data/app.db
    │
    │  regenerate_report (AI_ENABLED=true)
    ├── ai/ ──► Anthropic API (generateDeeperDives)
    │
    ├── writes ──► interview-mcp/data/reports/{id}.md
    │
    │  generate_report_ui
    └── writes ──► interview-mcp/public/generated/{id}-report-ui.json
                        │  served by interview-mcp's HTTP server
                        ▼
               http://localhost:3001/generated/report-ui.html?sessionId=...
```
