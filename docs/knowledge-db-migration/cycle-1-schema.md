# Cycle 1 - Schema

## Goal

Add the database tables needed for the knowledge read model. This cycle intentionally touched only schema and migration state.

## Scope

Added five tables:

| Table | Purpose |
|---|---|
| `topics` | Topic metadata: slug, category, title, summary |
| `topic_questions` | Interview questions for each topic |
| `topic_concepts` | Topic concept terms grouped by cluster |
| `warmup_questions` | Warm-up MCQs and linked question metadata |
| `warmup_history` | Per-session history for warm-up answers |

## Implementation

- Updated `interview-mcp/src/db/schema.ts` with Drizzle table definitions and relations.
- Generated migration `interview-mcp/drizzle/0021_brown_secret_warriors.sql`.
- Edited the generated migration so it contained only the five new knowledge tables.
- Applied the migration to `interview-mcp/data/app.db`.

## Notes

The generated migration initially included unrelated full-table creation and already-applied `ALTER TABLE` statements. Those were stripped before applying the migration so Cycle 1 stayed focused on the knowledge tables only.

## Verification

- Migration applied successfully to `app.db`.
- All five tables were confirmed live.

## Handoff

Cycle 1 completed the database shape needed for the read model. Cycle 2 can safely populate the four content tables while leaving `warmup_history` empty until runtime tracking is added.
