# Knowledge DB Migration Logs

This directory tracks the migration of authored knowledge content from Markdown-only reads to a SQLite-backed read model.

The Markdown files under `interview-mcp/data/knowledge/` remain the source of truth. The database tables are a derived read model used by the MCP server.

## Completed Cycles

| Cycle | Status | Log |
|---|---|---|
| 1 | Done | [Schema](cycle-1-schema.md) |
| 2 | Done | [Seed script](cycle-2-seed-script.md) |
| 3 | Done | [DbKnowledgeStore](cycle-3-db-knowledge-store.md) |
| 4 | Done | [Warm-up history](cycle-4-warmup-history.md) |
| 5 | Done | [Weighted selection](cycle-5-weighted-selection.md) |
| 6 | Done | [Warm-up loop](cycle-6-warmup-loop.md) |

## Target Tables

- `topics`
- `topic_questions`
- `topic_concepts`
- `warmup_questions`
- `warmup_history`

## Cycle Plan

1. Schema and migration: add the five knowledge tables and apply them to `app.db`.
2. Seed script: parse Markdown files and populate content tables idempotently.
3. DbKnowledgeStore: replace file-backed knowledge reads with DB-backed reads while keeping the same port.
4. Warm-up history: record each MCQ answer as correct or incorrect.
5. Weighted selection: bias warm-up selection toward missed questions and reduce mastered ones.
6. Warm-up loop: return round summaries and allow another round in the same session.

## Final Flow

```text
start_warm_up { topic, level }
  -> ask_question x N
  -> evaluate_answer x N
      -> saveWarmupHistory(...)
  -> end_interview
      -> round summary + canRepeat: true
  -> candidate chooses another round or full interview
```
