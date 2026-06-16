# Cycle 2 - Seed Script

## Goal

Create a one-time, idempotent seed script that parses Markdown knowledge files and writes the derived content into the new knowledge tables.

## Scope

The script populates:

- `topics`
- `topic_questions`
- `topic_concepts`
- `warmup_questions`

The script does not write to `warmup_history`, because history is runtime data and has no Markdown equivalent.

## Implementation

- Added `interview-mcp/src/db/seed-knowledge.ts`.
- The script walks category folders under `interview-mcp/data/knowledge/`.
- It parses topic title, summary, interview questions, difficulty metadata, concept clusters, and Level 0 warm-up MCQs.
- It is idempotent and safe to re-run.

## Seed Results

Baseline seed inserted:

| Entity | Count |
|---|---:|
| Topics | 21 |
| Questions | 317 |
| Concept terms | 805 |
| Warm-up MCQs | 135 |

Six files had no parsed MCQs because they do not currently include a Level 0 warm-up section:

- `rotate-matrix-algorithm`
- `mortgage-rest-design`
- `payment-api-design`
- `java-os-jvm`
- `js-fundamentals`

This is content work, not a seed script issue.

## Verification

- Ran the seed script against `app.db`.
- Checked database counts after seeding.
- Confirmed that all 21 discovered knowledge files were seeded.

## Handoff

Cycle 2 completed the derived content population path. Cycle 3 can switch runtime knowledge reads from files to the database while keeping Markdown as the source of truth.
