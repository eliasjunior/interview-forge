# Tools and API Reference

[← Back to README](../README.md)

## interview-mcp — 27 tools

This server drives the interview session from start to finish.

### Core interview flow

| Tool | What it does |
|---|---|
| `server_status` | Preflight check — returns version, loaded topics, session counts, graph size. |
| `help_tools` | Lists all tools with short descriptions and example payloads. |
| `list_topics` | Lists all knowledge topics available for interviews. |
| `start_interview` | Creates a new session, loads questions from a knowledge file (or generates via AI). Returns `sessionId`. |
| `start_scoped_interview` | Starts an interview from user-provided content (spec, README, architecture doc). Questions are generated locally by parsing the content — no AI call needed. |
| `build_scope` | Builds a focused content block for `start_scoped_interview` from structured inputs. Optionally saves the result to `data/knowledge/scopes/<slug>.md` for reuse. |
| `start_drill` | Starts a targeted drill on weak spots from a past interview. Requires at least one completed session for the topic. |
| `ask_question` | Returns the current question for a session in `ASK_QUESTION` state. |
| `submit_answer` | Records the candidate's answer and advances state to `EVALUATE_ANSWER`. |
| `evaluate_answer` | Scores the answer (1–5), writes feedback and a model answer. Advances to `FOLLOW_UP`. |
| `ask_followup` | Generates and asks a follow-up question based on the candidate's answer. |
| `next_question` | Moves to the next question, or ends the session if all questions are done. |
| `end_interview` | Ends the session, builds the Markdown report, merges concepts into the graph, generates flashcards for weak answers. |
| `get_session` | Returns the full session record (state, questions, evaluations, graph). |
| `list_sessions` | Lists all sessions with summary metadata. |

### Flashcards

| Tool | What it does |
|---|---|
| `get_due_flashcards` | Returns flashcards due for review today, sorted most-overdue first. Supports optional topic filter. |
| `review_flashcard` | Submits a recall rating and applies SM-2 to schedule the next review. |
| `generate_flashcard_variation` | Returns card context plus a variation angle so the orchestrator can ask the same concept from a fresh perspective. |
| `create_flashcard` | Creates a flashcard directly from supplied front/back content without needing an interview session. |

### Mistake log

| Tool | What it does |
|---|---|
| `log_mistake` | Records a mistake pattern with what went wrong, when it happens, and the correct fix. |
| `list_mistakes` | Lists all logged mistakes, optionally filtered by topic. |

### Skill backlog

| Tool | What it does |
|---|---|
| `add_skill` | Adds a transferable micro-skill with sub-skills, related problems, and initial confidence. |
| `list_skills` | Lists skills in the backlog, optionally filtered by `maxConfidence`. |
| `update_skill` | Updates confidence after a drill — per sub-skill or overall. |
| `practice_micro_skill` | Starts a focused micro-skill drill. |

### Coding exercises

| Tool | What it does |
|---|---|
| `create_exercise` | Creates a structured exercise grounded in a real-world scenario and returns a complexity assessment plus prerequisite roadmap. |
| `list_exercises` | Lists exercises, optionally filtered by topic, max difficulty, or tags. |

**Session state machine:** `ASK_QUESTION → WAIT_FOR_ANSWER → EVALUATE_ANSWER → FOLLOW_UP` (loops per question) → `ENDED`

## report-mcp — 8 tools

This server is focused on analysing and presenting completed sessions.

| Tool | What it does |
|---|---|
| `server_status` | Preflight check — returns version and AI mode. |
| `help_tools` | Lists all tools with short descriptions and example payloads. |
| `regenerate_report` | Re-runs deeper dives and rewrites the Markdown report for any completed session. |
| `get_report_weak_subjects` | Identifies low-scoring questions and returns structured context ready to pipe into `generate_report_ui`. |
| `get_report_full_context` | Returns all evaluated Q/A pairs for a session, with a pre-filled `nextCall` scaffold for `generate_report_ui`. |
| `generate_report_ui` | Writes a per-session JSON dataset and returns a viewer URL. |
| `get_progress_overview` | Aggregates ended sessions into score trends, topic progress, repeated-topic improvement, weak-question rate, and recent-session summaries. |
| `get_graph` | Returns the full cumulative knowledge graph from the shared SQLite store. |

## REST API

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
