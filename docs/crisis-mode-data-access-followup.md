# Crisis Mode -> scoped follow-up (data access trade-offs)

This sketch turns one fast **Crisis Mode** decision into a real follow-up artifact that can later feed:

- a scoped interview session
- a report entry
- flashcard generation
- knowledge graph updates

## Why this topic works well

`data-access-tradeoffs-growing-complexity.md` already has a natural progression from a simple browse endpoint to production pressure:

1. full-list responses become too expensive
2. deep offset pagination becomes slow
3. concurrent writes make browsing unstable
4. filtering and sorting must move closer to the data source
5. caching introduces freshness and correctness trade-offs
6. upstream failures require resilience boundaries

That makes it a good candidate for a playable mini-campaign where the learner chooses a move under pressure and then has to defend it.

## Round flow

1. Show one scenario in Crisis Mode.
2. Learner picks one action under time pressure.
3. Save a `CrisisRoundArtifact`.
4. Convert that artifact into a scoped follow-up prompt.
5. Launch a real interview session or drill from that prompt.

## Minimal artifact shape

```ts
type CrisisRoundArtifact = {
  artifactType: 'crisis_round'
  topicFile: string
  scenarioId: string
  scenarioStage: 'foundation' | 'intermediate' | 'advanced'
  sourceQuestionHint?: number
  scenarioPrompt: string
  selectedAction: string
  selectedActionLabel: string
  alternatives: string[]
  evaluation: {
    roundOutcome: 'strong' | 'mixed' | 'weak'
    reason: string
  }
  signals: {
    timeRemainingSec: number
    confidence?: 'low' | 'medium' | 'high'
  }
  conceptsExercised: string[]
}
```

## Suggested API sketch

```http
POST /api/crisis-rounds
POST /api/crisis-rounds/:roundId/followup-session
```

### Save round

```json
{
  "topicFile": "data-access-tradeoffs-growing-complexity",
  "scenarioId": "browse-api-meltdown",
  "selectedAction": "add-server-side-pagination",
  "timeRemainingSec": 14
}
```

### Create follow-up session response

```json
{
  "sessionId": "sess_123",
  "launchPrompt": "I want a scoped system design follow-up about bounded browsing and pagination trade-offs for a growing REST endpoint."
}
```

## Initial campaign slice

Start with only three scenarios:

### 1. Browse API meltdown

- Problem: the endpoint returns the whole dataset and the browse screen becomes unusable.
- Best move: add server-side pagination.
- Follow-up: defend bounded browsing, response shape, limits, deterministic ordering, and when offset breaks down.

### 2. Deep page slowdown

- Problem: page 10,000 gets slower even though the page size is small.
- Best move: switch from offset pagination to cursor/seek pagination.
- Follow-up: explain query cost and continuation semantics.

### 3. Freshness vs load

- Problem: read traffic is high, users care about recent values, and the database is under pressure.
- Best move: add a cache policy with explicit freshness rules instead of naive long-lived caching.
- Follow-up: defend TTL, invalidation, bypass rules, and stale-read risk.

## Outcome model

The game should not only mark a decision as right or wrong.

- `strong`: good first move for the current failure mode
- `mixed`: may help, but does not address the main bottleneck or introduces a major trade-off too early
- `weak`: misses the core issue or creates correctness risk

That gives you better follow-up prompts because weak decisions are still useful learning inputs.

## Prompt generation rule of thumb

Turn the chosen action into a defense prompt.

Example:

- learner picks `add-server-side-pagination`
- follow-up becomes:

```text
You chose to add server-side pagination to a browse endpoint that was returning the full dataset.

Defend that decision like a system design interview candidate.

Explain:
1. why the old contract fails at scale
2. what response shape you would return
3. what limits you would enforce from day one
4. how you would guarantee deterministic ordering
5. when offset pagination becomes too expensive
6. when you would migrate to cursor pagination
```

## Recommended rollout

1. Keep the first implementation front-end only.
2. Save the selected action and timer result locally in the current session object.
3. Add a single CTA: **Start follow-up interview**.
4. Only after that works, move the round into persisted backend artifacts.

This lets Crisis Mode become a pressure-based front door into the existing interview loop instead of remaining a disconnected mini-game.
