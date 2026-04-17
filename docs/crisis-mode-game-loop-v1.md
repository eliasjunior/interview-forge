# Crisis Mode v1 -> story-driven product run

This document reframes **Crisis Mode** from a question-and-answer pressure drill into a small product-building game.

The goal is not to replace the learning loop. The goal is to make the current arena feel more like:

- a run
- a story
- a product under pressure
- a game where choices change the health of the system

## Core idea

Each run is the life of one product.

Example opening:

> You are building an Order Service REST API.
> The product starts small.
> Traffic grows.
> Features are added.
> Complexity compounds.
> Your design choices start to matter.

The player does not just answer abstract system-design questions. The player makes product and architecture moves across micro rounds.

Those moves affect the health of the app.

## Run status = app health

The current `Run status` panel should become the core game mechanic.

It should represent the living condition of the product, not just a score dashboard.

Suggested fields:

- `Latency`
- `Reliability`
- `Cost control`
- `Failure`

Optional later:

- `Delivery speed`
- `Team confidence`
- `Data correctness`

## What each field means

### Latency

How responsive the system feels to users.

Examples that hurt it:

- unbounded reads
- expensive joins too early
- synchronous cross-service calls in hot paths
- no pagination

Examples that help it:

- bounded reads
- pagination
- caching with clear rules
- async work off the critical path

### Reliability

How often the product behaves correctly under normal and stressed conditions.

Examples that hurt it:

- no retries or timeouts
- weak validation
- no idempotency on write endpoints
- coupling reads to unstable dependencies

Examples that help it:

- retries with limits
- validation
- idempotency
- resilience boundaries

### Cost control

How expensive the current design becomes as usage grows.

Examples that hurt it:

- over-fetching
- scanning too much data
- scaling the wrong layer
- aggressive infra-first fixes

Examples that help it:

- right-sized queries
- pagination
- caching where valid
- avoiding waste before scaling

### Failure

This should be the new danger meter.

It represents accumulated operational risk and active product damage.

Failure rises when the player keeps making decisions that do not solve the real problem, or when they fix one concern by creating a bigger one.

Examples:

- stale data during critical reads
- duplicate order creation
- timeout cascades
- broken browse experience
- high error rate after growth

If `Failure` reaches a threshold, the run ends.

## Why failure matters

Right now the arena feels score-first.

A better game loop is survival-first:

1. Keep the product alive.
2. Make useful design moves.
3. Avoid invisible architectural debt becoming a visible failure.
4. Earn score for good decisions, but lose the run if the system collapses.

That makes the stakes clearer.

## Story structure

The run should feel like a short campaign.

## Campaign fantasy

The player starts with a simple product:

- "I want an Order Service REST API."

Then the game advances through small business and technical events:

1. build the first endpoint
2. add reads
3. traffic grows
4. filters and search appear
5. writes become more sensitive
6. upstream systems fail
7. stale data becomes dangerous
8. operational complexity starts to show

The player is not solving random disconnected crises.

The player is shaping one system over time.

## Micro-round design

Each round should be short.

Suggested round structure:

1. `Story beat`
   "The product team needs customers to view orders."
2. `Situation`
   "Traffic is low. The app is internal. You need a first read endpoint."
3. `Choice`
   Example: `GET /orders` vs `POST /orders/search`
4. `Impact`
   Show a small or large stat change.
5. `Why it mattered`
   Explain in one or two lines.
6. `Next beat`
   The product evolves and the same design choice gains new consequences.

Target duration:

- 20 to 45 seconds for a decision round
- 1 to 3 minutes for a full run slice

## Important mechanic: some choices matter later, not now

This is one of the strongest ideas in your prompt and should become a core rule.

Example:

- early in the product, choosing `GET` or `POST` for a simple internal read may have almost no penalty
- later, once caching, semantics, idempotency, client expectations, observability, and platform integrations matter, that same contract choice has real impact

That means decisions should have two kinds of consequences:

- `Immediate impact`
- `Deferred impact`

## Immediate vs deferred impact

### Immediate impact

The player sees a stat change now.

Example:

- adding pagination improves latency immediately

### Deferred impact

The player sees little change now, but the system stores a hidden flag that affects later rounds.

Example:

- using a weak read contract early seems harmless
- later it hurts caching, semantics, and client behavior

This is how the game can teach product thinking instead of pure quiz logic.

## Example run: Order Service REST API

### Round 1: first product request

Story:

> The company wants a basic Order Service.
> Internal staff need to create and inspect orders.
> Load is tiny.

Choice:

- `POST /orders`
- `GET /orders/:id`
- `POST /orders/query`

Expected impact:

- `POST /orders` is necessary and good for creation
- `GET /orders/:id` is correct for direct retrieval
- `POST /orders/query` for simple reads may have almost no immediate damage at this stage, but can set up future trade-off penalties

Teaching point:

At small scale, some imperfect choices survive. The point is not "wrong immediately". The point is "future cost".

### Round 2: browse arrives

Story:

> The product team now wants a browse page for recent orders.

Choice:

- return the full list
- add bounded pagination
- query through a generic search endpoint

Expected impact:

- full list hurts `Latency`, `Cost control`, and raises `Failure`
- bounded pagination improves `Latency` and `Cost control`
- generic search may be mixed: flexible now, but may create complexity later

### Round 3: filtering and sorting

Story:

> Support wants filtering by status, customer, and date.

Choice:

- filter in memory
- push filters to the database
- add one-off endpoints per filter type

Expected impact:

- in-memory filtering damages `Latency` and `Cost control`
- pushing filters down is strong
- one-off endpoints may help short term but create design sprawl later

### Round 4: write pressure

Story:

> Duplicate order creation appears during retries from clients.

Choice:

- ignore duplicates for now
- add idempotency support
- rely on client discipline

Expected impact:

- ignoring duplicates sharply raises `Failure`
- idempotency improves `Reliability`
- client discipline alone is weak

### Round 5: read scale

Story:

> Read traffic spikes after a partner integration.

Choice:

- scale app nodes only
- add cache with freshness rules
- send every read to the database

Expected impact:

- scaling app only is mixed
- explicit cache policy is strong
- database-only reads may preserve correctness but damage cost and latency under load

## Proposed stat behavior

Keep the stat model simple in v1.

Suggested range:

- each stat: `0..100`
- run starts at:
  - `Latency: 70`
  - `Reliability: 70`
  - `Cost control: 70`
  - `Failure: 0`

Rules:

- good choices improve one or two fields a little
- mixed choices often protect one field while hurting another
- weak choices increase `Failure`
- severe mistakes can spike `Failure`
- if `Failure >= 100`, the run ends
- if `Latency` or `Reliability` fall too low, failure can tick up passively in later rounds

## Suggested UI interpretation

`Run status` should feel like an RPG or strategy panel.

Interpretation:

- `Latency` = speed bar
- `Reliability` = stability bar
- `Cost control` = resource bar
- `Failure` = danger / corruption / collapse bar

Possible labels:

- healthy
- strained
- unstable
- critical

The panel should answer:

- Is my app surviving?
- What kind of damage am I accumulating?
- Which trade-off am I currently paying for?

## Current Crisis Mode -> smallest useful upgrade

Do not rewrite the whole mode yet.

Use the current arena as the shell and make one meaningful change at a time.

## Step 1

Keep the existing page and timer.

Change the framing:

- from isolated crisis cards
- to one continuous product story

Minimal implementation:

- add a run intro
- label each round as a chapter in the same Order Service journey
- change `Run status` copy to make it explicit that these are product health stats
- add `Failure`

## Step 2

Replace the current "best move only" feel with impact-based feedback.

Minimal implementation:

- each action shows stat deltas after selection
- not only `strong/mixed/weak`
- feedback copy explains trade-offs

## Step 3

Add deferred consequences.

Minimal implementation:

- store lightweight run flags such as:
  - `usedGenericReadContract`
  - `skippedPagination`
  - `ignoredIdempotency`
  - `addedCacheWithoutPolicy`
- later rounds inspect those flags and modify choices or penalties

## Step 4

Only after the run structure feels good, decide whether to keep the free-text defense phase exactly as-is or convert it into a post-round reflection phase.

That part is valuable, but it should support the game loop instead of interrupting it too early.

## v1 implementation target

The smallest solid version is:

1. one story: `Order Service REST API`
2. four stats: `Latency`, `Reliability`, `Cost control`, `Failure`
3. 4 to 6 short rounds
4. each round updates stats
5. at least 2 choices create deferred consequences
6. lose condition based on failure
7. keep existing score as secondary, not primary

## Open design questions

These are worth deciding before heavier UI work:

1. Should score remain visible during the run, or only after the run?
2. Should `Failure` be the only lose condition, or should total collapse also happen if `Latency` or `Reliability` hit zero?
3. Should the free-text answer phase happen every round, or only after major rounds?
4. Should the run always use one authored campaign first, or should topic files generate story beats dynamically later?

## Recommendation

Start with one authored campaign and make it feel good before generalizing:

- one product
- one story arc
- one clear lose condition
- obvious stat changes
- a few deferred consequences

That is enough to turn the current Crisis Mode from a themed quiz into a real game loop.
