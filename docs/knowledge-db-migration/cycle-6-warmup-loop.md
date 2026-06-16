# Cycle 6 - Warm-up Loop

## Goal

Close the warm-up practice loop by returning a concise round summary and allowing the candidate to choose another round or move into the full interview.

## Scope

This cycle updates `end_interview` for warm-up sessions. It does not change full interview report generation.

## Implementation

- Updated `interview-mcp/src/tools/endInterview.ts`.
- Added a warm-up-specific branch that runs before the normal full-interview finalization path.
- The branch returns structured round data and orchestrator instructions instead of generating the normal interview report.

## Warm-up End Response

For `sessionKind === "warmup"`, `end_interview` returns:

- `sessionId`
- `sessionKind: "warmup"`
- `topic`
- `level`
- `roundNumber`
- `score`: correct, total, and percentage
- `weakSpots`: stems for questions answered wrong
- `canRepeat: true`
- `instruction`: exact orchestrator guidance for presenting the summary and asking what to do next

The `roundNumber` is derived from ended warm-up sessions for the same topic and level.

## Runtime Flow

```text
start_warm_up { topic, level }
  -> ask_question x N
  -> evaluate_answer x N
      -> writes warmup_history
  -> end_interview
      -> returns score, weakSpots, roundNumber, canRepeat
  -> orchestrator asks: another round or start interview?
  -> another round: start_warm_up { topic, level }
  -> ready: start_interview { topic }
```

## Behavior

The warm-up path now supports repeatable practice rounds. Because Cycle 5 made selection history-aware, another round should prioritize questions the candidate missed earlier.

## Verification

- Ran a clean build successfully.

## Handoff

Cycle 6 completed the warm-up loop. All six knowledge DB migration cycles are now documented as complete.
