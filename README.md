# interview-forge

A study project that runs **mock technical interviews through Claude**, evaluates your answers with AI, and builds a cumulative knowledge graph across sessions — all visualised in a React dashboard.

`interview-mcp` is the **stateful interview engine**: it owns the interview state machine, session progress, persistence, and tool contract. Claude is the orchestrator and conversation layer, but `interview-mcp` is the source of truth for what step the interview is in.

It is structured as an **npm workspaces monorepo** with four packages and two MCP servers that Claude connects to simultaneously.

---

## Table of Contents

**Getting started**
- [Quick start](#quick-start)
- [Connecting MCP servers to Claude](#connecting-the-mcp-servers-to-claude)
- [Modes](#modes)

**How to use it**
- [0. Starting a topic — warm-up ladder](#0-starting-a-topic--warm-up-ladder)
- [1. Full interview](#1-full-interview)
- [2. Targeted drill on weak spots](#2-targeted-drill-on-weak-spots)
- [3. Scoped interview on custom content](#3-scoped-interview-on-custom-content)
- [4. Flashcard review](#4-flashcard-review)
- [5. Micro-skill practice](#5-micro-skill-practice)
- [6. Coding exercises](#6-coding-exercises)
- [7. Reports and knowledge graph](#7-reports-and-knowledge-graph)
- [Full deliberate practice loop](#full-deliberate-practice-loop)

**Reference**
- [MCP tools — interview-mcp (27 tools)](#interview-mcp--27-tools)
- [MCP tools — report-mcp (8 tools)](#report-mcp--8-tools)
- [REST API](#rest-api-interview-mcp-port-3001)
- [Monorepo scripts](#monorepo-scripts)
- [Knowledge topics](#knowledge-topics)
- [Flashcard system](#flashcard-system)

**Project internals**
- [What it does](#what-it-does)
- [Monorepo structure](#monorepo-structure)
- [Architecture](#architecture)
- [Extra information](#extra-information)

---

## What it does

1. **Conducts interviews** — Claude picks questions from curated knowledge files (or generates them with AI), asks them one at a time, follows up, and enforces a strict state machine so the session never gets out of sync.
2. **Evaluates answers** — after each answer, the server scores it (1–5), writes detailed feedback, and surfaces a stronger model answer. Scoring can be done by a background worker LLM or by the orchestrator Claude itself (no API key needed).
3. **Builds a knowledge graph** — every completed session extracts concepts and merges them into a growing graph. Concepts are canonicalised before merge, so alias variants such as `thread dump`, `thread dumps`, and `thread-dump` collapse into one node. The graph now stores both weighted co-occurrence edges and semantic relationship edges, while clusters remain categorisation only — not identity. The full-screen D3 canvas supports zoom, drag, and one-click cluster filtering to highlight only *core concepts*, *tradeoffs*, etc.
4. **Generates flashcards** — questions you scored below 4 are automatically turned into spaced-repetition flashcards (SM-2 algorithm). Due cards surface daily.
5. **Produces reports** — a Markdown report and an interactive HTML viewer are generated per session, showing scores, feedback, and model answers side-by-side.
6. **Visualises everything** — a React dashboard shows session history, the knowledge graph (D3), report viewer, and a flashcard review UI.

[↑ Back to top](#table-of-contents)

---

## Monorepo structure

```
interview-forge/
├── interview-mcp/   MCP server — interview state machine, data owner, REST API
├── report-mcp/      MCP server — analytics, report generation, knowledge graph queries
├── ui/              React + Vite dashboard (topics, sessions, graph, reports, flashcards)
└── shared/          TypeScript types only — shared across all packages
```

### Package responsibilities

| Package | Role |
|---|---|
| `interview-mcp` | **Data owner.** Runs the interview, persists sessions, graph, and flashcards in SQLite, serves the REST API on port 3001. |
| `report-mcp` | **Read-mostly analytics.** Reads the shared SQLite database owned by `interview-mcp`, regenerates reports, queries weak subjects, produces the interactive HTML report viewer. |
| `ui` | **Frontend only.** No local data — fetches everything from `interview-mcp`'s REST API via a Vite proxy. |
| `shared` | **Types only.** No runtime code. TypeScript interfaces imported at compile time by the other three packages. |

[↑ Back to top](#table-of-contents)

---

## How to use it

All interactions happen in natural language inside **Claude Desktop** or **Claude Code**. Claude decides which tools to call — you just describe what you want. Below are the main workflows with example prompts and the tool sequence Claude runs behind the scenes.

---

### 0. Starting a topic — warm-up ladder

Every topic now has a 4-level progression ladder. Claude always checks your history before starting anything and routes you to the right entry point.

**You say:**
```
I want to study JWT authentication
```

**Claude runs:**
```
get_topic_level { topic: "JWT authentication" }
  → returns level: 0, status: "cold"   ← never attempted, always starts at L0
  → instruction: call start_warm_up { topic, level: 0 }
```

**Then — if topic has warm-up content (e.g. JWT):**
```
start_warm_up { topic: "JWT authentication", level: 0 }
  → creates a warmup session (sessionKind: "warmup", questFormat: "mcq")
  → ask_question { sessionId }
  → [you pick A / B / C / D]
  → submit_answer { sessionId, answer: "B" }
  → evaluate_answer { sessionId }    ← auto-scored against correct answer
  → next_question { sessionId }
  → [repeat per question]
  → end_interview { sessionId }      ← advances topic to next level when avg ≥ 4.0
```

**If topic has no warm-up content yet:** `start_warm_up` returns an error with the instruction to call `start_interview` directly. The Topics page still shows L0 "Not Started" so you know no sessions exist.

**Level routing table:**

| Status | What Claude calls |
|---|---|
| `cold` — no sessions | `start_warm_up { level: 0 }` (MCQ) |
| `warmup` L0 in progress | `start_warm_up { level: 0 }` (retry) |
| `warmup` L1 in progress | `start_warm_up { level: 1 }` (fill-in-blank) |
| `warmup` L2 in progress | `start_warm_up { level: 2 }` (guided answer) |
| `dropped` (interview avg < 2.5) | `start_warm_up { level: 1 }` (reinforcement) |
| `ready` (interview avg ≥ 3.0) | `start_interview { topic }` |

Advancement threshold: avg score ≥ 4.0 on a warm-up session unlocks the next level.

---

### 1. Full interview

The core loop. Claude asks questions one at a time, waits for your answer, scores it, optionally asks a follow-up, then moves to the next question. At the end it generates a report and flashcards for weak answers automatically.

Reached after completing the warm-up ladder, or directly for topics without warm-up content.

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

This workflow starts from a completed interview and turns weak feedback into deliberate practice.

The current flow is:

1. Run a full interview.
2. End the interview with `end_interview`.
3. `end_interview` finalizes the session, writes the report, merges concepts into the graph, and auto-generates flashcards for weak answers.
4. Review the completed session feedback and identify recurring mistakes or weak areas.
5. Optionally persist those patterns with `log_mistake`.
6. Optionally create a follow-up implementation exercise with `create_exercise` based on the weak area.
7. Run `start_drill` to revisit the weak answers verbally, using prior weak evaluations plus any logged mistakes as recall context.

So `start_drill` is not the whole learning loop by itself. It is the targeted verbal-recall step that comes after at least one completed interview and can be combined with flashcards, mistake logging, and exercises.

**You say:**
```
Drill me on my weak spots from the last JWT interview
```

**Claude runs:**
```
start_interview { topic: "JWT authentication" }
  → ask_question
  → [you answer]
  → submit_answer
  → evaluate_answer
  → next_question
  → [repeat per question]
  → end_interview                  ← report + graph merge + flashcards for weak answers
  → log_mistake { ... }            ← optional, for recurring patterns found in feedback
  → create_exercise { ... }        ← optional, for hands-on follow-up practice
start_drill { topic: "JWT authentication" }
  → returns recallContext from prior weak evaluations + logged mistakes
  → Claude shows that recall context to the candidate
  → Claude asks: "What do you remember about these areas? Where do you think you will struggle?"
  → [you respond]
  → ask_question → submit_answer → evaluate_answer → next_question
  → end_interview                  ← drill session finalized; weak drill answers can also create flashcards
  → log_mistake { ... }            ← optional, for any new gaps discovered in the drill
```

> Requires at least one completed interview for the topic first.

---

### 3. Scoped interview on custom content

Start an interview from any content you supply — a spec, README, architecture doc, or just a topic you want to study. There are two ways to do this.

---

#### Option A — paste content directly

You already have the material and just want to run it as an interview.

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

#### Option B — build a focused scope interactively

You have a broad topic but want the LLM to ask clarifying questions first so the interview stays focused and doesn't drift. This is the recommended approach when you know what you want to study but haven't written the content yet.

**You say:**
```
I want to study how JavaScript works — help me narrow this down into a focused scoped interview
```

**Claude asks clarifying questions one at a time:**
```
Which areas do you want to focus on?
  1. Event loop + task/microtask queues
  2. Call stack and execution context
  3. Async/await and Promise resolution
  4. Something else?

What depth do you want — conceptual explanation, trace through code, or mixed?

Where do you usually struggle?
```

**After your answers, Claude calls:**
```
build_scope {
  topic: "JavaScript Runtime — Event Loop",
  focusAreas: ["event loop", "microtask vs macrotask queue", "Promise vs setTimeout order"],
  weakSpots: ["Promise.then vs setTimeout execution order"],
  depth: "trace-through-code",
  outOfScope: ["JS syntax", "DOM APIs", "Node.js internals"],
  saveAs: "js-event-loop"   ← optional: saves for reuse next time
}
  → start_scoped_interview { topic, content, focus }
  → ask_question → submit_answer → evaluate_answer → ... → end_interview
```

The tool builds a content block with explicit **Focus Areas**, **Evaluation Criteria**, **Known Weak Spots**, and **Out of Scope** sections that anchor the LLM during evaluation and prevent it from going in an unwanted direction.

**Reusing a saved scope:** if you passed `saveAs`, the scope is written to `data/knowledge/scopes/<slug>.md`. Next time, skip the Q&A and call `start_scoped_interview` directly with that file's content.

---

#### Content template (for writing your own)

When writing `content` manually for `start_scoped_interview`, this structure gives the LLM the most to work with:

```markdown
# Study Scope: <topic>

## Focus Areas
- <specific area 1>
- <specific area 2>

## Depth: mixed
Verbal explanation + code tracing expected.

## Evaluation Criteria
- **<area 1>**: What a strong answer includes. Probe if vague.
- **<area 2>**: ...

## Known Weak Spots (probe these specifically)
- <thing you always get wrong>

## Out of Scope
- <topic to exclude so the LLM doesn't drift>

## Session Goal
Candidate can explain X and Y without prompting. No drifting into Z.
```

The `Out of Scope` section is the most important when drift is a concern — the LLM will redirect the candidate if they wander into excluded territory.

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
       → if the card has been seen before and recall succeeded (rating ≥ 3):
           response includes nextStep: { tool: "generate_flashcard_variation", cardId }
         → generate_flashcard_variation { cardId }
             returns originalQuestion + modelAnswer + a variation angle
             Claude constructs a varied question, asks it, evaluates the answer
```

**Rating guide:** `1` = forgot, `2` = hard, `3` = good, `4` = easy. The next due date is set automatically.

**Variation angles** — on repeated cards, Claude picks a different angle each time instead of repeating the same question verbatim:

| Angle | What Claude asks instead |
|---|---|
| `failure-case` | What goes wrong if you ignore or misapply this concept in production? |
| `why-not-what` | Explain the *reasoning* behind the answer, not just the fact. |
| `flip-scenario` | Reverse the constraint — what's the edge case that breaks the normal rule? |
| `trade-offs` | Compare this approach to an alternative and say when each is preferable. |
| `teach-it` | Explain this concept to a junior developer using a concrete analogy. |
| `apply-to-context` | How does this apply to a high-traffic service / distributed system / memory-constrained environment? |

The angle rotates deterministically with each review (`repetitions % 6`), so consecutive reviews always use a fresh perspective.

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

The graph model works like this:

- **Canonical nodes** — concepts are normalised before merge, so wording variants map to one stable node ID.
- **Cluster membership** — a concept can belong to multiple clusters (`core concepts`, `practical usage`, `tradeoffs`, `best practices`) without becoming multiple nodes.
- **Co-occurrence edges** — concepts that appear together in a session are linked with weighted co-occurrence edges.
- **Semantic edges** — curated graph rules can also add explicit semantic relationships, for example tool-to-diagnosis links such as `thread-dump -> lock-contention`.

Example: if the graph already contains `spring-mvc` and a new completed interview extracts `Spring MVC`, the new concept is normalised before merge and updates the existing `spring-mvc` node instead of creating a second node.

Variations handled automatically today:

- case differences: `Spring MVC` -> `spring-mvc`
- spaces vs hyphens vs underscores: `thread dump`, `thread-dump`, `thread_dump`
- repeated separators and punctuation cleanup
- explicitly configured aliases such as `thread dump` / `thread dumps` / `thread-dump`

Variations that still need an explicit alias rule:

- true synonyms that are not just formatting variants
- domain-specific renames such as `thread contention` -> `lock-contention`
- concept families where plural/singular should collapse but the wording is not predictable from formatting alone

Because the graph is derived from saved session concepts, changes to canonicalisation or semantic-edge rules may require a graph rebuild to backfill historical data.

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

[↑ Back to top](#table-of-contents)

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

[↑ Back to top](#table-of-contents)

---

## MCP tools reference

### interview-mcp — 27 tools

This server drives the interview session from start to finish.

**Core interview flow**

| Tool | What it does |
|---|---|
| `server_status` | Preflight check — returns version, loaded topics, session counts, graph size. |
| `help_tools` | Lists all tools with short descriptions and example payloads. |
| `list_topics` | Lists all knowledge topics available for interviews. |
| `start_interview` | Creates a new session, loads questions from a knowledge file (or generates via AI). Returns `sessionId`. |
| `start_scoped_interview` | Starts an interview from user-provided content (spec, README, architecture doc). Questions are generated locally by parsing the content — no AI call needed. |
| `build_scope` | Builds a focused content block for `start_scoped_interview` from structured inputs (topic, focusAreas, weakSpots, depth, outOfScope). Optionally saves the result to `data/knowledge/scopes/<slug>.md` for reuse. Use after a clarifying Q&A conversation to anchor the LLM and prevent evaluation drift. |
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
| `review_flashcard` | Submits a recall rating (1=Again, 2=Hard, 3=Good, 4=Easy); applies SM-2 and schedules the next review. When the card has been seen before and recall succeeds, returns `nextStep` pointing to `generate_flashcard_variation`. |
| `generate_flashcard_variation` | Returns the original card context plus a variation angle (failure-case, why-not-what, flip-scenario, trade-offs, teach-it, apply-to-context). The orchestrator LLM uses this to construct a varied question that tests the same concept from a different perspective. Angle rotates each review so the same question is never asked twice in a row. |
| `create_flashcard` | Creates a flashcard directly from supplied front/back content, without needing an interview session. Useful for capturing insights or concepts on the fly. Cards are due immediately and follow the same SM-2 schedule. |

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

### report-mcp — 8 tools

This server is focused on analysing and presenting completed sessions.

| Tool | What it does |
|---|---|
| `server_status` | Preflight check — returns version and AI mode. |
| `help_tools` | Lists all tools with short descriptions and example payloads. |
| `regenerate_report` | Re-runs deeper dives (AI mode) and rewrites the `.md` report for any completed session. |
| `get_report_weak_subjects` | Identifies low-scoring questions and returns structured context, ready to pipe into `generate_report_ui`. |
| `get_report_full_context` | Returns all evaluated Q/A pairs for a session, with a pre-filled `nextCall` scaffold for `generate_report_ui`. |
| `generate_report_ui` | Writes a per-session JSON dataset and returns a viewer URL (`/generated/report-ui.html?sessionId=…`). |
| `get_progress_overview` | Aggregates ended sessions into score trends, topic progress, repeated-topic improvement, weak-question rate, and recent-session summaries. |
| `get_graph` | Returns the full cumulative knowledge graph from the shared SQLite store. |

[↑ Back to top](#table-of-contents)

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
| `GET /api/topics` | List of available interview topics from knowledge files — returns `{ file, displayName }[]` |
| `GET /generated/report-ui.html` | Interactive HTML report viewer |

[↑ Back to top](#table-of-contents)

---

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/eliasjunior/interview-forge.git
cd interview-forge
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

Prefer compiled entrypoints instead of `tsx` or `npm run build && ...` in the MCP config. Running a TypeScript build during the MCP handshake makes the host connection fragile: a test-only type error can make the server appear disconnected even when the runtime code itself is fine.

```json
{
  "mcpServers": {
    "interview-mcp": {
      "command": "/usr/bin/env",
      "args": [
        "node",
        "/Users/eliasjunior/Projects/ai-projects/interview-forge/interview-mcp/dist/server.js"
      ],
      "cwd": "/Users/eliasjunior/Projects/ai-projects/interview-forge/interview-mcp"
    },
    "report-mcp": {
      "command": "/usr/bin/env",
      "args": [
        "node",
        "/Users/eliasjunior/Projects/ai-projects/interview-forge/report-mcp/dist/server.js"
      ],
      "cwd": "/Users/eliasjunior/Projects/ai-projects/interview-forge/report-mcp",
      "env": {
        "AI_ENABLED": "false"
      }
    }
  }
}
```

Build the packages before reloading the host app:

```bash
npm run build:interview
npm run build:report
```

Set `AI_ENABLED=false` for `report-mcp` unless you explicitly want Anthropic-backed deeper dives and have `ANTHROPIC_API_KEY` available in that host environment. Otherwise the server can fail during startup and make the overall MCP setup look broken.

### MCP troubleshooting

If Claude Desktop can use the tools but Codex Desktop or an agent thread cannot, treat that as a host-context issue first, not a server-runtime issue.

- Symptom: Claude Desktop sees `interview-mcp`, but another app or thread reports no MCP resources or tools.
- Likely cause: the other host context did not load or inherit the workspace `.mcp.json`, even though the server itself starts cleanly.
- Verify the server directly: `cd interview-mcp && node dist/server.js`
- Verify the sibling server directly: `cd report-mcp && AI_ENABLED=false node dist/server.js`
- If those commands start and log `running on stdio`, the repo-side config is probably fine.
- Then reconnect or restart the host app so it reloads [`.mcp.json`](/Users/eliasjunior/Projects/ai-projects/interview-forge/.mcp.json).

After the host reconnects, always run `server_status` first. Only start an interview after that preflight succeeds.

[↑ Back to top](#table-of-contents)

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

[↑ Back to top](#table-of-contents)

---

## Knowledge topics

Knowledge files live in `interview-mcp/data/knowledge/*.md`. Each file follows a fixed structure: `## Summary`, `## Questions`, `## Difficulty`, `## Evaluation Criteria`, and `## Concepts`. The `## Difficulty` section tags every question as `foundation`, `intermediate`, or `advanced`.

### How questions are selected per interview

`start_interview` picks **5 questions by default** (configurable up to 10 via `maxQuestions`) using a difficulty-progressive selection:

| Slot | Tier |
|---|---|
| Q1, Q2 | foundation |
| Q3, Q4 | intermediate |
| Q5 | advanced |

Within each tier, questions you have been asked least often across past sessions are prioritised first — so repeated interviews gradually cycle through the full question pool rather than repeating the same 5 questions. When a question has been seen before, the `selectionRationale` field in the `start_interview` response signals Claude to probe deeper instead of accepting a surface-level recall answer.

### Current topics

| File | Topic | Questions |
|---|---|---|
| `jwt.md` | JWT — JSON Web Token | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `rest-spring-jpa.md` | REST API Design, Spring Boot & JPA | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `payment-api-design.md` | Payment API Design | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `url-shortener.md` | URL Shortener System Design | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `mtls-tls.md` | mTLS / TLS | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `java-concurrency.md` | Java Concurrency | 21 (5 foundation, 9 intermediate, 7 advanced) |
| `java-os-jvm.md` | Java OS & JVM Internals | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `js-fundamentals.md` | JavaScript Fundamentals: DOM, Callbacks, Promises, XHR, Event Loop & Web APIs | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `cicd-release-flow.md` | CI/CD Release Flow for Backend Engineers | 16 (5 foundation, 7 intermediate, 4 advanced) |
| `rotate-matrix-algorithm.md` | Rotate Matrix (algorithm) | 14 (5 foundation, 7 intermediate, 2 advanced) |
| `mortgage-rest-design.md` | Mortgage REST API Design | 20 (5 foundation, 10 intermediate, 5 advanced) |

### Warm-up quest levels

Every topic has a 4-level progression ladder. Before jumping into a full interview, the system checks your session history and routes you to the right entry point.

| Level | Color | Format | Goal | Evaluation |
|---|---|---|---|---|
| **L0** | Amber — Recognition | Multiple-choice (MCQ) | Trigger memory, reduce anxiety, build familiarity | Auto-scored — answer a letter (A/B/C/D) |
| **L1** | Yellow — Assisted Recall | Fill in the blank | Partial activation with low cognitive load | Auto-scored — answer must contain the key term |
| **L2** | Blue — Guided Answer | Open answer with structure hint | Structured thinking, reduce blank-page problem | Orchestrator scores against provided structure |
| **L3** | Green — Interview Ready | Full open-ended question | Production-level explanation | Full evaluation with score, feedback, follow-up |

**Status badges on the Topics page:**

| Badge | Color | Meaning |
|---|---|---|
| L0 — Not Started | Grey | No sessions exist for this topic — always starts at L0 |
| L0 — Recognition | Amber | Attempted L0 warm-up, still below threshold (avg < 4.0) |
| L1 — Assisted Recall | Yellow | Working through L1, or dropped back from a poor interview (avg < 2.5) |
| L2 — Guided Answer | Blue | Working through L2 |
| L3 — Interview Ready (earned) | Green | Full interview completed with avg score ≥ 3.0 |

**Level advancement thresholds:** avg score ≥ 4.0 on a warm-up session unlocks the next level. A full interview with avg < 2.5 drops the topic back to L1 for reinforcement.

**MCP tools for the warm-up flow:**
```
get_topic_level { topic }               → check current level + status
start_warm_up { topic, level? }         → begin warm-up (auto-detects level if omitted)
evaluate_answer { sessionId }           → L0/L1 auto-score; L2 needs orchestrator score
```

Warm-up content lives in the `## Warm-up Quests` section of each knowledge file (see [Knowledge file format](#knowledge-file-format)). Currently only `jwt.md` has warm-up content authored — other topics show L0 "Not Started" and route directly to `start_interview` until content is added.

### Knowledge file format

```markdown
# <Topic Title>

## Summary
<One-paragraph context — what the topic covers and what a strong candidate knows>

## Questions
1. <Question>
2. ...

## Difficulty
- Question 1: foundation
- Question 2: intermediate
- Question 3: advanced
...

## Evaluation Criteria
- Question 1: <What a strong answer includes. What a weak answer misses. Bonus points.>
- Question 2: ...

## Concepts
- core concepts: word1, word2
- practical usage: word3, word4
- tradeoffs: word5, word6
- best practices: word7, word8
```

Cluster names must be one of: `core concepts`, `practical usage`, `tradeoffs`, `best practices`.

To add warm-up content for a topic, append a `## Warm-up Quests` section:

```markdown
## Warm-up Quests

### Level 0 — Recognition (MCQ)
1. <Question text>
   A) <Option A>
   B) <Option B>
   C) <Option C>
   D) <Option D>
   Answer: A

### Level 1 — Fill in the Blank
1. <Sentence with ___ gap>
   Answer: <key term>

### Level 2 — Guided Answer
1. <Open question with structure hint>
   Hint: <Scaffolding hint shown to candidate before they answer>
```

Set `AI_ENABLED=true` to let the server generate questions for any topic not in the knowledge base.

[↑ Back to top](#table-of-contents)

---

## Flashcard system

After `end_interview`, the server automatically generates flashcards for any question scored below 4. Cards are stored in `data/app.db` and scheduled with the **SM-2 spaced repetition algorithm**.

A scheduled task (`flashcard-daily-review`) fires every day at **9:00 AM** and prints a summary of due cards grouped by topic.

**Ratings and intervals:**

| Rating | Label | Effect |
|---|---|---|
| 1 | Again | Reset: interval=1 day, ease factor −0.2 |
| 2 | Hard | Advance with penalty: ease factor −0.14 |
| 3 | Good | Normal advance: 3 → 8 → interval × ease factor days |
| 4 | Easy | Full advance with ease factor bonus |

Intervals include ±1 day random jitter so cards from the same session drift apart and don't all surface on the same day.

**Variation flow** — on repeated successful reviews, `review_flashcard` returns a `nextStep` hint:

```
review_flashcard { cardId, rating: 3 }
  → nextStep: { tool: "generate_flashcard_variation", cardId }
generate_flashcard_variation { cardId }
  → returns variationAngle + originalQuestion + modelAnswer
  → orchestrator constructs a varied question from the angle and asks it
```

Six angles rotate deterministically: `failure-case`, `why-not-what`, `flip-scenario`, `trade-offs`, `teach-it`, `apply-to-context`. The variation is ephemeral — not stored in the DB.

[↑ Back to top](#table-of-contents)

---

## Modes

| Mode | How | Cost |
|---|---|---|
| `AI_ENABLED=false` (default) | Questions from knowledge files; orchestrator Claude evaluates using the rubric | Free |
| `AI_ENABLED=true` | Worker LLM (haiku model) generates questions, scores answers, extracts concepts, writes deeper dives | Anthropic API credits |

[↑ Back to top](#table-of-contents)

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

[↑ Back to top](#table-of-contents)

---

## Bug List

### MCP tools not available when Claude Code runs as a sub-agent inside Claude Desktop

**Observed:** When Claude Desktop launches Claude Code as a sub-agent (via the Agent SDK), the MCP tools defined in `.mcp.json` (`start_interview`, `end_interview`, etc.) are not available in the Claude Code context. Claude Code fell back to conducting the interview manually as a conversation, then inserted the session data directly into SQLite via a one-off Node.js script.

**Root cause (to investigate):** Claude Desktop loads `.mcp.json` and has the MCP tools available in its own context, but when it spawns Claude Code as a sub-agent, those tools are not passed through or re-initialised in the sub-agent's tool context. Claude Code runs with its own isolated tool set and does not inherit the parent session's MCP servers.

**Impact:** The full interview flow (state machine, auto flashcard generation via `end_interview`, graph merging) was bypassed. Session data was reconstructed manually.

**To investigate:**
- Confirm whether Claude Desktop is expected to forward MCP tools to Claude Code sub-agents, or if this is a known architectural boundary
- Check if there is a way to configure Claude Code (via `.claude/settings.json` or similar) to load the same MCP servers independently, so it can call them directly
- Test calling interview tools directly from the Claude Desktop conversation (not via Claude Code) to confirm they work there
