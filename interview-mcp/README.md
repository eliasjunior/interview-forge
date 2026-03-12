# interview-mcp

A **Model Context Protocol (MCP) server** that conducts mock technical interviews, evaluates answers with AI, enforces a session state machine, and exposes a REST API consumed by the rest of the monorepo.

> **Monorepo:** this package is one of four. See the [root README](../README.md) for the full picture.
> Related: [report-mcp](../report-mcp/README.md) · [ui](../ui/README.md) · [shared](../shared/README.md)

---

## How MCP works — the big picture

Before diving into the code, it helps to understand what MCP is and how the different pieces talk to each other.

### The three layers

```
┌─────────────────────────────────────────────────────┐
│                    YOU (the user)                   │
│              typing in Claude Desktop               │
└────────────────────────┬────────────────────────────┘
                         │ chat (natural language)
                         ▼
┌─────────────────────────────────────────────────────┐
│              HOST — Claude Desktop                  │
│                                                     │
│  • Runs Claude (sonnet/opus) as the conversation    │
│    brain — this is the "orchestrator" LLM           │
│  • Reads .mcp.json on startup                       │
│  • Spawns MCP servers as subprocesses               │
│  • Decides WHEN to call which tool                  │
│  • Stitches tool results back into conversation     │
└────────────────────────┬────────────────────────────┘
                         │ ▼ tool calls  (JSON over stdio)
                         │ ▲ data back   — not HTTP, not WebSocket —
                         │               just stdin/stdout of a child process
                         ▼
┌─────────────────────────────────────────────────────┐
│           MCP SERVER — our server.ts                │
│                                                     │
│  • A plain Node.js process, no web server           │
│  • Exposes named tools with typed schemas           │
│  • Returns structured data in every response        │
│  • Owns all shared state (sessions.json, graph.json)│
│  • Enforces the interview state machine             │
│  • Optionally calls the AI API for the LLM work     │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS (Anthropic SDK / Ollama / …)
                         ▼
┌─────────────────────────────────────────────────────┐
│           WORKER LLM — Anthropic API / local        │
│                                                     │
│  • Generates questions, evaluates answers,          │
│    extracts concepts, writes deeper dives           │
│  • Stateless — no memory between calls              │
│  • Swappable: the AIProvider port abstracts this    │
└─────────────────────────────────────────────────────┘
```

### There are two LLMs — not one

This is the key insight. Two completely separate AI models are in play during every interview:

| | Orchestrator | Worker |
|---|---|---|
| **Who** | Claude inside Claude Desktop | Claude via Anthropic API (our `src/ai/`) |
| **Job** | Runs the conversation, decides which tools to call, formats responses for you | Generates questions, scores answers, extracts concepts |
| **Knows about** | The MCP tool schemas | Nothing — stateless, just prompt-in / JSON-out |
| **We control it?** | No — it is the HOST | Yes — it is our `AIProvider` |
| **Paid by** | Your Claude Desktop subscription | Your Anthropic API credits |

This is why the project can run out of API credits even though you have a Claude Desktop subscription — the orchestrator is covered by your subscription, but our server makes **separate** API calls on your personal key for every evaluation, question generation, and concept extraction.

> **The Worker LLM is optional.** Set `AI_ENABLED=false` in `.env` to run entirely from local knowledge files at zero API cost. In this mode the orchestrator Claude still drives the interview — it just evaluates answers itself using the rubric provided by the server, instead of delegating to the Worker. See [Modes](#modes) for details.

### What MCP actually is

MCP is a **standardised JSON protocol over stdio**. When Claude Desktop decides to call a tool, it writes a message to our server's stdin:

```json
{ "method": "tools/call", "params": { "name": "start_interview", "arguments": { "topic": "JWT" } } }
```

Our `server.ts` reads it, runs the handler, and writes the result back to stdout:

```json
{ "result": { "content": [{ "type": "text", "text": "{\"sessionId\": \"123\", ...}" }] } }
```

The `@modelcontextprotocol/sdk` package handles this wire format — we just register handlers with `server.tool(name, description, schema, handler)` and never touch raw JSON.

### A single turn end-to-end

```
You: "Start an interview on JWT"
  │
  ▼  orchestrator Claude decides to call a tool
HOST → server.ts:   tools/call  start_interview { topic: "JWT" }
  │
  ▼  our server calls the worker LLM
server.ts → Anthropic API:  "Generate 5 JWT questions" → ["Q1" … "Q5"]
  │
  ▼  our server responds to the host
server.ts → HOST:   { sessionId: "123", totalQuestions: 5, nextTool: "ask_question" }
  │
  ▼  orchestrator Claude formats the result for you
HOST → You:  "Great! Here is your first question: What is JWT and why does it exist?"
```

### Why the AIProvider port matters

The Worker LLM is the only part that costs money and requires an internet connection. Because `server.ts` only ever talks to the `AIProvider` interface — never to Anthropic directly — you can swap it for a local model (Ollama, llama.cpp, …) by changing a single file (`src/ai/index.ts`) without touching any business logic.

---

## What it does

1. **Runs a structured mock interview** — generates topic-specific questions, evaluates each answer with a score (1–5), and optionally asks follow-up questions.
2. **Produces a Markdown report** at the end of every session, including per-question scores, AI feedback, and "where to go deeper" bullet points.
3. **Builds a knowledge graph** across all sessions — concepts from every interview are merged into a growing graph of nodes and edges.
4. **Exposes a REST API** on port 3001 consumed by `report-mcp` and the `ui` dashboard.

---

## Architecture

```
interview-mcp/
├── src/
│   ├── server.ts           # MCP bootstrap/composition root
│   ├── http.ts             # Express HTTP server — REST API on port 3001
│   ├── tools/              # One file per MCP tool + registerAllTools
│   ├── ai/                 # AIProvider port + Anthropic adapter + caching decorator
│   ├── knowledge/          # FileKnowledgeStore — reads data/knowledge/*.md
│   └── interviewUtils.ts   # Pure utilities: state guards, report builder, graph merge, summary
├── data/
│   ├── sessions.json       # All session records (persisted after every state change)
│   ├── graph.json          # Cumulative knowledge graph
│   ├── reports/            # One .md report file per completed session
│   └── knowledge/          # Curated topic files — committed to git
│       ├── java-concurrency.md
│       ├── java-os-jvm.md
│       ├── mtls-tls.md
│       ├── rest-spring-jpa.md
│       ├── payment-api-design.md
│       └── …               # Add more to expand coverage
└── .env                    # ANTHROPIC_API_KEY + AI_ENABLED (not committed)
```

> **Shared types** live in `../shared/src/types.ts` (`@mock-interview/shared`). Do not add a local `types.ts`.

---

## The MCP Server (`server.ts`)

The entry point acts as a **composition/bootstrap root**: it wires shared dependencies, then registers tools from `src/tools/`.

The server exposes **12 MCP tools** and enforces a **state machine** so interview flow stays valid.

### State Machine

Every session has exactly one state at a time. Tools are only valid in certain states — calling the wrong tool returns an error with the list of currently valid tools.

```
start_interview
      ↓
 ASK_QUESTION ──ask_question──► WAIT_FOR_ANSWER
      ↑                                │
      │                          submit_answer
      │                                ↓
 (more Qs)                    EVALUATE_ANSWER
      │                                │
 next_question ◄── FOLLOW_UP ◄─ evaluate_answer
      │                │
      │           ask_followup
      │                │
      │          WAIT_FOR_ANSWER (follow-up loop)
      │
 ASK_QUESTION … repeat …
      │
 (no more Qs) ──► ENDED
```

The LLM cannot skip or re-order steps — the server enforces the flow regardless of what the model attempts.

### Tools

| Tool | Valid state(s) | Description |
|---|---|---|
| `server_status` | — | Returns version and current AI mode. |
| `help_tools` | — | Lists all tools with short descriptions and example payloads. |
| `start_interview` | — | Creates a session. Loads questions from a knowledge file if the topic is known; falls back to AI generation if `AI_ENABLED=true`. Returns a session ID. |
| `ask_question` | `ASK_QUESTION` | Presents the current question. Also returns `evaluationCriteria` from the knowledge file so the orchestrator can evaluate without AI. |
| `submit_answer` | `WAIT_FOR_ANSWER` | Records the candidate's answer. |
| `evaluate_answer` | `EVALUATE_ANSWER` | **AI mode:** scores 1–5 via Anthropic and generates follow-up. **File-only mode:** the orchestrator must supply `score`, `feedback`, and `needsFollowUp` directly. |
| `ask_followup` | `FOLLOW_UP` | Asks the follow-up question. |
| `next_question` | `FOLLOW_UP` | Advances to the next question, or ends the interview if done. |
| `end_interview` | any active state | Force-ends the session and runs finalization. |
| `get_session` | any | Returns the full session object (transcript, evaluations, state). |
| `list_sessions` | any | Lists all sessions with topic, state, progress, and average score. |
| `list_topics` | any | Lists curated knowledge-file topics available for zero-cost interviews. |

> Report and graph tools (`regenerate_report`, `get_graph`, `get_report_*`, `generate_report_ui`) live in **[report-mcp](../report-mcp/README.md)**.

### Session Finalization

When an interview ends (via `next_question` completing all questions, or `end_interview`), the server runs `finalizeSession()`:

1. Calls `extractConcepts` and `generateDeeperDives` **in parallel** via `Promise.all`
2. Attaches deeper-dive bullet points to each evaluation
3. Computes the session summary and average score
4. Persists the updated session to `data/sessions.json`
5. Merges new concepts into `data/graph.json`
6. Writes the Markdown report to `data/reports/{sessionId}.md`

### Storage

All data is stored as local JSON files in `data/`. No database required.

- **`sessions.json`** — keyed by session ID, written after every state change
- **`graph.json`** — cumulative graph, merged after every completed session
- **`reports/{id}.md`** — one Markdown report per completed session

This `data/` directory is the **shared data layer** for the whole monorepo. `report-mcp` points its data paths here (configurable via `DATA_DIR` env var).

---

## The HTTP Server (`http.ts`)

A standalone Express server on **port 3001**. Runs separately from the MCP server — start it with `npm run dev:http` from the monorepo root, or `npm run dev:ui` from inside this package directly.

This is the data API consumed by the `ui` React app and `report-mcp`'s dynamic report viewer.

### Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/graph` | Returns `graph.json` — the full knowledge graph |
| `GET /api/sessions` | Returns all sessions as an array |
| `GET /api/reports` | Lists all report files with topic, average score, and date |
| `GET /api/reports/:id` | Returns the raw Markdown for a single report |
| `GET /api/debug/deeper-dives/:id` | Dev tool: calls `generateDeeperDives` for a session and returns the result |
| `GET /generated/report-ui.html?sessionId=...` | Reusable dynamic report viewer (served for `report-mcp`) |
| `GET /generated/:sessionId-report-ui.json` | JSON dataset written by `report-mcp`'s `generate_report_ui` tool |

---

## The Anthropic API (`src/ai/`)

All calls to the Anthropic API are isolated here. The client is lazily initialized — it only instantiates when the first API call is made, so a missing key doesn't crash the server at startup.

**Model:** `claude-haiku-4-5-20251001` — chosen for low latency and cost since it is called multiple times per interview turn.

### API calls

#### `generateQuestions(topic)`
Sends a single request asking for 5 progressive interview questions as a JSON array. Questions escalate from broad/conceptual to specific/advanced. **Fallback:** returns 5 hardcoded template questions with the topic filled in.

#### `evaluateAnswer(question, answer)`
Scores the candidate's answer on a 1–5 scale. Returns: `score`, `feedback` (one specific sentence), `needsFollowUp` (true if score ≤ 3), and an optional `followUpQuestion`. **Fallback:** scores based on answer word count.

#### `extractConcepts(topic, transcript)`
Reads the full interview transcript and extracts 10–20 key technical concepts, each assigned to one of four clusters: `core concepts`, `practical usage`, `tradeoffs`, `best practices`. A concept can appear in multiple clusters. **Fallback:** keyword scan of the transcript.

#### `generateDeeperDives(topic, evaluations)`
**Single batch call** — sends all questions, answers, scores, and feedback together. Returns one markdown string per evaluation: 3–5 bullet points in `- **concept** → explanation` format. `max_tokens: 4000` to handle up to ~10 questions. **On error:** returns the error message in slot 0.

---

## Pure Utilities (`interviewUtils.ts`)

Side-effect-free functions used across `server.ts` and `http.ts`.

| Function | Description |
|---|---|
| `assertState(session, toolName)` | Guards a tool call — returns `{ ok: false, error }` if the tool is invalid for the session's current state |
| `generateId()` | Returns a timestamp-based unique session ID |
| `findLast(arr, pred)` | Polyfill for `Array.findLast` (ES2023) |
| `calcAvgScore(evaluations)` | Returns average score as a formatted string (e.g. `"3.6"`) |
| `buildTranscript(session)` | Formats all messages as `ROLE: content` text |
| `buildSummary(session)` | Short Markdown summary with score breakdown per question |
| `buildReport(session)` | Full Markdown report: header table, per-question sections, deeper dives, concepts, transcript |
| `mergeConceptsIntoGraph(graph, concepts, sessionId)` | Merges new concepts into the graph — adds nodes, increments edge weights, records session |

---

## Dependencies

| Package | Role |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server primitives (`McpServer`, `StdioServerTransport`, tool registration) |
| `@anthropic-ai/sdk` | Official Anthropic client — used in `src/ai/` to call `messages.create` |
| `@mock-interview/shared` | Shared TypeScript types (workspace package — no runtime cost) |
| `zod` | Runtime schema validation for MCP tool input parameters |
| `express` | HTTP server for the REST API |
| `cors` | CORS middleware for the Express server |
| `dotenv` | Loads `ANTHROPIC_API_KEY` from `.env` |
| `tsx` | Runs TypeScript directly without a compile step (dev only) |
| `typescript` | Type checking and build |

---

## Setup

```bash
# From monorepo root — installs all workspaces
npm install

# Create .env inside interview-mcp/
cat > interview-mcp/.env << 'EOF'
# Get your key at https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Set to false to use knowledge files only (no API cost).
# Set to true (or remove this line) to enable Anthropic for question generation and evaluation.
AI_ENABLED=false
EOF

# Run the MCP server (stdio — for Claude Desktop / Claude Code)
npm run dev:interview

# Run the HTTP API server (port 3001)
npm run dev:http   # from monorepo root  — or —  cd interview-mcp && npm run dev:ui
```

### Connecting to Claude Code

Add to `.mcp.json` in the monorepo root:

```json
{
  "mcpServers": {
    "interview-mcp": {
      "command": "/path/to/node_modules/.bin/tsx",
      "args": ["/path/to/interview-mcp/src/server.ts"]
    }
  }
}
```

> **Note:** Do not set `ANTHROPIC_API_KEY` in the `env` block — Claude Code injects it as an empty string which prevents `dotenv` from loading the `.env` value. Let the server load it via `dotenv` instead.

---

## Modes

The server has two operating modes, controlled by a single line in `.env`. **No code changes needed — just edit `.env` and restart the MCP server.**

### `AI_ENABLED=false` — Knowledge-files-only mode (default)

| What changes | Detail |
|---|---|
| **Zero API cost** | No calls to Anthropic. The `ANTHROPIC_API_KEY` is still read from `.env` but never used. |
| **Questions** | Loaded from `data/knowledge/<topic>.md`. Only topics with a matching file are available. |
| **Evaluation** | The orchestrator Claude scores the answer using the `evaluationCriteria` returned by `ask_question`. It must pass `score`, `feedback`, and `needsFollowUp` when calling `evaluate_answer`. |
| **Concept extraction** | Skipped — no concepts are added to the graph after the session. |
| **Deeper dives** | Not generated — the report section will be empty. |
| **Unknown topics** | `start_interview` returns an error listing the available topics. |

### `AI_ENABLED=true` — Full AI mode

| What changes | Detail |
|---|---|
| **API calls** | Every evaluation, question generation, concept extraction, and deeper dive calls Anthropic. |
| **Questions** | Loaded from a knowledge file if the topic is known; **AI-generated** for any other topic. |
| **Evaluation** | The Worker LLM (Anthropic) scores the answer and generates follow-up questions. The orchestrator does not need to supply scores. |
| **Concept extraction** | Runs after the session ends and populates the knowledge graph. |
| **Deeper dives** | Generated as part of the final report. |
| **Unknown topics** | Any topic works — the AI generates 5 questions on the fly. |

### Switching modes

1. Edit `AI_ENABLED` in `interview-mcp/.env`
2. Restart the MCP server process (in Claude Code: `/mcp` → disconnect + reconnect, or restart the terminal running `npm run dev`)
3. The startup log confirms the active mode: `interview-mcp v0.2.0 — mode: knowledge files only`

### Knowledge files

Knowledge files live in `data/knowledge/*.md` and are committed to git. Each file covers one topic and provides:

- **Questions** — 5 progressive interview questions
- **Evaluation criteria** — per-question rubric used in file-only mode
- **Concepts** — pre-defined clusters used for the knowledge graph

To add a new topic in file-only mode, create a new `.md` file following the format of an existing one (e.g. `java-concurrency.md`) and restart the server.

---

## Data Flow (end-to-end)

**AI mode (`AI_ENABLED=true`):**

```
Claude (orchestrator)
    │  MCP tools over stdio
    ▼
server.ts  ──── state machine ────► sessions.json
    │        │
    │        └── knowledge/  ◄─── data/knowledge/*.md  (questions + criteria)
    │
    │  on finalize
    ├── ai/ ──► Anthropic API
    │   ├── extractConcepts
    │   └── generateDeeperDives
    │
    ├──────────────────────────────► graph.json
    └──────────────────────────────► reports/{id}.md

http.ts (port 3001) ◄──── data/ ──── ui / report-mcp
```

**File-only mode (`AI_ENABLED=false`):**

```
Claude (orchestrator)
    │  MCP tools over stdio          ┌── evaluates answer itself
    ▼                                │   using evaluationCriteria
server.ts  ──── state machine ────► │   from ask_question response
    │        │
    │        └── knowledge/  ◄─── data/knowledge/*.md  (questions + criteria)
    │
    │  on finalize (no AI calls)
    ├──────────────────────────────► sessions.json
    └──────────────────────────────► reports/{id}.md  (no deeper dives)

http.ts (port 3001) ◄──── data/ ──── ui / report-mcp
```
