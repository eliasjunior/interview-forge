# interview-mcp

A **Model Context Protocol (MCP) server** that conducts mock technical interviews, evaluates answers with AI, and builds an evolving knowledge graph from every session.

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
│    (questions, criteria, sessions, graph, scores)   │
│  • Owns all state (sessions.json, graph.json)       │
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
4. **Visualizes the graph** in a browser via a D3.js neural map served on `localhost:3001`.

---

## Architecture

```
interview-mcp/
├── src/
│   ├── server.ts           # MCP bootstrap/composition root
│   ├── http.ts             # Express HTTP server — neural map frontend + REST API
│   ├── tools/              # One file per MCP tool + registerAllTools
│   ├── ai/                 # Anthropic API integration (questions, evaluation, concepts, dives)
│   ├── knowledge/          # FileKnowledgeStore — reads data/knowledge/*.md
│   ├── interviewUtils.ts   # Pure utilities: state guards, report builder, graph merge, summary
│   └── types.ts            # Shared TypeScript types
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
├── public/
│   ├── index.html          # D3.js neural map (single-file frontend)
│   └── generated/          # Dynamic report viewer + per-session JSON datasets
└── .env                    # ANTHROPIC_API_KEY + AI_ENABLED (not committed)
```

---

## The MCP Server (`server.ts`)

The entry point now acts as a **composition/bootstrap root**: it wires shared dependencies, then registers tools from `src/tools/`.

The server exposes **16 MCP tools** to any connected LLM client and enforces a **state machine** so interview flow stays valid.

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
| `help_tools` | — | Lists all tools with short descriptions and example payloads. |
| `start_interview` | — | Creates a session. Loads questions from a knowledge file if the topic is known; falls back to AI generation if `AI_ENABLED=true`. Returns a session ID. |
| `ask_question` | `ASK_QUESTION` | Presents the current question. Also returns `evaluationCriteria` from the knowledge file so the orchestrator can evaluate without AI. |
| `submit_answer` | `WAIT_FOR_ANSWER` | Records the candidate's answer. |
| `evaluate_answer` | `EVALUATE_ANSWER` | **AI mode:** scores 1–5 via Anthropic and generates follow-up. **File-only mode:** the orchestrator must supply `score`, `feedback`, and `needsFollowUp` directly. |
| `ask_followup` | `FOLLOW_UP` | Asks the follow-up question. |
| `next_question` | `FOLLOW_UP` | Advances to the next question, or ends the interview if done. |
| `end_interview` | any active state | Force-ends the session and runs finalization. |
| `regenerate_report` | `ENDED` | Re-runs deeper dives and rewrites the `.md` report for a past session. |
| `get_session` | any | Returns the full session object (transcript, evaluations, state). |
| `list_sessions` | any | Lists all sessions with topic, state, progress, and average score. |
| `list_topics` | any | Lists curated knowledge-file topics available for zero-cost interviews. |
| `get_graph` | any | Returns the full cumulative knowledge graph. |
| `get_report_weak_subjects` | any | Returns weak-question report context plus `nextCall` scaffold for `generate_report_ui`. |
| `get_report_full_context` | any | Returns full report context (all evaluated Q/A) plus `nextCall` scaffold for `generate_report_ui`. |
| `generate_report_ui` | any | Writes a per-session JSON report dataset and returns a reusable viewer URL (`report-ui.html?sessionId=...`). |

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

---

## The Anthropic API (`ai.ts`)

All calls to the Anthropic API are isolated in `ai.ts`. The client is lazily initialized — it only instantiates when the first API call is made, so a missing key doesn't crash the server at startup.

**Model:** `claude-haiku-4-5-20251001` — chosen for low latency and cost since it's called multiple times per interview turn.

### API calls

#### `generateQuestions(topic)`
- Sends a single request asking for 5 progressive interview questions as a JSON array.
- Questions escalate from broad/conceptual to specific/advanced.
- **Fallback:** if the API call fails, returns 5 hardcoded template questions with the topic filled in.

#### `evaluateAnswer(question, answer)`
- Scores the candidate's answer on a 1–5 scale.
- Returns: `score`, `feedback` (one specific sentence), `needsFollowUp` (true if score ≤ 3), and an optional `followUpQuestion`.
- **Fallback:** scores based on answer word count if the API call fails.

#### `extractConcepts(topic, transcript)`
- Reads the full interview transcript and extracts 10–20 key technical concepts.
- Each concept is assigned to one of four clusters: `core concepts`, `practical usage`, `tradeoffs`, `best practices`.
- A concept can appear in multiple clusters.
- **Fallback:** scans the transcript for keyword matches to produce a minimal concept list.

#### `generateDeeperDives(topic, evaluations)`
- **Single batch call** — sends all questions, answers, scores, and feedback together.
- Returns one markdown string per evaluation: 3–5 bullet points in `- **concept** → explanation` format.
- Focuses on low-scoring questions but includes advanced topics for high scores too.
- `max_tokens: 4000` to handle up to ~10 questions with full bullet points.
- **On error:** returns the error message in slot 0 so it's visible in the tool response.

---

## The HTTP Server (`http.ts`)

A standalone Express server on **port 3001**. Runs separately from the MCP server and can hot-reload during development.

### Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Serves the neural map frontend (`public/index.html`) |
| `GET /api/graph` | Returns `graph.json` — the full knowledge graph |
| `GET /api/sessions` | Returns all sessions as an array |
| `GET /api/reports` | Lists all report files with topic, average score, and date |
| `GET /api/reports/:id` | Returns the raw Markdown for a single report |
| `GET /api/debug/deeper-dives/:id` | Dev tool: calls `generateDeeperDives` for a session and returns the result |
| `GET /generated/report-ui.html?sessionId=...` | Reusable dynamic report viewer (client-side rendering from JSON) |
| `GET /generated/:sessionId-report-ui.json` | JSON dataset generated by `generate_report_ui` |

### Dynamic Report Viewer Flow

1. Call `get_report_full_context` (or `get_report_weak_subjects`).
2. Fill each `strongAnswer` (max 3 lines).
3. Call `generate_report_ui` with `sessionId + questions`.
4. Open `http://localhost:3001/generated/report-ui.html?sessionId=<sessionId>`.

This keeps report rendering dynamic: the page is reusable, and session content lives in JSON.

### Quick Commands (JWT Example)

Use these in sequence for session `1772743307856-xe3eld`:

```json
{ "tool": "get_report_full_context", "arguments": { "sessionId": "1772743307856-xe3eld" } }
```

Take the returned `nextCall.arguments`, replace each `strongAnswer: "TODO: max 3 lines"`, then call:

```json
{ "tool": "generate_report_ui", "arguments": { "sessionId": "1772743307856-xe3eld", "title": "Full Report — JWT authentication", "questions": [/* filled strongAnswer values */] } }
```

Open:

```text
http://localhost:3001/generated/report-ui.html?sessionId=1772743307856-xe3eld
```

---

## The Neural Map (`public/index.html`)

A self-contained D3.js force-directed graph visualization.

- **Nodes** = concepts extracted from completed interviews
- **Edges** = co-occurrence within the same cluster (thicker = more sessions reinforced it)
- **Clusters** = color-coded groups (`core concepts`, `practical usage`, `tradeoffs`, `best practices`)
- Convex hull outlines visually group nodes by cluster
- Nodes that appear in multiple clusters are shared across groups
- Cluster centroids are pre-positioned to reduce overlap
- **Interactions:** zoom/pan, click a node to highlight its neighbors, click a cluster in the legend to collapse/expand it

---

## Pure Utilities (`interviewUtils.ts`)

Side-effect-free functions shared across `server.ts` and `http.ts`.

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
| `@anthropic-ai/sdk` | Official Anthropic client — used in `ai.ts` to call `messages.create` |
| `zod` | Runtime schema validation for MCP tool input parameters |
| `express` | HTTP server for the neural map and REST API |
| `cors` | CORS middleware for the Express server |
| `dotenv` | Loads `ANTHROPIC_API_KEY` from `.env` |
| `tsx` | Runs TypeScript directly without a compile step (dev only) |
| `typescript` | Type checking and build |

---

## Setup

```bash
# Install dependencies
npm install

# Create .env — see comments for each variable
cat > .env << 'EOF'
# Get your key at https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Set to false to use knowledge files only (no API cost).
# Set to true (or remove this line) to enable Anthropic for question generation and evaluation.
AI_ENABLED=false
EOF

# Run the MCP server (stdio, for Claude Desktop / Claude Code)
npm run dev

# Run the neural map server (http://localhost:3001)
npm run dev:ui
```

### Connecting to Claude Code

Add to `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "interview-mcp": {
      "command": "/path/to/interview-mcp/node_modules/.bin/tsx",
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

```
AI_ENABLED=false
```

| What changes | Detail |
|---|---|
| **Zero API cost** | No calls to Anthropic. The `ANTHROPIC_API_KEY` is still read from `.env` but never used. |
| **Questions** | Loaded from `data/knowledge/<topic>.md`. Only topics with a matching file are available. |
| **Evaluation** | The orchestrator Claude scores the answer using the `evaluationCriteria` returned by `ask_question`. It must pass `score`, `feedback`, and `needsFollowUp` when calling `evaluate_answer`. |
| **Concept extraction** | Skipped — no concepts are added to the graph after the session. |
| **Deeper dives** | Not generated — the report section will be empty. |
| **Unknown topics** | `start_interview` returns an error listing the available topics. |

Use `list_sessions` or just ask Claude which topics are available — the server reads them from `data/knowledge/` on startup.

### `AI_ENABLED=true` — Full AI mode

```
AI_ENABLED=true
# (or simply remove the line — true is the default)
```

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
- **Concepts** — pre-defined clusters used for the knowledge graph (AI mode still extracts dynamically, but file-only mode skips this)

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
                                          │  HTTP GET
                                     http.ts (port 3001)
                                          │
                                     index.html (D3.js)
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
                                          │  HTTP GET
                                     http.ts (port 3001)
                                          │
                                     index.html (D3.js)
```
