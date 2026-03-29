# Mock Interview MCP

## Highest Priority Rule

In every new Desktop app thread in this project, the first response must be an MCP connection check.

Before answering the user's request, first state whether `interview-mcp` is connected in the current Desktop session.

- If it is not connected, say: `Before I continue, I should check whether interview-mcp is connected in this Desktop session. It is not connected, so I have to stop here.`
- Do not answer the user's actual request until this check has been reported.

## Project Overview

A study project for learning MCP (Model Context Protocol) by building a mock interview system around two MCP servers, a shared SQLite data store, and a React dashboard.

The system runs mock technical interviews through Claude, evaluates answers, builds a cumulative knowledge graph across sessions, generates per-session reports, and adds learning loops such as flashcards, mistake logging, targeted drills, and a simple reward system with level-ups and visible progress in the UI.

## Current Monorepo Structure

```text
first-mcp/
├── AGENTS.md
├── CLAUDE.md
├── interview-mcp/   # MCP server, data owner, REST API
├── report-mcp/      # MCP server, analytics and report generation
├── ui/              # React + Vite dashboard
└── shared/          # Shared TypeScript domain types
```

## Package Responsibilities

- `interview-mcp`: source of truth for sessions, graph data, reports, mistakes, flashcards, and the HTTP API on port `3001`
- `report-mcp`: read-mostly analytics/report MCP server over the shared database
- `ui`: React dashboard for sessions, reports, graph visualisation, flashcard review, and visible learner progress
- `shared`: compile-time-only TypeScript types used by the other packages

## Core Features

- **Mock Interview**: state-machine-driven interview sessions through MCP
- **Answer Evaluation**: scored answers, feedback, and stronger model answers
- **Knowledge Graph**: cumulative concept graph merged across completed sessions
- **Reports**: Markdown reports and interactive HTML report viewers per session
- **Flashcards**: automatic spaced-repetition cards for weak answers
- **Mistake Log**: persistent mistakes/patterns/fixes for deliberate practice
- **Targeted Drills**: drill sessions generated from prior weak spots
- **Scoped Interviews**: interviews generated from user-provided specs/docs without using the provider layer
- **Rewards and Progress**: simple level-up system with progress indicators in the UI to reinforce continued practice

## Tech Stack

- **MCP servers**: `interview-mcp` and `report-mcp`
- **LLM orchestration**: Claude Desktop / Claude Code as the orchestrator
- **Optional worker LLM**: Anthropic-backed provider under `interview-mcp/src/ai/` when `AI_ENABLED=true`
- **Frontend**: React + Vite
- **Graph visualisation**: D3-based graph page
- **Storage**: shared SQLite database at `interview-mcp/data/app.db`

## Architecture Notes

- `interview-mcp` owns runtime data and exposes both MCP tools and a REST API
- `report-mcp` reads from the shared SQLite database and generates report artifacts
- `ui` fetches from the `interview-mcp` HTTP API rather than owning local data
- Two LLM roles can exist:
  - **Orchestrator**: Claude in the host app, which decides tool calls and drives the interview
  - **Worker**: the optional Anthropic-backed `AIProvider`, used for question generation, evaluation, concept extraction, and deeper dives when enabled

## MCP Server Goals

This remains a learning project. The main concepts explored here are:

- defining and exposing MCP tools with structured schemas
- enforcing a session state machine across interview turns
- returning structured data for reports, graph views, flashcards, and drills
- splitting responsibilities across multiple MCP servers
- integrating MCP with Codex/Claude Desktop against a local development setup

## interview-mcp Tools

Current tool surface in `interview-mcp`:

- `server_status`
- `help_tools`
- `list_topics`
- `start_interview`
- `start_scoped_interview`
- `start_drill`
- `ask_question`
- `submit_answer`
- `evaluate_answer`
- `ask_followup`
- `next_question`
- `end_interview`
- `get_session`
- `list_sessions`
- `get_due_flashcards`
- `review_flashcard`
- `log_mistake`
- `list_mistakes`
- `add_skill`
- `list_skills`
- `update_skill`
- `practice_micro_skill`
- `create_exercise`
- `list_exercises`

## report-mcp Tools

- `server_status`
- `help_tools`
- `regenerate_report`
- `get_report_weak_subjects`
- `get_report_full_context`
- `generate_report_ui`
- `get_graph`

## Interview State Machine

Primary session loop:

`ASK_QUESTION -> WAIT_FOR_ANSWER -> EVALUATE_ANSWER -> FOLLOW_UP`

This repeats per question and ends in `ENDED`.

## Interview Content Sources

- Standard interview topics come from curated knowledge files under `interview-mcp/data/knowledge/*.md`
- Scoped interviews come from user-provided content such as a README, architecture doc, or project spec
- Exercises live under `interview-mcp/data/knowledge/exercises/<topic>/` and can feed follow-up scoped interviews

## Knowledge Content Structure

- Knowledge files include a topic summary, interview questions, evaluation criteria, and concept clusters
- Topics may also include `Warm-up Quests` as a lightweight quiz layer before the main interview questions
- Interview questions are organized with explicit difficulty levels such as foundation, intermediate, and advanced so the app can present a clearer progression
- Warm-up content uses simple level-based progression in the knowledge files, for example `Level 0`, before deeper interview questions

## Learning System Context

### Flashcards

- `end_interview` automatically creates flashcards for questions scored below `4`
- cards are scheduled with the SM-2 spaced repetition algorithm
- flashcards are stored in `interview-mcp/data/app.db`
- review happens through `get_due_flashcards` and `review_flashcard`

### Mistake Logging

- mistakes can be persisted with `log_mistake`
- logged entries capture the mistake, the pattern behind it, and the fix
- mistakes are queryable with `list_mistakes`

### Targeted Drills

- `start_drill` creates a deliberate-practice session from past weak answers and logged mistakes
- it requires at least one completed session for the topic
- it returns recall context so the orchestrator can start with retrieval before asking questions
- drill sessions are distinct from full interviews via `sessionKind: "drill"`

### Scoped Interviews

- `start_scoped_interview` builds an interview from user-provided content such as a README, architecture doc, or project spec
- question generation is self-contained in the tool and must not extend the `AIProvider`
- focus defaults to robustness, reliability, and extensibility in a production environment unless overridden

### Exercise System

- `create_exercise` creates a structured coding exercise tied to a knowledge topic and stores it under `data/knowledge/exercises/<topic>/`
- exercises include learning goal, problem statement, incremental steps, evaluation criteria, hints, and prerequisites
- after creation the tool returns a `complexityAssessment` with `tooHard`, `unmetPrerequisites`, and a `roadmap`
- if `tooHard` is true, show the roadmap and ask the candidate whether to start with prerequisites or jump in directly
- if unmet prerequisites exist, suggest creating them first with `create_exercise` before proceeding
- `list_exercises` returns all exercises, optionally filtered by `topic` or `maxDifficulty`

**Orchestrator flow:**
```
create_exercise { name, topic, difficulty, ... }
  → if tooHard: show roadmap → ask candidate → optionally create prerequisites first
  → if ready: present Learning Goal + Problem Statement → candidate implements
  → log_mistake for any gaps found during implementation
  → start_scoped_interview { topic, content: exercise problemStatement } as follow-up drill
  → end_interview → flashcard auto-generated
```

**Difficulty scale:**

| Score | Label     |
|-------|-----------|
| 1     | Trivial   |
| 2     | Easy      |
| 3     | Medium    |
| 4     | Hard      |
| 5     | Very Hard |

- `tooHard` triggers when `difficulty >= 4` OR any prerequisite exercise does not yet exist
- exercise `.md` files live at `data/knowledge/exercises/<topic>/<slug>.md`
- exercise metadata is persisted to SQLite alongside sessions and flashcards

## MCP Execution Rules

- When the user asks to run an MCP tool, first verify that the relevant MCP server is actually connected and that the requested tool is available in the current session.
- If the MCP server is unavailable, disconnected, or the tool is not exposed, state that explicitly and stop instead of proceeding as if the tool had run.
- Prefer a preflight check before interview commands, such as `server_status`, `help_tools`, or `list_topics`.
- Treat MCP connection problems as a blocking issue for tool execution, not as something to silently work around.

## Interview Guardrails

- Treat interview questions and evaluation rubrics as separate roles, even if a tool returns both in one payload.
- Candidate-facing output must include only the actual interview prompt and neutral procedural instructions needed to continue.
- Do not reveal evaluator-only fields such as `evaluationCriteria`, rubric text, expected answer structure, scoring hints, model answers, or hidden grading guidance to the candidate.
- If `AI_ENABLED=false`, the orchestrator may use evaluator-only rubric fields to score the answer, but those fields must remain hidden while the question is being asked.
- Keep the interview realistic: ask the question, wait for the candidate's answer, evaluate it, then continue.

## No Simulation Rule

- If a user asks to run a tool, do not simulate, roleplay, or manually imitate the tool result when the actual tool call cannot be executed.
- Do not continue the workflow in chat as though the MCP call succeeded.
- If execution is blocked, report the exact reason clearly: missing MCP connection, unavailable tool, invalid topic, invalid session state, or runtime failure.

## Development Notes

- Keep the project simple and iterative; prioritize learning value over production polish.
- Shared domain types belong in `shared/src/types.ts`; avoid duplicating type definitions inside package-local files.
- `interview-mcp` is the data owner; new features should respect that boundary.
- The `AIProvider` layer is intentionally narrow and stable. New tools should not expand it unless there is a deliberate architecture change.
- Algorithm-style practice is currently supported through `start_scoped_interview`; first-class `interviewType: "code"` workflows are parked for future work.

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
