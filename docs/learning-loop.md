# Learning Loop

[← Back to README](../README.md)

## End-to-end loop

The implemented loop is:

1. Run a warm-up, full interview, or drill.
2. End the session with `end_interview`.
3. Review weak answers in the report and reward summary.
4. Optionally persist recurring patterns with `log_mistake`.
5. Optionally ask the orchestrator to create a hands-on follow-up exercise with `create_exercise`.
6. Optionally run `start_drill` for verbal recall on the same weak areas.
7. Review generated flashcards over time with `get_due_flashcards` and `review_flashcard`.

Important: `create_exercise` is available as an MCP tool, but it is not called automatically by the app. The candidate or orchestrator must ask for it explicitly after a completed interview.

### Asking for an exercise after the last interview

If you want an exercise based on your latest interview, tell the LLM explicitly to use the last session as the source and generate a follow-up implementation task from the weak spots.

Examples:

```text
Create a follow-up coding exercise from my last Threads interview.
Base it on the weak areas from that session.
Keep it medium difficulty and Java-focused.
```

```text
Look at my most recent Threads interview, identify the weakest area, and create a follow-up coding exercise for it using create_exercise.
Keep it production-oriented and doable in one sitting.
```

```text
From my last Threads interview, create an exercise targeting the concurrency and reliability gaps you found.
Use create_exercise.
Difficulty 3/5. Language: Java.
Show me the learning goal and problem statement first.
```

The useful ingredients are:

- the source session: "my last Threads interview"
- the target area: "weak spots", or a named gap such as concurrency, reliability, API design, or debugging
- scope constraints: language, difficulty, and realism

## Rewards loop

The learning experience is designed to feel more engaging and motivating, using lightweight ideas from games and neuroscience to reinforce progress. Clear feedback, small wins, and visible momentum make practice more satisfying, helping you stay consistent and enjoy the process of learning.

## Exercise follow-up

`create_exercise` fits after a completed interview or drill when you want hands-on practice instead of another verbal round.

There are now two distinct ways to get there:

1. After a completed session, ask the orchestrator to create a follow-up exercise from the weak spots in that session.
2. From the Topics UI, open a topic, choose a weak slice question, and use the authored exercise guidance attached to that question.

The second path is intentionally more structured. Some knowledge-file questions are marked as good exercise candidates, while others are explicitly discussion-only. The UI should only offer the exercise action for questions whose authored metadata says an exercise makes sense.

Typical flow:

```text
start_interview / start_warm_up / start_drill
  → ask_question / submit_answer / evaluate_answer
  → end_interview
  → inspect report + weak answers
  → create_exercise
  → candidate implements the exercise outside the interview loop
  → log_mistake for implementation gaps
  → start_scoped_interview using the exercise problem statement as follow-up drill content
```

Notes:

- `create_exercise` writes a markdown exercise file under `data/knowledge/exercises/<topic>/`
- it persists exercise metadata to SQLite
- it returns a complexity assessment and roadmap
- if the exercise is too hard, the orchestrator should show the roadmap and offer prerequisites first
- this step is optional and currently manual
- question-level exercise prompts are now guided by authored metadata in the knowledge files:
  - `Exercise fit`
  - `Exercise owner`
  - `Exercise goal`
  - `Exercise scope`
  - `Exercise constraints`
  - `Exercise acceptance`
  - `Exercise seed`
- if a question is marked `Exercise fit: none`, the exercise action should stay hidden and the question should remain a verbal/drill-only prompt
- this keeps compact exercises focused on the core layer or behavior instead of drifting into end-to-end framework wiring

Related docs:

- [Usage: Coding exercises](./usage.md#6-coding-exercises)
- [Tools and API reference](./tools.md)

## Flashcard system

Flashcards are now created through an explicit MCP flow so the orchestrator can inspect and persist study cards intentionally instead of relying on hidden server-side writes.

### End-of-interview flow

After `end_interview` or the terminal `next_question` step completes a session:

1. the session is finalized
2. the report is written
3. concepts are merged into the graph
4. the response includes `flashcards.nextStep = prepare_flashcards` when weak answers exist
5. the orchestrator calls `prepare_flashcards { sessionId }`
6. the tool returns ready-to-submit `create_flashcard` payloads
7. the orchestrator calls `create_flashcard` once per returned draft

Created cards are stored in `data/app.db` and scheduled with the **SM-2 spaced repetition algorithm**.

### Why the flow is split

`prepare_flashcards` gives the orchestrator enough structure to make consistent cards without inventing the study format from raw feedback.

Each draft can include:

- `prompt`
- `cardStyle` (`open` or `multiple_choice`)
- `anchors`
- `route`
- `learnerAnswer`
- `feedback`
- `strongerAnswer`
- `correctAnswer`
- `studyNotes`
- `topic`
- `difficulty`
- `tags`
- `sourceSessionId`
- `sourceQuestionIndex`
- `sourceOriginalScore`

This keeps flashcard creation visible and testable at the MCP level and preserves source linkage back to the original weak answer.

### Guided card formats

Two guided study formats are supported:

- `open`: prompt + anchors on the front, then learner answer, feedback, model answer, route, and study notes on the back
- `multiple_choice`: question + anchors on the front, then learner answer, feedback, correct answer, explanation, and route on the back

Some weak spots still produce code-first cards when the concept is better practiced through implementation than verbal recall.

### Example draft

```json
{
  "prompt": "Which statements about observability are correct?",
  "cardStyle": "multiple_choice",
  "anchors": ["signals", "correlate request", "isolate layer"],
  "route": [
    { "anchor": "signals", "detail": "Think logs, metrics, and traces before picking options." },
    { "anchor": "correlate request", "detail": "Request and trace IDs connect events across one flow." },
    { "anchor": "isolate layer", "detail": "Use app, DB, and dependency signals to find ownership." }
  ],
  "correctAnswer": "A, B, D",
  "strongerAnswer": "Observability helps follow one request and isolate the failing layer.",
  "topic": "Observability",
  "difficulty": "medium",
  "tags": ["observability"],
  "sourceSessionId": "session-1",
  "sourceQuestionIndex": 0,
  "sourceOriginalScore": 2
}
```

A scheduled task (`flashcard-daily-review`) fires every day at **9:00 AM** and prints a summary of due cards grouped by topic.

### Ratings and intervals

| Rating | Label | Effect |
|---|---|---|
| 1 | Again | Reset: interval=1 day, ease factor −0.2 |
| 2 | Hard | Advance with penalty: ease factor −0.14 |
| 3 | Good | Normal advance: 3 → 8 → interval × ease factor days |
| 4 | Easy | Full advance with ease factor bonus |

Intervals include ±1 day random jitter so cards from the same session drift apart and do not all surface on the same day.

### Variation flow

On repeated successful reviews, `review_flashcard` returns a `nextStep` hint:

```text
review_flashcard { cardId, rating: 3 }
  → nextStep: { tool: "generate_flashcard_variation", cardId }
generate_flashcard_variation { cardId }
  → returns variationAngle + originalQuestion + modelAnswer
  → orchestrator constructs a varied question from the angle and asks it
```

Six angles rotate deterministically: `failure-case`, `why-not-what`, `flip-scenario`, `trade-offs`, `teach-it`, `apply-to-context`. The variation is ephemeral — not stored in the DB.

## Modes

| Mode | How | Cost |
|---|---|---|
| `AI_ENABLED=false` (default) | Questions from knowledge files; orchestrator Claude evaluates using the rubric | Free |
| `AI_ENABLED=true` | Worker LLM generates questions, scores answers, extracts concepts, writes deeper dives | Anthropic API credits |
