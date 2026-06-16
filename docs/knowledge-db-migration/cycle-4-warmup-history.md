# Cycle 4 - Warm-up History

## Goal

Persist each answered warm-up MCQ to `warmup_history` so later rounds can use real recall history instead of only authored question order.

## Scope

This cycle records history only. It does not change warm-up question selection yet.

## Implementation

- Updated `interview-mcp/src/tools/deps.ts` with `saveWarmupHistory(questionStem, topicTitle, sessionId, correct)`.
- Implemented `saveWarmupHistory` in `interview-mcp/src/server.ts`.
- Updated `interview-mcp/src/tools/evaluateAnswer.ts` to call `saveWarmupHistory` after warm-up auto-evaluation.
- Updated test dependency stubs with a no-op `saveWarmupHistory`.

## Write Path

`evaluate_answer` determines whether the candidate answer is correct for auto-scored warm-up questions. Once `isCorrect` is known, it records:

- the warm-up question stem
- the topic title from the session
- the session id
- whether the answer was correct
- the current timestamp

The server implementation looks up the topic by title, then finds the matching `warmup_questions` row by topic id and stem. If either lookup fails, the history write is skipped.

## Behavior

Every warm-up MCQ answer, correct or incorrect, now creates a `warmup_history` row automatically.

## Verification

- Ran a clean build successfully.
- Fixed test dependency stubs after adding the new required method to `ToolDeps`.

## Handoff

Cycle 4 completed runtime history capture. Cycle 5 can use the captured correct and incorrect counts to rank future warm-up MCQ selection.
