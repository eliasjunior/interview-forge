# Mock Interview MCP — Project Context

## Highest Priority Rule

In every new Desktop app thread in this project, the first response must be an MCP connection check.

Before answering the user's request, first state whether `interview-mcp` is connected in the current Desktop session.

- If it is not connected, say: `Before I continue, I should check whether interview-mcp is connected in this Desktop session. It is not connected, so I have to stop here.`
- Do not answer the user's actual request until this check has been reported.

## MCP Connection Troubleshooting

If `interview-mcp` fails to connect, follow this checklist before asking the user to do anything:

### 1. Check the logs
```bash
tail -n 50 ~/Library/Logs/Claude/mcp-server-interview-mcp.log
```

### 2. Common causes & fixes

| Symptom in log | Cause | Fix |
|---|---|---|
| `Cannot find module '.../dist/server.js'` | Project not built | Run `npm run build` from repo root |
| `Server transport closed unexpectedly` | Process crashed on startup | Check for syntax errors or missing `.env` |
| `Missing environment variables` | `.env` not loaded | Verify `interview-mcp/.env` has `AI_ENABLED` set |

### 3. After fixing, always
1. Run `npm run build` from the repo root if any TypeScript was changed or dist is missing
2. Fully quit and reopen Claude Desktop (closing the window is not enough)
3. Confirm reconnection by calling `server_status`

## Overview

A study project for learning **Model Context Protocol (MCP)** server development. It runs mock technical interviews through Claude, evaluates answers with AI, builds a growing knowledge graph across sessions, and uses a simple reward system with level-ups and progress tracking in the UI — all visualised in a React dashboard.

**npm workspaces monorepo** with four packages:

| Package | Description |
|---|---|
| `interview-mcp` | MCP server — interview state machine, session data owner, REST API on port 3001 |
| `report-mcp` | MCP server — analytics and reporting on completed sessions, HTML report viewer |
| `ui` | React + Vite dashboard — sessions list, tabbed report viewer, D3 knowledge graph, learner progress and level display |
| `shared` | TypeScript types only — single source of truth, imported at compile time only |

## Architecture

```
Claude Desktop / Claude Code (orchestrator LLM)
    │  stdio (MCP)
    ├──► interview-mcp (state machine, data owner)
    └──► report-mcp (read-mostly, analytics)
              │
         interview-mcp/data/  (shared runtime DB: app.db, plus reports/)
              │
         interview-mcp HTTP :3001
              │ fetch /api/*
         ui :5173  (React dashboard with progress and level display)
```

**Two LLMs are in play:**
- **Orchestrator** — Claude inside Claude Desktop/Code (drives the conversation, calls tools)
- **Worker** — Claude via Anthropic API (`src/ai/`) — generates questions, scores answers, extracts concepts. Optional: `AI_ENABLED=false` disables all API calls.

## Core Product Features

- Mock technical interviews driven through MCP tools
- AI-assisted answer evaluation and feedback
- Knowledge graph growth across completed sessions
- Session reports and report viewer UI
- Flashcards, mistakes, and targeted drills for deliberate practice
- A simple reward system that levels the user up and shows progress in the UI

## Interview Behavior Rules

- In live interview mode, the candidate should see only the interview question and neutral next-step instructions.
- `evaluationCriteria`, rubrics, expected-answer structure, scoring hints, and similar fields are evaluator-only context.
- Never reveal evaluator-only context to the candidate, even if a tool payload includes it alongside the question.
- When `AI_ENABLED=false`, the orchestrator may use `evaluationCriteria` to score the answer, but it must keep that rubric hidden while asking the question.
- The interview flow should remain: ask the question, wait for the candidate's answer, evaluate, then continue. Do not front-load the grading rubric into the candidate prompt.

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
│   ├── app.db                  # Shared runtime database (sessions, graph, flashcards)
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
│   ├── FlashcardsPage.tsx      # Flashcard overview + flip-card review UI
│   └── ForgeArenaPage.tsx      # Crisis Mode page (front-end only)
├── components/
│   ├── NavBar.tsx
│   └── FloatingPoints.tsx      # Floating +X pts overlay used by Crisis Mode
├── crisis/
│   └── topicArena.ts           # Crisis Mode single-topic scenario map
├── api.ts                      # Typed fetch helpers for all REST endpoints
└── index.css
```

## Crisis Mode

### Current scope

`Crisis Mode` is currently a **front-end-only** feature in `ui` and is intentionally **not generic yet**.

It is hard-wired to exactly one topic:

- `data-access-tradeoffs-growing-complexity`

The page loads the topic through the existing UI API:

- `getTopicDetails(CRISIS_TOPIC_FILE)` from `ui/src/api.ts`

It does **not** read markdown files directly in the browser.

### Files

- `ui/src/pages/ForgeArenaPage.tsx`
- `ui/src/crisis/topicArena.ts`
- `ui/src/components/FloatingPoints.tsx`
- `ui/src/index.css`

### Behavior

The current implementation uses a **small manual scenario map** derived from the authored topic file.

It is based on a few selected questions from `data-access-tradeoffs-growing-complexity`, currently covering:

- full dataset browse pressure / bounded pagination
- deep pagination / cursor pagination
- caching trade-offs
- freshness under peak load

These scenarios are shuffled per run, but they are still sourced from this one topic only.

### Interview loop

Current loop:

`decision -> follow-up prompt -> answer -> concept feedback -> improve once -> twist -> done`

The interview round includes:

- crisis decision selection
- topic-specific follow-up prompt
- one normal answer submission
- concept-based feedback (`Covered` / `Missed`)
- one optional improvement attempt
- one static twist prompt per selected question
- visible sidebar progress (`Decision`, `Grade`, `Concept coverage`, `Improve used`, `Twist answered`)

### Evaluation model

Evaluation is **deterministic** and **not AI-based**.

For each selected scenario, `ui/src/crisis/topicArena.ts` defines:

- `expectedConcepts[]`
- `twistPrompt`
- fixed decision options and their outcomes

Each concept has a small keyword list. The page checks whether the submitted answer contains any of those keywords.

Helpers currently used in the page:

- `evaluateConceptCoverage(answer, concepts)`
- `getGrade(coverage)`
- `compareAttempts(first, second)`

Grade thresholds:

- `Strong` = coverage >= 80%
- `Decent` = coverage >= 40%
- `Weak` = coverage < 40%

### Points / scoring

There are two separate point visuals in the current UI:

1. **Decision selection points**
   - triggered when the user clicks one of the 3 crisis options
   - uses the existing decision score already shown in the round (`base score + remaining timer`)

2. **Answer submission points**
   - triggered only for the **normal first answer submission**
   - mapping:
     - `Weak -> +5 pts`
     - `Decent -> +15 pts`
     - `Strong -> +30 pts`
   - intentionally **not** used for improvement, combos, or bonus systems

### Floating points animation

The floating `+X pts` effect is implemented with:

- component: `ui/src/components/FloatingPoints.tsx`
- CSS: `.floating-points` and `@keyframes floating-points-pop` in `ui/src/index.css`

Important implementation detail:

- the floating element only appears if React state survives long enough to render
- a previous bug came from clearing floating state inside `resetInterviewState()`
- another bug came from failing to remount the component properly for repeated animations
- the current implementation uses a changing React `key` at the call site to force animation replay

Current positioning behavior:

- decision-click animation is positioned from the clicked button coordinates
- the answer-submission animation still uses the same floating overlay system and may need further anchoring refinement if UI polish work continues

### Constraints for future work

Until explicitly changed, keep these constraints:

- do **not** generalize Crisis Mode to all topics yet
- do **not** introduce AI evaluation
- do **not** add backend persistence for Crisis Mode state
- do **not** move this into MCP tools yet
- keep the feature deterministic and easy to debug

### If a fresh agent continues this work

Start by checking:

1. `ui/src/crisis/topicArena.ts`
2. `ui/src/pages/ForgeArenaPage.tsx`
3. `ui/src/components/FloatingPoints.tsx`
4. `.floating-points` styles in `ui/src/index.css`

If the user reports that the floating points animation is "not visible", verify in this order:

1. whether `.floating-points` is actually inserted into the DOM
2. whether React state is being cleared too early
3. whether the component is being remounted so the CSS animation restarts
4. whether the overlay position is anchored near the intended UI element

## interview-mcp — State Machine & Tools

Session states: `ASK_QUESTION → WAIT_FOR_ANSWER → EVALUATE_ANSWER → FOLLOW_UP` (loops), then `ENDED`.

**26 MCP tools:** `server_status`, `help_tools`, `start_interview`, `start_scoped_interview`, `start_drill`, `ask_question`, `submit_answer`, `evaluate_answer`, `ask_followup`, `next_question`, `end_interview`, `get_session`, `list_sessions`, `list_topics`, `get_due_flashcards`, `review_flashcard`, `evaluate_flashcard`, `save_flashcard_evaluation`, `log_mistake`, `list_mistakes`, `add_skill`, `list_skills`, `update_skill`, `practice_micro_skill`, `create_exercise`, `list_exercises`

**REST API (port 3001):**
- `GET /api/sessions` — all sessions
- `GET /api/reports` — report metadata list
- `GET /api/reports/:id` — single report markdown
- `GET /api/graph` — knowledge graph JSON
- `GET /api/flashcards` — all flashcards
- `POST /api/flashcards/:id/review` — submit a review rating `{ rating: 1|2|3|4 }`, applies SM-2, returns updated card
- `POST /api/flashcards/:id/answers` — store an optional non-empty raw candidate answer for later evaluation
- `GET /api/mistakes` — all logged mistakes (optional `?topic=` filter)
- `GET /generated/report-ui.html` — HTML report viewer

## report-mcp — Tools

**7 MCP tools:** `server_status`, `help_tools`, `regenerate_report`, `get_report_weak_subjects`, `get_report_full_context`, `generate_report_ui`, `get_graph`

---

## Flashcard System

### What it does

After an interview ends (`end_interview` tool), the system automatically generates flashcards for every question where the candidate scored **below 4**. Cards are stored in `interview-mcp/data/app.db` and scheduled using the **SM-2 spaced repetition algorithm**.

Each card contains:
- **Front** — the original interview question
- **Back** — rich markdown: candidate's answer, interviewer feedback, stronger model answer, and deeper dive (if available)
- **SRS state** — `dueDate`, `interval` (days), `easeFactor`, `repetitions`, `lastReviewedAt`
- **Metadata** — `topic`, `difficulty` (easy/medium/hard mapped from score), `tags`, `source` (sessionId + questionIndex)
- **Lineage** — optional `parentFlashcardId` and `replacedByFlashcardId` so improved cards form a replacement chain instead of losing history

Cards are **idempotent**: re-running `end_interview` on the same session will not create duplicates (deduplication by `id = sessionId-questionIndex`).

### Flashcard Answer Evaluation Loop

The flashcard review system now captures optional free-text recall attempts separately from the SM-2 rating flow:

- `flashcard_answers` stores the raw answer plus a `Pending -> Evaluating -> Completed` state machine
- the UI lets the learner type an answer on the front of the review card before revealing the back
- submitting a rating still performs the normal `review_flashcard` SM-2 update; if answer text exists, the UI also posts it asynchronously to `POST /api/flashcards/:id/answers`
- `evaluate_flashcard` claims pending answers, marks them `Evaluating`, and returns the context Claude needs: flashcard question, expected answer, and candidate answer
- Claude must then call `save_flashcard_evaluation` once per returned answer with the verdict
- Any scheduled or automated flashcard-evaluation workflow is incomplete if it runs only `evaluate_flashcard`; it must also execute `save_flashcard_evaluation` for every returned answer or those answers will remain unfinalized and no replacement/history chain will be persisted
- if the verdict is `needs_improvement`, the old card is archived, a stronger replacement card is created with `parentFlashcardId`, the old card gets `replacedByFlashcardId`, and a linked mistake is logged
- mistakes created from this path can link back to `sourceAnswerId`, `sourceFlashcardId`, and `replacementFlashcardId`

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
- Applies SM-2, updates `app.db`, returns `nextDueDate`, `nextInterval`, `easeFactor`, `repetitions`

**`evaluate_flashcard`**
- Scans for pending entries in `flashcard_answers`
- Marks claimed answers as `Evaluating`
- Returns batched evaluation context so the orchestrator can judge recall quality without exposing hidden guidance to the learner
- Does not by itself create replacement cards, archive old cards, log mistakes, or complete the workflow

**`save_flashcard_evaluation`**
- Args include the `answerId` returned by `evaluate_flashcard` plus Claude's verdict
- Marks the flashcard answer `Completed`
- On weak recall, archives the old card, creates an improved replacement card, and logs a fully linked mistake entry

**Typical Claude review session flow:**
```
1. get_due_flashcards           → see what's due today
2. [for each card]
   review_flashcard { cardId, rating }  → submit recall quality
3. evaluate_flashcard           → claim pending raw answers for evaluation
4. [for each returned answer]
   save_flashcard_evaluation { ... }    → persist verdict / replacement card / linked mistake
5. All done — next review dates and any improved replacement cards are set automatically
```

If a scheduler or automation stops after step 3, the system will not persist flashcard improvement history.

### REST API (for the UI)

| Endpoint | Description |
|---|---|
| `GET /api/flashcards` | Returns `Flashcard[]` — all cards, all topics |
| `POST /api/flashcards/:id/review` | Body: `{ rating: 1\|2\|3\|4 }`. Applies SM-2, saves, returns updated `Flashcard` |
| `POST /api/flashcards/:id/answers` | Body: `{ content: string }`. Saves a non-empty raw recall attempt as `Pending` for later Claude evaluation |

### UI — FlashcardsPage (`/flashcards`)

**Overview mode:**
- Stats row: Total cards / Due Today / Topics / Reviewed
- Topic filter tabs (shown when >2 topics exist)
- Card list split into **Due now** and **Upcoming** sections
- Each row shows topic, question, difficulty badge, due date, repetition count
- Click a row to expand the back (markdown rendered inline)

**Review mode** (launched via "Start Review (N)" button):
- 3D CSS flip card — front shows question, click/button to reveal answer
- Front also includes an optional answer textarea so the learner can attempt recall before reveal
- Back renders full markdown: headers, bullet lists, tables, inline code, code fences, blockquotes
- Progress bar tracks position in the queue
- Rating buttons appear after flip: **Again** (red) / **Hard** (yellow) / **Good** (teal) / **Easy** (green)
- Rating does not depend on whether an answer was typed; when answer text exists it is submitted in the background for later evaluation
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
- Storage: shared SQLite runtime database (`interview-mcp/data/app.db`) plus report/public artifacts on disk
- **Flashcard generation is automatic** — triggered by `end_interview`, no manual step needed
- **SM-2 logic lives only in `srsUtils.ts`** — never duplicate scheduling logic in tools or HTTP handlers

## Knowledge File Improvement Process

When the user asks to improve or update a topic knowledge file under `interview-mcp/data/knowledge/`, follow this exact process.

### Goal
The purpose of every knowledge file is to prepare the user for real senior-level interviews — not just to catalogue information. Questions must build mental models, not test memorisation. Every change should make the file more effective at that goal.

### Step 1 — Load and group by difficulty
Read the target file. Group all questions into their difficulty tiers: `foundation`, `intermediate`, `advanced`. Present them tier by tier. Do not review all 25 questions at once.

### Step 2 — Analyse each tier with two lenses
For every question in the tier, assess:
1. **Interview frequency** — how often does this actually come up at senior level for this topic?
2. **Learning value** — does this build a transferable mental model, or does it just test recall?

Then flag structural problems:

| Problem | Signal | Fix |
|---------|--------|-----|
| Definition-first framing | Starts with "What is X?" or "Explain X" | Reframe to "What problem does X solve?" or a concrete scenario |
| Bundled question | More than one `?` in the prompt | Split or focus on the most valuable ask |
| Laundry-list prompt | Lists things to explain ("Explain A, B, C, and D") | Replace with a colleague misconception or production failure that forces the candidate to cover the same ground |
| Wrong difficulty label | Design question requires knowledge from a harder tier to answer | Relabel |
| Bad ordering | Question A requires concept B which appears later | Swap so the foundational concept comes first |
| Ambiguous scope | The question could be answered at 3 different depths with no guidance | Add a scenario or constraint to anchor the expected depth |

### Step 3 — Present findings, wait for approval
Show a table of flagged questions with the issue and proposed fix for the current tier. Do not make changes yet. Wait for the user to approve, reject, or modify each suggestion.

### Step 4 — Apply approved changes
For each approved change, update **three sections** in sync:
- `## Questions` — rewrite the question text
- `## Difficulty` — update label if the tier changed
- `## Evaluation Criteria` — update the lead sentence and scoring guidance to match the new question framing. The core content (what must be covered) usually stays, but the framing of what "strong" and "weak" looks like should reflect the new scenario.

### Rewriting principles
- **Problem before solution**: "You need a shared counter incremented by many threads without `synchronized`. What does `AtomicInteger` give you?" beats "What are atomic variables?"
- **Scenario over definition**: "Thread A writes `x = 1` but thread B still reads `x = 0` — why?" beats "Explain the Java Memory Model."
- **Misconception to correct**: "A colleague insists all threads always see each other's writes immediately — correct this." beats "Explain multi-core CPU caching."
- **One clear ask per question**: if a question has two `?`, one of them is usually the real question. Keep that one.
- **Evaluation criteria must match**: if the question now leads with a scenario, the criteria must score whether the candidate identified the problem, not just whether they listed the right APIs.

### What not to change
- Do not change questions the user marks as `keep` without comment.
- Do not reorder difficulty tiers — `foundation` must stay learnable before `intermediate`.
- Do not touch the `## Concepts`, `## Summary`, or `## Warm-up Quests` sections unless explicitly asked.
- Do not archive or version the file during this process unless asked.

## Coverage TODO

- Add lightweight coverage reporting with `c8` while keeping the existing Node `--test` runner.
- Add `test:coverage` scripts in `interview-mcp/package.json` and `report-mcp/package.json`.
- Configure terminal summary and `lcov` output.
- Scope coverage to `src/tools/**`, core logic modules, and repository/data access code.
- Exclude `dist`, smoke/runtime scripts, and generated artifacts from coverage.
- Run a baseline coverage pass for `interview-mcp` and `report-mcp` before adding new tests.
- Prioritize new tests for MCP tool validation and error paths.
- Prioritize new tests for interview state-machine transitions and session flow branches.
- Prioritize new tests for repository-backed logic: flashcards, mistakes, exercises, reports, and graph access.
- Add optional root workspace shortcuts such as `test:coverage:interview` and `test:coverage:report` after package scripts are stable.

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
| `Mistake` | Mistake log entry: `mistake`, `pattern`, `fix`, optional `topic`, `createdAt` |
| `Exercise` | Exercise metadata: id, name, slug, topic, language, difficulty (1–5), prerequisites, filePath, createdAt |
| `ExercisePrerequisite` | `{ name: string; reason: string }` — named dependency with explanation |

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

## Difficulty
- Question 1: foundation
- Question 2: intermediate
...

## Evaluation Criteria
- Question 1: <What a strong answer includes. What a weak answer misses. Bonus points.>
- Question 2: ...

## Concepts
- core concepts: word1, word2, word3
- practical usage: word4, word5
- tradeoffs: word6, word7
- best practices: word8, word9

## Warm-up Quests

### Level 0
1. <Lightweight recognition or multiple-choice prompt>
   Answer: <Correct option>
```

Cluster names must be one of: `core concepts`, `practical usage`, `tradeoffs`, `best practices`.

Knowledge topics now commonly include both a per-question difficulty ladder (`foundation`, `intermediate`, `advanced`) and `Warm-up Quests` as a lighter on-ramp before the main interview flow.

### UI — Session type badge

Each session card on `/sessions` shows a `🏗️ Design` badge (teal) for interview sessions. This is derived from `session.interviewType` and defaults gracefully for legacy sessions without the field.

## Development Notes

- Keep it simple and iterative — learning project, not production-grade
- MCP concepts explored: typed tool schemas (Zod), session state machine, microservice-style MCP split, npm workspaces for shared types, spaced repetition scheduling, scheduled tasks, interview type extensibility

## Frozen / Parked Code

### `AnthropicAIProvider` (`interview-mcp/src/ai/anthropic.ts`)

**Do not modify this file.** The `AIProvider` interface (`port.ts`) and its adapters (`anthropic.ts`, `cache.ts`) are considered stable and parked. They cover exactly four operations: `generateQuestions`, `evaluateAnswer`, `extractConcepts`, `generateDeeperDives`.

**New tools must not add methods to `AIProvider`.** If a new tool needs AI-style logic (e.g. generating questions from custom content), that logic must live entirely inside the tool file itself — self-contained, without touching the provider layer. See `startScopedInterview.ts` as the reference pattern: content parsing and question building happen in the tool, no provider calls.

## Skill Backlog

Tracks transferable micro-skills — atomic abilities that appear across multiple problems (e.g. "2D index transformations" applies to rotate matrix, spiral matrix, transpose, pathfinding grids). Each skill has sub-skills with individual confidence scores.

**OCP note:** The skill backlog is entirely additive. It shares the `sessionKind: "drill"` session type and existing tool flow (`ask_question → evaluate_answer → end_interview`). No existing tools were modified.

### Tools

| Tool | Description |
|---|---|
| `add_skill` | Add a skill with sub-skills, related problems, and initial confidence |
| `list_skills` | List backlog, optionally filtered by `maxConfidence` |
| `update_skill` | Update confidence after a drill — sub-skill or overall |
| `practice_micro_skill` | Start a focused micro-skill drill (5-step loop) |

### `practice_micro_skill` flow

```
practice_micro_skill { skill: "2D index transformations", subSkill: "layer boundaries" }
  → recall step: show recallQuestions + known mistakes to candidate
  → wait for recall response
  → ask_question → submit_answer → evaluate_answer → end_interview
  → flashcard auto-generated (existing behavior)
  → update_skill { name, subSkill, confidence }   ← record new confidence
```

If `subSkill` is omitted, auto-picks the sub-skill with the lowest confidence.

### Confidence scale

| Score | Meaning |
|---|---|
| 1 | Just identified — can't explain it |
| 2 | Partial recall — gaps under pressure |
| 3 | Can explain with prompting |
| 4 | Solid — can derive from first principles |
| 5 | Automatic — applies it without thinking |

### Full deliberate practice loop

```
start_scoped_interview { topic: "Rotate Matrix", content: "..." }
  → identify weak micro-skills from evaluation

add_skill {
  name: "2D index transformations",
  subSkills: ["layer boundaries", "coordinate mapping", "offset reasoning"],
  relatedProblems: ["rotate matrix", "spiral matrix", "transpose"],
  confidence: 1
}

practice_micro_skill { skill: "2D index transformations", subSkill: "layer boundaries" }
  → recall → drill → flashcard → update_skill { confidence: 2 }

practice_micro_skill { skill: "2D index transformations", subSkill: "coordinate mapping" }
  → recall → drill → flashcard → update_skill { confidence: 2 }

get_due_flashcards → review   ← SM-2 handles long-term retention
list_skills { maxConfidence: 2 }  ← what to drill next
```

---

## Exercise System (`create_exercise` / `list_exercises`)

Structured coding exercises tied to knowledge topics. Unlike drills (which replay past weak spots) and scoped interviews (which evaluate understanding verbally), exercises are hands-on implementation tasks — the candidate writes actual code and explains their design choices.

**Philosophy:** practice over memorisation. Exercises are small enough to complete in one sitting (Lab.java scale), but rich enough to surface gaps in understanding. If a problem is too hard, the LLM proposes a progression of simpler prerequisite exercises first.

### Tools

| Tool | Description |
|---|---|
| `create_exercise` | Create a structured exercise, write `.md` to knowledge center, persist metadata, return complexity assessment + roadmap |
| `list_exercises` | List all exercises, optionally filtered by `topic` or `maxDifficulty` |

### `create_exercise` — what the tool does

1. Writes a rich `.md` file to `data/knowledge/exercises/<topic>/<slug>.md`
2. Persists metadata (id, name, slug, topic, language, difficulty, prerequisites) to SQLite
3. Runs a complexity assessment:
   - `tooHard = true` if `difficulty >= 4` **or** any named prerequisite exercise does not yet exist in the DB
   - Returns `unmetPrerequisites`, `roadmap` (ordered list of prerequisites by difficulty), and a `reason`
4. Returns an `instruction` block telling the orchestrator what to do next

### Orchestrator flow (enforced by `instruction` in the response)

```
create_exercise { name, topic, difficulty, ... }
  → if tooHard OR unmetPrerequisites non-empty:
      show roadmap to candidate
      ask: "Do you want to start with the prerequisites, or jump straight in?"
      → if prerequisites missing: suggest create_exercise for each first
  → if ready:
      present Learning Goal + Problem Statement
      candidate implements the exercise
      → log_mistake for any gaps found
      → start_scoped_interview { topic, content: problemStatement } as verbal follow-up drill
      → end_interview → flashcard auto-generated for weak answers
```

### Difficulty scale

| Score | Label     | `tooHard`? |
|-------|-----------|-----------|
| 1     | Trivial   | No        |
| 2     | Easy      | No        |
| 3     | Medium    | No        |
| 4     | Hard      | Yes       |
| 5     | Very Hard | Yes       |

### Exercise `.md` format

Files are written under `data/knowledge/exercises/<topic>/` and follow this structure:

```markdown
# Exercise: <Name>

## Topic / Language / Difficulty
**Topic:** <topic>
**Language:** <java | typescript | python | any>
**Difficulty:** <1-5> — <Label>

## Learning Goal
<What the candidate will understand after completing this>

## Prerequisites
- **<ExerciseName>** — <why it must be done first>

## Problem Statement
<Concrete description of what to build>

## Implementation Steps
1. <Simplest first step>
2. ...

## What a Good Solution Looks Like
- <Evaluation criterion 1>
- ...

## Hints
- <Hint shown only when stuck>

## Related Concepts
- <knowledge-file.md: concept1, concept2>
```

### Knowledge file coverage → suggested exercises

Each knowledge topic has 2–3 associated exercises at different difficulty levels:

| Topic | Exercises |
|---|---|
| `java-concurrency` | RaceConditionLab (Easy), ProducerConsumerBlockingQueue (Medium), ThreadPoolExecutorCustom (Hard) |
| `jwt` | JwtSignVerify (Easy), JwtExpiry (Easy), JwtRoleGuard (Medium) |
| `rest-spring-jpa` | CrudEndpoint (Easy), PaginatedEndpoint (Medium), OptimisticLockingRetry (Hard) |
| `payment-api-design` | IdempotencyKeyStore (Medium), PaymentStateMachine (Medium) |
| `url-shortener` | InMemoryShortener (Easy), ShortenerWithTTL (Medium), ShortenerLoadSim (Hard) |

### Where exercises fit in the full learning loop

```
start_interview { topic }          ← understand the domain
  → end_interview                  ← flashcards generated for weak spots
  → start_drill { topic }          ← verbal recall of past weak answers

create_exercise { topic, difficulty: 2 }   ← hands-on: implement something small
  → candidate codes the exercise
  → log_mistake for gaps
  → start_scoped_interview (exercise as content) ← verbal follow-up

get_due_flashcards → review        ← SM-2 long-term retention
list_skills { maxConfidence: 2 }   ← identify next micro-skill to drill
```

---

## Drill Tool (`start_drill`)

Starts a targeted drill on weak spots from a past interview. Implements the deliberate practice loop automatically.

**Requirements:** at least one completed `ENDED` session for the topic. If none exists → returns an error pointing to `start_interview` first.

**What it does:**
1. Finds the most recent completed session for the topic (or a specific `sessionId`)
2. Extracts evaluations where `score < 4` → these become the drill questions
3. Loads logged mistakes for the topic from the mistake log
4. Builds `recallContext` (known mistakes + weak areas) — returned to the orchestrator to run the recall step
5. Creates a new session tagged `sessionKind: "drill"` with `customContent` containing previous feedback as rubric

**Orchestrator flow (enforced via `instruction` in the response):**
```
start_drill { topic }
  → show recallContext to candidate (known mistakes + weak areas)
  → ask: "What do you remember? Where will you struggle?"
  → wait for response
  → ask_question → submit_answer → evaluate_answer → next_question (repeat)
  → end_interview → log_mistake (for any new gaps)
```

**Sessions tagged `sessionKind: "drill"` are distinguishable** in `list_sessions` from full interviews.

**Edge cases:**
- **No completed sessions for the topic** → error: `"Complete a full interview first: start_interview { topic: '...' }"`. Do not attempt a drill without source data.
- **All questions scored ≥ 4 and no logged mistakes** → returns `status: "no_weak_spots"` with avg score. Suggest a new full interview to find fresh gaps.
- **`sessionId` provided but not found** → error immediately.
- **`sessionId` provided but session not `ENDED`** → error; only completed sessions can be used as source.

```
start_drill { topic: "Java OS & JVM Internals" }
start_drill { topic: "JWT authentication", sessionId: "..." }  # target specific session
```

---

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

---

## Algorithm Practice

### Path A — Current approach (supported today)

Use `start_scoped_interview` with a hand-crafted problem as `content`. The candidate explains their approach verbally/in pseudocode; evaluation focuses on pattern identification, complexity analysis, and edge cases.

**Format for `content`:**

```
# Problem: Binary Search

## Problem Statement
Given a sorted array and a target value, return its index or -1 if not found.

## Constraints
- Array is sorted ascending
- No duplicates
- Length 1–10^4

## Expected approach
- Pattern: binary search
- Time: O(log n), Space: O(1)
- Key invariant: left <= right, boundaries shrink every iteration

## Common mistakes
- Using < instead of <= in while condition → misses single-element array
- Not adjusting mid correctly → infinite loop
- Off-by-one in boundary update (left = mid instead of mid + 1)
```

**Invocation:**
```
start_scoped_interview {
  topic: "Binary Search",
  content: "...problem + expected approach + common mistakes...",
  focus: "pattern identification, time/space complexity, edge cases"
}
```

**After the drill:**
- `log_mistake` for any pattern errors, boundary mistakes, or complexity gaps
- `start_drill { topic: "Binary Search" }` on the next session to target the same weak spots

**Limitations of Path A:**
- Evaluation is text-based — no code execution
- No structured problem library — problems must be written manually per session
- `interviewType` defaults to `"design"` — no code-specific routing

---

### Path B — Future: proper algorithm support (parked)

When algorithm practice becomes a primary use case, the following should be built:

**1. Algorithm knowledge files**
New files in `interview-mcp/data/knowledge/` following the same format but with:
- Problem statement + constraints
- Expected pattern + complexity
- Common mistake patterns (not evaluation criteria)
- One or two canonical examples

Candidate files: `binary-search.md`, `two-pointers.md`, `sliding-window.md`, `bfs-dfs.md`, `dynamic-programming.md`

**2. Activate `interviewType: "code"`**
Currently reserved in the type system. When activated:
- Different question format: problem + constraints block
- Evaluation rubric: approach pattern → complexity → edge cases → code quality
- `start_interview { topic: "Binary Search", interviewType: "code" }`

**3. `practice_pattern` tool**
Single-pattern, single-problem drill. Shorter than a full interview:
- One problem
- Recall: "what's the invariant / when does this pattern apply?"
- Attempt: explain approach + write pseudocode
- Feedback: pattern correctness, complexity, edge cases missed
- Auto log_mistake + generate flashcard

**Micro-skill taxonomy for algorithms:**

| Pattern | Micro-skills |
|---|---|
| Binary search | Boundary condition (`<` vs `<=`), mid calculation, shrink direction |
| Two pointers | Collision vs same-direction, when to advance which pointer |
| Sliding window | Expand/shrink condition, window validity invariant |
| DFS/BFS | Stack vs queue, visited set, when to mark visited |
| Dynamic programming | State definition, recurrence relation, base cases, top-down vs bottom-up |
| Backtracking | Pruning condition, state restore on backtrack |
