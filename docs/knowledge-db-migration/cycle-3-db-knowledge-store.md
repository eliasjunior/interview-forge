# Cycle 3 - DbKnowledgeStore

## Goal

Replace file-backed runtime knowledge reads with database-backed reads while preserving the existing `KnowledgeStore` port and MCP behavior.

## Scope

Implemented a new DB-backed knowledge store and swapped it in at the composition root.

## Implementation

- Added `interview-mcp/src/knowledge/db.ts`.
- Updated `interview-mcp/src/knowledge/index.ts` so `createKnowledgeStore` creates a `DbKnowledgeStore`.
- Updated `interview-mcp/src/server.ts` so the database is created before the knowledge store and passed into `createKnowledgeStore`.
- Updated `interview-mcp/src/db/backfillStrongAnswers.ts`, the other call site for `createKnowledgeStore`.

## Behavior

The new store reads from:

- `topics`
- `topic_questions`
- `topic_concepts`
- `warmup_questions`

The Markdown files remain on disk and continue to be treated as the source of truth. The database stays a derived read model refreshed by re-running the seed script.

## Compatibility Notes

`DbKnowledgeStore` implements the same `KnowledgeStore` port as `FileKnowledgeStore`, so MCP behavior is expected to remain unchanged.

Topic lookup behavior remains consistent with the file store. For example, a lookup for `jwt` or the full normalized title works, while a partial display title such as `JSON Web Token` does not match the authored title `JWT - JSON Web Token`.

## Verification

- Ran a clean build successfully.
- Ran a smoke check confirming topics load from the database.
- Verified the seeded DB content is readable through the new store.

## Handoff

Cycle 3 completed the read path migration. Cycle 4 can now add runtime writes to `warmup_history` when warm-up MCQs are answered.
