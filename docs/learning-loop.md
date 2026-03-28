# Learning Loop

[← Back to README](../README.md)

## Rewards loop

The learning experience is designed to feel more engaging and motivating, using lightweight ideas from games and neuroscience to reinforce progress. Clear feedback, small wins, and visible momentum make practice more satisfying, helping you stay consistent and enjoy the process of learning.

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
