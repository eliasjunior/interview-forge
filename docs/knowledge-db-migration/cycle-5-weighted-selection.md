# Cycle 5 - Weighted Selection

## Goal

Use authored MCQ weights plus accumulated warm-up history to prioritize questions that need more practice.

## Scope

This cycle changes selection ranking only. It keeps the same warm-up round size and keeps recently asked questions deprioritized.

## Implementation

- Updated `interview-mcp/src/tools/deps.ts` with `loadWarmupStats(topicTitle, level)`.
- Implemented `loadWarmupStats` in `interview-mcp/src/server.ts`.
- Updated `interview-mcp/src/tools/startWarmUp.ts` so selection receives a stats map and calculates `effectiveWeight`.
- Updated test dependency stubs with a no-op `loadWarmupStats`.

## Stats Query

`loadWarmupStats` looks up the topic by title, then reads warm-up rows for that topic and level. It uses a left join from `warmup_questions` to `warmup_history`, grouped by question, returning:

- `stem`
- `weight`
- `correctCount`
- `incorrectCount`

## Ranking Formula

Each warm-up candidate gets:

```text
effectiveWeight = max(1, weight + incorrectCount - floor(correctCount * 0.5))
```

Selection then sorts by:

1. recently asked questions last
2. higher `effectiveWeight` first
3. lower historical ask count first
4. random tie-breaker

After selecting the top candidates, the existing ordering pass still arranges them to avoid repetitive answer-key patterns.

## Behavior

Wrong answers push an MCQ higher in the next round. Correct answers gradually reduce priority without removing the question permanently.

## Verification

- Ran a clean build successfully.
- Ran a sanity check confirming equal priority when no history exists and boosted priority once incorrect history is present.

## Handoff

Cycle 5 completed adaptive MCQ selection. Cycle 6 can now make repeated rounds useful by returning a clear summary and repeat prompt after each warm-up session ends.
