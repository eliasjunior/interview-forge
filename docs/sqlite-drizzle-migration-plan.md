# SQLite + Drizzle Migration Plan

## Goal

Replace the current file-owned runtime data under `interview-mcp/data` with a database-backed persistence layer using:

- `SQLite` as the local runtime database
- `Drizzle ORM` for typed schema and migrations
- a repository layer that can later be adapted to `Postgres` with minimal service/tool changes

This migration is about runtime data only. It should move:

- `sessions.json`
- `flashcards.json`
- `graph.json`
- report metadata if needed

It should not move knowledge source files or generated report artifacts in the first pass:

- `interview-mcp/data/knowledge/*`
- `interview-mcp/data/reports/*.md`
- `interview-mcp/public/generated/*`

## Recommendation

Use this stack in `interview-mcp`:

- `drizzle-orm`
- `drizzle-kit`
- `better-sqlite3`

Why this stack:

- lowest local complexity for this repo
- sync SQLite access is fine for the current single-process local app
- Drizzle gives typed schema, migrations, and a cleaner future path to Postgres

## Current State

Runtime persistence is currently split across direct file access in:

- [`interview-mcp/src/server.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/server.ts)
- [`interview-mcp/src/http.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/http.ts)
- [`interview-mcp/src/http/weakReports.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/http/weakReports.ts)

Current file-owned data:

- `sessions.json`
- `flashcards.json`
- `graph.json`

The MCP tool layer is already partially isolated through [`interview-mcp/src/tools/deps.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/tools/deps.ts), which is the right seam to preserve.

## Target Architecture

```text
server.ts / http.ts
  -> repository interfaces
  -> drizzle persistence layer
  -> SQLite database file

tools / services
  -> depend on repositories or higher-level deps
  -> do not read/write JSON files directly
```

## Database File

Recommended location:

- `interview-mcp/data/app.db`

Reason:

- keeps local data colocated with the existing project runtime data
- easy to inspect and back up
- no special environment required for local development

## Schema Proposal

These tables map the current data model and keep a clean path to Postgres later.

### `sessions`

Purpose:

- root record for each interview or study session

Columns:

- `id` text primary key
- `topic` text not null
- `interview_type` text null
- `session_kind` text null
- `study_category` text null
- `source_path` text null
- `source_type` text null
- `seeded` integer not null default `0`
- `custom_content` text null
- `focus_area` text null
- `state` text not null
- `current_question_index` integer not null
- `summary` text null
- `knowledge_source` text not null
- `created_at` text not null
- `ended_at` text null

Notes:

- Store ISO timestamps as text in SQLite for now
- `questions`, `messages`, `evaluations`, and `concepts` should not remain nested JSON on this table

### `session_questions`

Purpose:

- preserve ordered questions separately from the root session row

Columns:

- `id` integer primary key autoincrement
- `session_id` text not null
- `position` integer not null
- `question` text not null

Constraints:

- foreign key to `sessions.id`
- unique `(session_id, position)`

### `session_messages`

Purpose:

- transcript message stream

Columns:

- `id` integer primary key autoincrement
- `session_id` text not null
- `position` integer not null
- `role` text not null
- `content` text not null
- `timestamp` text not null

Constraints:

- foreign key to `sessions.id`
- unique `(session_id, position)`

### `session_evaluations`

Purpose:

- store one evaluation row per question index

Columns:

- `id` integer primary key autoincrement
- `session_id` text not null
- `question_index` integer not null
- `question` text not null
- `answer` text not null
- `strong_answer` text null
- `score` integer not null
- `feedback` text not null
- `needs_follow_up` integer not null
- `follow_up_question` text null
- `deeper_dive` text null

Constraints:

- foreign key to `sessions.id`
- unique `(session_id, question_index)`

### `session_concepts`

Purpose:

- normalized concept extraction output

Columns:

- `id` integer primary key autoincrement
- `session_id` text not null
- `word` text not null
- `cluster` text not null

Constraints:

- foreign key to `sessions.id`

### `flashcards`

Purpose:

- replace `flashcards.json`

Columns:

- `id` text primary key
- `front` text not null
- `back` text not null
- `topic` text not null
- `difficulty` text not null
- `created_at` text not null
- `due_date` text not null
- `interval` integer not null
- `ease_factor` real not null
- `repetitions` integer not null
- `last_reviewed_at` text null
- `source_session_id` text not null
- `source_question_index` integer not null
- `source_original_score` integer not null
- `title` text null
- `focus_item` text null
- `study_notes` text null

Constraints:

- foreign key `source_session_id` -> `sessions.id`

### `flashcard_tags`

Purpose:

- normalize current `tags: string[]`

Columns:

- `id` integer primary key autoincrement
- `flashcard_id` text not null
- `tag` text not null

Constraints:

- foreign key to `flashcards.id`
- unique `(flashcard_id, tag)`

### `flashcard_concepts`

Purpose:

- support richer deep-dive metadata independently from tags

Columns:

- `id` integer primary key autoincrement
- `flashcard_id` text not null
- `concept` text not null
- `position` integer not null

Constraints:

- foreign key to `flashcards.id`
- unique `(flashcard_id, position)`

### `graph_nodes`

Purpose:

- replace stored node list from `graph.json`

Columns:

- `id` text primary key
- `label` text not null

### `graph_node_clusters`

Purpose:

- support one node belonging to multiple clusters

Columns:

- `id` integer primary key autoincrement
- `node_id` text not null
- `cluster` text not null

Constraints:

- foreign key to `graph_nodes.id`
- unique `(node_id, cluster)`

### `graph_edges`

Purpose:

- replace graph edges from `graph.json`

Columns:

- `id` integer primary key autoincrement
- `source` text not null
- `target` text not null
- `weight` integer not null

Constraints:

- foreign keys to `graph_nodes.id`
- unique `(source, target)`

### `graph_sessions`

Purpose:

- replace the top-level `sessions: string[]` currently stored in `graph.json`

Columns:

- `id` integer primary key autoincrement
- `session_id` text not null unique

## Repository Shape

Do not let tools or routes talk to Drizzle directly. Add a repository layer first.

Recommended split:

- `SessionRepository`
- `FlashcardRepository`
- `GraphRepository`
- optional `ReportRepository` later if report metadata moves into DB

Suggested location:

- `interview-mcp/src/db/`
- `interview-mcp/src/repositories/`

Suggested files:

- `interview-mcp/src/db/client.ts`
- `interview-mcp/src/db/schema.ts`
- `interview-mcp/src/db/migrate.ts`
- `interview-mcp/src/repositories/sessions.ts`
- `interview-mcp/src/repositories/flashcards.ts`
- `interview-mcp/src/repositories/graph.ts`

## Interface Strategy

Keep domain-facing interfaces close to today’s shapes so the rest of the app changes less.

### `SessionRepository`

Methods:

- `getAll(): Session[]`
- `getById(id: string): Session | null`
- `save(session: Session): void`
- `saveMany(sessions: Session[]): void` only if needed
- `replaceAll(sessions: Record<string, Session>): void` only for migration compatibility, then remove

### `FlashcardRepository`

Methods:

- `getAll(): Flashcard[]`
- `getById(id: string): Flashcard | null`
- `save(card: Flashcard): void`
- `saveMany(cards: Flashcard[]): void`
- `updateReview(cardId: string, updates): Flashcard | null`

### `GraphRepository`

Methods:

- `get(): KnowledgeGraph`
- `save(graph: KnowledgeGraph): void`

Important:

- `GraphRepository` can start as a compatibility wrapper around the normalized tables
- later, graph persistence could be replaced by recomputing from concepts if desired

## Migration Approach

Use a phased cutover, not a big-bang rewrite.

### Phase 1: Add Database Infrastructure

Changes:

- add Drizzle and SQLite dependencies in [`interview-mcp/package.json`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/package.json)
- add Drizzle config
- add schema definitions
- add migration scripts
- create initial SQLite database file and first migration

Deliverables:

- database can be created from migrations with no app logic changed yet

### Phase 2: Add Repository Layer

Changes:

- implement repositories that read/write through Drizzle
- keep JSON readers untouched for the moment
- add mapping functions from relational rows <-> shared domain types

Deliverables:

- repository layer exists and is testable independently

### Phase 3: Add One-Time Import Script

Changes:

- create a migration/import script that reads:
  - `sessions.json`
  - `flashcards.json`
  - `graph.json`
- writes equivalent rows into SQLite

Suggested file:

- `interview-mcp/src/db/importJsonData.ts`

Requirements:

- idempotent enough for local reruns or at least clear about overwrite behavior
- validate row counts after import
- log imported session, flashcard, and graph counts

Deliverables:

- existing data can be moved into the database without touching runtime code

### Phase 4: Switch MCP Server Persistence

Changes:

- replace JSON-backed helpers in [`interview-mcp/src/server.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/server.ts)
- wire `ToolDeps` to repository-backed implementations

Important:

- preserve the current `ToolDeps` surface first
- do not refactor all tools at the same time

Deliverables:

- MCP server uses SQLite via repositories

### Phase 5: Switch HTTP Server Persistence

Changes:

- replace inline file access in [`interview-mcp/src/http.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/http.ts)
- update [`interview-mcp/src/http/weakReports.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/http/weakReports.ts) to read sessions through the repository or a narrow adapter

Deliverables:

- HTTP routes use SQLite-backed data consistently

### Phase 6: Remove JSON Runtime Dependency

Changes:

- stop reading `sessions.json`, `flashcards.json`, and `graph.json` in app code
- keep import script for legacy migration only
- optionally archive old JSON files after verification

Deliverables:

- SQLite is the single runtime source of truth

## Scripts To Add

In [`interview-mcp/package.json`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/package.json):

- `db:generate`
- `db:migrate`
- `db:studio` optional
- `db:import-json`

Example intent:

- `db:generate`: generate migration from schema changes
- `db:migrate`: apply migrations to local SQLite
- `db:import-json`: import legacy file data into the database

## Postgres Readiness Rules

To keep the path to Postgres clean:

- do not use SQLite-specific SQL outside the repository layer
- keep domain models in `shared` unchanged
- keep repository interfaces independent from Drizzle types
- prefer normalized tables over JSON blobs for session internals
- keep timestamps and enums represented in ways that translate cleanly to Postgres

## What Stays on Disk For Now

Keep these as files in phase 1:

- knowledge markdown and pdf sources
- generated markdown reports
- generated report UI JSON and HTML

Why:

- they are content/artifacts, not hot runtime state
- moving them now would complicate the migration without much benefit

## Risks

- session reconstruction from normalized rows must preserve ordering for `questions`, `messages`, and `evaluations`
- graph data may drift if merge/save semantics are not reproduced exactly
- weak report routes currently depend on direct session-file loading
- dual source of truth during migration is dangerous if runtime writes hit both JSON and SQLite inconsistently

## Guardrails

- no runtime dual-write period unless strictly necessary
- import once, then switch readers cleanly
- add tests for row-to-domain reconstruction
- verify counts before removing JSON reads

## Verification Checklist

- migrated session count matches legacy JSON count
- migrated flashcard count matches legacy JSON count
- a known session reconstructs with ordered questions/messages/evaluations intact
- review flashcard updates still change due date, interval, ease factor, and repetitions correctly
- graph API returns the same logical structure as before
- MCP tools still list sessions, get sessions, and review flashcards correctly

## Recommended Execution Order

1. Add dependencies and Drizzle config
2. Add schema and first migration
3. Add repository layer
4. Add import script
5. Import current JSON data into SQLite
6. Switch `server.ts` to repositories
7. Switch `http.ts` and `weakReports.ts`
8. Verify parity
9. Remove JSON runtime reads

## Concrete Next Step

The next implementation step should be:

1. add the database tooling and folder structure
2. define `schema.ts` for the tables above
3. add repository interfaces and row-mapping helpers

Do not start by editing tool logic or UI logic. The first cut should establish the persistence seam cleanly.
