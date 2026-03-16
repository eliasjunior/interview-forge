# Mock Interview MCP — Project Context

## Overview

A study project for learning **Model Context Protocol (MCP)** server development. It runs mock technical interviews through Claude, evaluates answers with AI, and builds a growing knowledge graph across sessions — all visualised in a React dashboard.

**npm workspaces monorepo** with four packages:

| Package | Description |
|---|---|
| `interview-mcp` | MCP server — interview state machine, session data owner, REST API on port 3001 |
| `report-mcp` | MCP server — analytics and reporting on completed sessions, HTML report viewer |
| `ui` | React + Vite dashboard — sessions list, tabbed report viewer, D3 knowledge graph |
| `shared` | TypeScript types only — single source of truth, imported at compile time only |

## Architecture

```
Claude Desktop / Claude Code (orchestrator LLM)
    │  stdio (MCP)
    ├──► interview-mcp (state machine, data owner)
    └──► report-mcp (read-mostly, analytics)
              │
         interview-mcp/data/  (shared files: sessions.json, graph.json, reports/)
              │
         interview-mcp HTTP :3001
              │ fetch /api/*
         ui :5173  (React dashboard)
```

**Two LLMs are in play:**
- **Orchestrator** — Claude inside Claude Desktop/Code (drives the conversation, calls tools)
- **Worker** — Claude via Anthropic API (`src/ai/`) — generates questions, scores answers, extracts concepts. Optional: `AI_ENABLED=false` disables all API calls.

## Key Files & Paths

```
interview-mcp/
├── src/
│   ├── server.ts               # MCP bootstrap, registers 14 tools
│   ├── http.ts                 # Express REST API port 3001
│   ├── tools/                  # One file per MCP tool
│   ├── ai/                     # AIProvider port + Anthropic adapter (haiku model)
│   ├── knowledge/              # FileKnowledgeStore — reads data/knowledge/*.md
│   ├── interviewUtils.ts       # Pure utils: state guards, report builder, graph merge, flashcard generator
│   └── srsUtils.ts             # SM-2 spaced repetition algorithm (pure, side-effect-free)
├── data/
│   ├── sessions.json           # All session records (written after every state change)
│   ├── graph.json              # Cumulative knowledge graph
│   ├── flashcards.json         # All flashcards with SRS state { flashcards: Flashcard[] }
│   ├── reports/                # One .md report per completed session
│   └── knowledge/              # Curated topic .md files (committed to git)
└── .env                        # ANTHROPIC_API_KEY, AI_ENABLED

report-mcp/
├── src/
│   ├── server.ts               # MCP bootstrap, registers 7 tools
│   ├── reportUtils.ts          # Pure report-building utilities
│   ├── tools/
│   └── ai/
└── .env                        # DATA_DIR (points to interview-mcp/data), AI_ENABLED

shared/src/types.ts             # All domain TypeScript types — import from @mock-interview/shared

ui/src/
├── pages/
│   ├── SessionsPage.tsx
│   ├── ReportPage.tsx
│   ├── GraphPage.tsx
│   └── FlashcardsPage.tsx      # Flashcard overview + flip-card review UI
├── components/
│   └── NavBar.tsx
├── api.ts                      # Typed fetch helpers for all REST endpoints
└── index.css
```

## interview-mcp — State Machine & Tools

Session states: `ASK_QUESTION → WAIT_FOR_ANSWER → EVALUATE_ANSWER → FOLLOW_UP` (loops), then `ENDED`.

**14 MCP tools:** `server_status`, `help_tools`, `start_interview`, `ask_question`, `submit_answer`, `evaluate_answer`, `ask_followup`, `next_question`, `end_interview`, `get_session`, `list_sessions`, `list_topics`, `get_due_flashcards`, `review_flashcard`

**REST API (port 3001):**
- `GET /api/sessions` — all sessions
- `GET /api/reports` — report metadata list
- `GET /api/reports/:id` — single report markdown
- `GET /api/graph` — knowledge graph JSON
- `GET /api/flashcards` — all flashcards
- `POST /api/flashcards/:id/review` — submit a review rating `{ rating: 1|2|3|4 }`, applies SM-2, returns updated card
- `GET /generated/report-ui.html` — HTML report viewer

## report-mcp — Tools

**7 MCP tools:** `server_status`, `help_tools`, `regenerate_report`, `get_report_weak_subjects`, `get_report_full_context`, `generate_report_ui`, `get_graph`

---

## Flashcard System

### What it does

After an interview ends (`end_interview` tool), the system automatically generates flashcards for every question where the candidate scored **below 4**. Cards are stored in `interview-mcp/data/flashcards.json` and scheduled using the **SM-2 spaced repetition algorithm**.

Each card contains:
- **Front** — the original interview question
- **Back** — rich markdown: candidate's answer, interviewer feedback, stronger model answer, and deeper dive (if available)
- **SRS state** — `dueDate`, `interval` (days), `easeFactor`, `repetitions`, `lastReviewedAt`
- **Metadata** — `topic`, `difficulty` (easy/medium/hard mapped from score), `tags`, `source` (sessionId + questionIndex)

Cards are **idempotent**: re-running `end_interview` on the same session will not create duplicates (deduplication by `id = sessionId-questionIndex`).

### SM-2 Algorithm (`srsUtils.ts`)

| Rating | Label  | Quality (SM-2) | Effect |
|--------|--------|----------------|--------|
| 1      | Again  | 0              | Reset: interval=1, repetitions=0, easeFactor−0.2 |
| 2      | Hard   | 2              | Passed but penalty: advance schedule, easeFactor−0.14 |
| 3      | Good   | 3              | Normal advance: 1→6→interval×easeFactor days |
| 4      | Easy   | 5              | Perfect: advance with easeFactor bonus |

`easeFactor` is clamped to a minimum of 1.3. All SM-2 logic is pure/side-effect-free in `srsUtils.ts`.

### MCP Tools (for Claude-driven review sessions)

**`get_due_flashcards`**
- Returns all cards where `dueDate <= now`, sorted most-overdue first
- Optional `topic` filter (e.g. `"JWT authentication"`)
- Response includes `total`, `due`, and full card objects with a `hint` for next steps

**`review_flashcard`**
- Args: `cardId` (string), `rating` (1–4)
- Applies SM-2, updates `flashcards.json`, returns `nextDueDate`, `nextInterval`, `easeFactor`, `repetitions`

**Typical Claude review session flow:**
```
1. get_due_flashcards           → see what's due today
2. [for each card]
   review_flashcard { cardId, rating }  → submit recall quality
3. All done — next review dates are set automatically
```

### REST API (for the UI)

| Endpoint | Description |
|---|---|
| `GET /api/flashcards` | Returns `Flashcard[]` — all cards, all topics |
| `POST /api/flashcards/:id/review` | Body: `{ rating: 1\|2\|3\|4 }`. Applies SM-2, saves, returns updated `Flashcard` |

### UI — FlashcardsPage (`/flashcards`)

**Overview mode:**
- Stats row: Total cards / Due Today / Topics / Reviewed
- Topic filter tabs (shown when >2 topics exist)
- Card list split into **Due now** and **Upcoming** sections
- Each row shows topic, question, difficulty badge, due date, repetition count
- Click a row to expand the back (markdown rendered inline)

**Review mode** (launched via "Start Review (N)" button):
- 3D CSS flip card — front shows question, click/button to reveal answer
- Back renders full markdown: headers, bullet lists, tables, inline code, code fences, blockquotes
- Progress bar tracks position in the queue
- Rating buttons appear after flip: **Again** (red) / **Hard** (yellow) / **Good** (teal) / **Easy** (green)
- Auto-advances to next card after 400 ms; shows 🎉 completion screen when queue is empty

**Done screen:** shows total cards reviewed, link back to overview.

### Scheduled Daily Reminder

A scheduled task (`flashcard-daily-review`) fires every day at **9:00 AM local time**:
- Calls `get_due_flashcards` via MCP
- Prints a summary table of due cards grouped by topic
- Links to `http://localhost:5173/flashcards` to open the UI review

## Modes

- `AI_ENABLED=false` (default) — questions from knowledge files, orchestrator evaluates using `evaluationCriteria`, no API cost
- `AI_ENABLED=true` — full AI: question generation, scoring, concept extraction, deeper dives via Anthropic API (haiku model)

## Monorepo Scripts (from root)

| Script | Description |
|---|---|
| `npm run dev:interview` | Start `interview-mcp` MCP server (stdio) |
| `npm run dev:http` | Start `interview-mcp` HTTP API on port 3001 |
| `npm run dev:report` | Start `report-mcp` MCP server (stdio) |
| `npm run dev:ui` | Start `ui` Vite dev server on port 5173 |
| `npm run build` | Build all packages |

## Important Conventions

- **Shared types only in `shared/src/types.ts`** — never add a local `types.ts` to a package
- **Do not set `ANTHROPIC_API_KEY` in `.mcp.json` env block** — it overrides dotenv with an empty string
- Worker LLM model: `claude-haiku-4-5-20251001` (low latency/cost, called multiple times per turn)
- Storage: local JSON files only (`data/`), no database
- **Flashcard generation is automatic** — triggered by `end_interview`, no manual step needed
- **SM-2 logic lives only in `srsUtils.ts`** — never duplicate scheduling logic in tools or HTTP handlers

## Shared Types (`shared/src/types.ts`)

Key domain types (all imported via `@mock-interview/shared`):

| Type | Description |
|---|---|
| `Session` | Full interview session record including state, evaluations, graph |
| `KnowledgeGraph` | Nodes and edges for the D3 visualisation |
| `ReportMeta` | Lightweight report metadata (id, topic, date, score) |
| `Flashcard` | Full flashcard with SRS fields (see Flashcard System above) |
| `FlashcardDifficulty` | `'easy' \| 'medium' \| 'hard'` |
| `ReviewRating` | `1 \| 2 \| 3 \| 4` |
| `FlashcardReviewResult` | Return shape of a review operation |

## Interview Types

### `InterviewType` (`shared/src/types.ts`)

```typescript
export type InterviewType = 'design' | 'code'
// Session.interviewType?: InterviewType   (absent on legacy sessions → treated as 'design')
```

Currently only `'design'` is active. `'code'` is reserved for future algorithm/LeetCode-style questions.

### Starting a typed interview

```
start_interview { topic: "URL shortener", interviewType: "design" }
start_interview { topic: "JWT authentication" }          # interviewType defaults to "design"
```

### Available design topics

| Knowledge file | Topic |
|---|---|
| `jwt.md` | JWT — JSON Web Token |
| `rest-spring-jpa.md` | REST API Design, Spring Boot & JPA |
| `payment-api-design.md` | Payment API Design |
| `url-shortener.md` | URL Shortener System Design |

### Knowledge file format

All knowledge files live in `interview-mcp/data/knowledge/*.md` and follow this structure:

```markdown
# <Topic Title>

## Summary
<One-paragraph context: concepts covered, what makes it interesting, what a strong candidate knows>

## Questions
1. <Question 1>
2. <Question 2>
...

## Evaluation Criteria
- Question 1: <What a strong answer includes. What a weak answer misses. Bonus points.>
- Question 2: ...

## Concepts
- core concepts: word1, word2, word3
- practical usage: word4, word5
- tradeoffs: word6, word7
- best practices: word8, word9
```

Cluster names must be one of: `core concepts`, `practical usage`, `tradeoffs`, `best practices`.

### UI — Session type badge

Each session card on `/sessions` shows a `🏗️ Design` badge (teal) for interview sessions. This is derived from `session.interviewType` and defaults gracefully for legacy sessions without the field.

## Development Notes

- Keep it simple and iterative — learning project, not production-grade
- MCP concepts explored: typed tool schemas (Zod), session state machine, microservice-style MCP split, npm workspaces for shared types, spaced repetition scheduling, scheduled tasks, interview type extensibility

## Frozen / Parked Code

### `AnthropicAIProvider` (`interview-mcp/src/ai/anthropic.ts`)

**Do not modify this file.** The `AIProvider` interface (`port.ts`) and its adapters (`anthropic.ts`, `cache.ts`) are considered stable and parked. They cover exactly four operations: `generateQuestions`, `evaluateAnswer`, `extractConcepts`, `generateDeeperDives`.

**New tools must not add methods to `AIProvider`.** If a new tool needs AI-style logic (e.g. generating questions from custom content), that logic must live entirely inside the tool file itself — self-contained, without touching the provider layer. See `startScopedInterview.ts` as the reference pattern: content parsing and question building happen in the tool, no provider calls.

## Scoped Interview Tool (`start_scoped_interview`)

Starts an interview from user-provided content (project spec, README, architecture doc). Questions are generated locally by parsing the content for signals — HTTP endpoints, data fields, business rules — and composing them into targeted questions based on a configurable focus angle.

- **No AI provider calls** during question generation
- The `customContent` and `focusArea` fields are stored on the session
- `evaluate_answer` uses `customContent` + `focusArea` as the evaluation rubric when AI is enabled
- Default focus: `"robustness, reliability, and extensibility in a production environment"`

```
start_scoped_interview {
  topic: "Mortgage API",
  content: "...full spec text...",
  focus: "robustness, reliability, and extensibility in a production environment"
}
```
