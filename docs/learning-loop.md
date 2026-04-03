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

Related docs:

- [Usage: Coding exercises](./usage.md#6-coding-exercises)
- [Tools and API reference](./tools.md)

## Flashcard system

After `end_interview`, the server automatically generates flashcards for any question scored below 4. Cards are stored in `data/app.db` and scheduled with the **SM-2 spaced repetition algorithm**.

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
