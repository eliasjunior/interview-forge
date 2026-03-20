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

## How to use it

All interactions happen in natural language inside **Claude Desktop** or **Claude Code**. Claude decides which tools to call — you just describe what you want. Below are the main workflows with example prompts and the tool sequence Claude runs behind the scenes.

---

### 1. Full interview

The core loop. Claude asks questions one at a time, waits for your answer, scores it, optionally asks a follow-up, then moves to the next question. At the end it generates a report and flashcards for weak answers automatically.

**You say:**
```
Start a mock interview on JWT authentication
```

**Claude runs:**
```
server_status
  → start_interview { topic: "JWT authentication" }
  → ask_question { sessionId }
  → [you answer]
  → submit_answer { sessionId, answer: "..." }
  → evaluate_answer { sessionId }
  → ask_followup { sessionId }   ← only if score < 3 or answer was incomplete
  → next_question { sessionId }
  → [repeat per question]
  → end_interview { sessionId }   ← generates report + flashcards
```

**Available topics:** JWT, REST + Spring/JPA, Payment API Design, URL Shortener, mTLS/TLS, Java Concurrency, Java OS & JVM Internals, Rotate Matrix.

---

### 2. Targeted drill on weak spots

After a full interview, drill back on questions where you scored below 4. Claude loads your previous feedback as the rubric and runs a focused session.

**You say:**
```
Drill me on my weak spots from the last JWT interview
```

**Claude runs:**
```
start_drill { topic: "JWT authentication" }
  → [shows recallContext: known mistakes + weak areas]
  → asks: "What do you remember? Where will you struggle?"
  → [you respond]
  → ask_question → submit_answer → evaluate_answer → next_question
  → end_interview → log_mistake for any new gaps
```

> Requires at least one completed interview for the topic first.

---

### 3. Scoped interview on custom content

Start an interview from any spec, README, or architecture doc you paste in. Claude extracts questions from the content itself — no knowledge file needed.

**You say:**
```
Run a scoped interview on this Payment API spec, focus on reliability and edge cases:

[paste your spec here]
```

**Claude runs:**
```
start_scoped_interview {
  topic: "Payment API",
  content: "...your pasted spec...",
  focus: "robustness, reliability, and extensibility"
}
  → ask_question → submit_answer → evaluate_answer → ... → end_interview
```

---

### 4. Flashcard review

Cards are generated automatically when you score below 4. Review due cards using SM-2 spaced repetition — Claude flips each card and waits for your self-rating.

**You say:**
```
Review my due flashcards for JWT
```

**Claude runs:**
```
get_due_flashcards { topic: "JWT authentication" }
  → [for each card]
     review_flashcard { cardId, rating: 1|2|3|4 }
```

**Rating guide:** `1` = forgot, `2` = hard, `3` = good, `4` = easy. The next due date is set automatically.

You can also review cards in the browser at **http://localhost:5173/flashcards**.

---

### 5. Micro-skill practice

For algorithm-style skills (e.g. "2D index transformations"), track confidence per sub-skill and drill the weakest one.

**You say:**
```
Add a skill for 2D index transformations with sub-skills: layer boundaries, coordinate mapping, offset reasoning
```
```
Practice micro-skill: 2D index transformations — focus on layer boundaries
```

**Claude runs:**
```
add_skill {
  name: "2D index transformations",
  subSkills: ["layer boundaries", "coordinate mapping", "offset reasoning"],
  relatedProblems: ["rotate matrix", "spiral matrix"],
  confidence: 1
}

practice_micro_skill { skill: "2D index transformations", subSkill: "layer boundaries" }
  → shows recallQuestions + known mistakes
  → ask_question → submit_answer → evaluate_answer → end_interview
  → update_skill { name, subSkill, confidence: 2 }
```

**You say:**
```
What micro-skills do I still need to drill? (confidence ≤ 2)
```

**Claude runs:**
```
list_skills { maxConfidence: 2 }
```

---

### 6. Coding exercises

Hands-on implementation tasks grounded in real-world scenarios. The tool writes a full `.md` exercise file, persists metadata plus cross-topic tags, assesses complexity, and either presents the exercise or proposes simpler prerequisites first.

**You say:**
```
Create an exercise for Java concurrency — implement a producer-consumer queue like you'd use in a background job system
```

**Claude runs:**
```
create_exercise {
  name: "ProducerConsumerBlockingQueue",
  topic: "java-concurrency",
  difficulty: 3,
  tags: ["concurrency", "shared-state", "synchronization"],
  scenario: "Background email/job processing system",
  problemMeaning: [
    "Prevent overload by bounding queue size",
    "Introduce backpressure when queue is full",
    "Decouple request handling from heavy processing"
  ],
  ...
}
```

If the exercise is too hard or has unmet prerequisites, Claude shows the roadmap:
```
Before this exercise I recommend completing:
1. RaceConditionLab (Easy) — understand synchronized before wait/notify

Do you want to start with the prerequisites, or jump straight in?
```

After completing the exercise:
```
log_mistake { ... }           ← for any gaps found
start_scoped_interview { topic, content: problemStatement }  ← verbal follow-up drill
end_interview                 ← flashcard auto-generated
```

**You say:**
```
List all my exercises for Java concurrency, max difficulty 3
```

**Claude runs:**
```
list_exercises { topic: "java-concurrency", maxDifficulty: 3 }
```

You can also group related exercises without pretending they are the same exact problem:

**You say:**
```
Show me all matrix problems
```

**Claude runs:**
```
list_exercises { tags: ["matrix"] }
```

For example, `ZeroMatrix` and `RotateMatrixInPlace` can both live under the same broader matrix family via tags like:

```json
["matrix", "2d-indexing", "array-traversal"]
```

---

### 7. Reports and knowledge graph

**You say:**
```
Show me the report for my last JWT session
```

**Claude runs:**
```
list_sessions
  → get_report_full_context { sessionId }
  → generate_report_ui { sessionId, ... }
  → returns URL: /generated/report-ui.html?sessionId=...
```

**You say:**
```
What are my weakest subjects across all sessions?
```

**Claude runs:**
```
get_report_weak_subjects { sessionId }
```

---

### Full deliberate practice loop

The recommended cycle for deep learning on any topic:

```
1. start_interview { topic }          ← understand the domain
   → end_interview                    ← flashcards for weak spots

2. start_drill { topic }              ← targeted verbal recall of weak answers

3. create_exercise { topic, ... }     ← hands-on implementation
   → candidate codes the exercise
   → log_mistake for gaps
   → start_scoped_interview           ← verbal follow-up on the same problem

4. get_due_flashcards → review        ← SM-2 long-term retention

5. list_skills { maxConfidence: 2 }   ← identify next micro-skill to drill
   → practice_micro_skill             ← focused drill on the weakest sub-skill
```

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

### interview-mcp — 24 tools

This server drives the interview session from start to finish.

**Core interview flow**

| Tool | What it does |
|---|---|
| `server_status` | Preflight check — returns version, loaded topics, session counts, graph size. |
| `help_tools` | Lists all tools with short descriptions and example payloads. |
| `list_topics` | Lists all knowledge topics available for interviews. |
| `start_interview` | Creates a new session, loads questions from a knowledge file (or generates via AI). Returns `sessionId`. |
| `start_scoped_interview` | Starts an interview from user-provided content (spec, README, architecture doc). Questions are generated locally by parsing the content — no AI call needed. |
| `start_drill` | Starts a targeted drill on weak spots from a past interview. Requires at least one completed session for the topic. |
| `ask_question` | Returns the current question for a session in `ASK_QUESTION` state. |
| `submit_answer` | Records the candidate's answer and advances state to `EVALUATE_ANSWER`. |
| `evaluate_answer` | Scores the answer (1–5), writes feedback and a model answer. Advances to `FOLLOW_UP`. |
| `ask_followup` | Generates and asks a follow-up question based on the candidate's answer. |
| `next_question` | Moves to the next question, or ends the session if all questions are done. |
| `end_interview` | Ends the session, builds the Markdown report, merges concepts into the graph, generates flashcards for weak answers. |
| `get_session` | Returns the full session record (state, questions, evaluations, graph). |
| `list_sessions` | Lists all sessions with summary metadata. |

**Flashcards (SM-2 spaced repetition)**

| Tool | What it does |
|---|---|
| `get_due_flashcards` | Returns flashcards due for review today, sorted most-overdue first. Supports optional topic filter. |
| `review_flashcard` | Submits a recall rating (1=Again, 2=Hard, 3=Good, 4=Easy); applies SM-2 and schedules the next review. |

**Mistake log**

| Tool | What it does |
|---|---|
| `log_mistake` | Records a mistake pattern with what went wrong, when it happens, and the correct fix. |
| `list_mistakes` | Lists all logged mistakes, optionally filtered by topic. |

**Skill backlog (micro-skill deliberate practice)**

| Tool | What it does |
|---|---|
| `add_skill` | Adds a transferable micro-skill with sub-skills, related problems, and initial confidence (1–5). |
| `list_skills` | Lists skills in the backlog, optionally filtered by `maxConfidence` to surface what to drill next. |
| `update_skill` | Updates confidence after a drill — per sub-skill or overall. |
| `practice_micro_skill` | Starts a focused micro-skill drill: recall step → `ask_question` → `evaluate_answer` → `end_interview` → `update_skill`. |

**Coding exercises**

| Tool | What it does |
|---|---|
| `create_exercise` | Creates a structured exercise grounded in a real-world scenario. Writes a rich `.md` to the knowledge center, persists metadata including tags, and returns a complexity assessment + prerequisite roadmap. |
| `list_exercises` | Lists exercises, optionally filtered by topic, max difficulty, or tags. Shows scenario, tags, and problem meaning per exercise. |

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
