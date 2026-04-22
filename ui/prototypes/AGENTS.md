# AGENTS.md

## Project Overview

This project is an educational systems-design game focused on software engineering and backend/API architecture decisions.

The game teaches players through **decisions, follow-up decisions, events, and consequences over time**. The goal is not to quiz the player on definitions, but to simulate how architecture choices behave under realistic product and business pressure.

The current implementation target is a **web application using TypeScript**, not a traditional game engine.

## Why This Project Exists

The core learning problem is that software and systems design are often taught in a dry, abstract way. This project aims to make those concepts more engaging by turning them into a game loop where the player:

- makes engineering decisions
- faces realistic trade-offs
- sees delayed consequences
- learns from pressure scenarios such as retries, outages, scaling, cost pressure, and observability failures

This is especially inspired by system design interviews, real production problems, and architectural trade-offs in backend development.

## Core Product Goal

Build a game that is:

- educational
- fun and replayable
- grounded in real software engineering trade-offs
- focused on cause and effect over time
- able to start small and evolve incrementally

The player should feel like they are shaping a living system, not answering exam questions.

## Current Design Direction

The game is being built first as a **simulation engine plus lightweight UI**, not as a graphics-heavy game.

### Current stack direction

- TypeScript
- Web application approach
- React or other lightweight UI layer as needed
- No Unity, Unreal, or heavy engine at this stage

### Why not a traditional game engine now

The current game is mostly:

- decision cards
- state transitions
- event resolution
- hidden traits
- visible consequences

This makes a web stack a good fit for fast iteration.

However, UI polish in the browser can become difficult over time, especially for more game-like effects and event presentation. CSS complexity is a known concern as the project grows. That is acceptable for now because the focus is still on validating the game mechanics and engine.

## Long-Term Technical Intent

Even though the game is currently a TypeScript web app, the codebase should be designed so the core simulation can later be ported or rewritten into another language such as C++ in the distant future if the project becomes more serious.

That means the core logic should be treated like a portable engine:

- deterministic where possible
- cleanly separated from rendering/UI
- easy to test
- small focused modules
- minimal framework coupling in the game logic

## Game Design Goals

### What the game should feel like

- decisions should feel uncertain
- outcomes should feel explainable
- choices should have trade-offs
- good short-term choices may hurt later
- good long-term choices may cost more or add complexity
- players should learn by seeing consequences, not by being told the answer

### What the game should avoid

- obvious quiz-like answers
- options that reveal the correct choice too clearly
- heavy jargon without pressure or context
- low-level implementation details that are not fun
- huge upfront complexity

## Core Gameplay Loop

The current intended loop is:

1. show current situation
2. present a decision
3. player chooses an option
4. apply hidden effects to system state
5. present follow-up decisions when relevant
6. trigger an event that tests previous decisions
7. explain what contributed to the result
8. apply visible consequences
9. continue to next step

### Intended progression pattern

Decision -> Follow-up -> Event -> Consequence

This is important. Major decisions should introduce new problems.

Examples:

- async processing -> how do failures get handled?
- caching -> how do you manage invalidation/stale data?
- microservices -> how do services communicate and fail safely?
- idempotency -> how are repeated requests tracked?

## Current Domain Focus

The first playable prototype is centered around **order creation** for an e-commerce system.

Example domain:

- `POST /orders`
- idempotency for retries
- validation strategy
- error handling
- sync vs async side effects
- tracing and observability
- caching and stale data

This domain is useful because it naturally creates realistic events:

- duplicate order submission
- Black Friday traffic spike
- payment provider failures
- stale cache behavior
- intermittent incidents with no new deployment

## Current Mechanics

### Hidden traits

These are internal architecture qualities that evolve over time.

- scalability
- reliability
- resilience
- operability
- cost efficiency
- complexity

### Visible state

These are shown to the player and represent game-level consequences.

- system health
- business health
- momentum
- budget or team capacity later if needed
- incident debt later if needed

### Tags / architecture facts

The game may also track specific decisions as tags, such as:

- idempotent
- async-processing
- cache
- observability
- structured-errors
- weak-validation

These help events react to exact design choices, not only broad trait values.

## Follow-Up Decisions

Follow-up decisions are a critical part of the design.

They should not ask low-level implementation questions unless the implementation choice is central to the gameplay.

Instead, follow-ups should ask:

- how the system behaves under failure
- how the team responds under uncertainty
- how trade-offs are handled after the initial design choice

Example:

Initial choice:
- split critical and non-critical work asynchronously

Good follow-up:
- what should happen when a background step fails?

Bad follow-up:
- which queue library do you use?

## UX / Presentation Principles

### Decision wording

Do not reveal the correct answer in the option text.

Avoid labels like:

- best practice
- standard approach
- anti-pattern
- correct way

Instead, use neutral, realistic descriptions that sound plausible.

The learning should come from consequences and contributor feedback.

### Contributor feedback

After an event, show which parts of the system helped or hurt.

For example:

- idempotency prevented duplicate orders
- async processing reduced load on the request path
- complexity increased coordination overhead
- missing tracing slowed diagnosis

This helps the player learn and helps developers balance the engine.

## Architecture Requirements

### High-level architecture

Split the code into clear layers:

- core game engine / domain logic
- content definitions (cards, events, follow-ups)
- presentation layer
- UI styling layer

### Strict separation

The game logic should not depend on UI concerns.

The core engine should be usable from:

- CLI prototype
- browser UI
- future alternative renderer

### Recommended structure

A possible structure:

- `engine/`
- `domain/`
- `content/`
- `ui/`
- `styles/`
- `tests/`

## Development Priorities

### Priority 1

Validate the core game loop in the smallest useful prototype.

This means:

- a few decisions
- a few follow-up decisions
- a few events
- a state engine
- visible outcomes

### Priority 2

Tune balance and make sure the game feels fair and learnable.

### Priority 3

Improve presentation and polish.

### Priority 4

Add stronger progression, more content, and better UX.

## Code Quality Standards

The codebase should be written as if it may need to grow into a more serious project later.

### Required standards

- code should be clean and readable
- follow clean code principles
- classes and modules should have a single responsibility
- methods and functions should be small and focused
- prefer pure functions whenever possible
- minimize side effects
- keep business logic deterministic where practical
- avoid unnecessary framework coupling in core logic
- favor composition over tangled inheritance

### Testing

- target test coverage of at least 80%
- prioritize tests around core engine logic
- cover decision application, event resolution, follow-up branching, and outcome calculation
- keep tests fast and isolated

### CSS and styling

If CSS is used in the web UI:

- use BEM naming
- keep styles separated by component
- avoid globally tangled CSS
- keep presentation concerns isolated from logic

## Important Engineering Principle

The project should be implemented so the simulation engine remains understandable and portable.

Even if the UI changes completely in the future, the engine should remain reusable.

A future rewrite to a lower-level or more performance-oriented language such as C++ should be conceptually possible because the logic is clean, modular, and not deeply tied to the UI framework.

## What Agents Should Optimize For

When contributing to this project, optimize for:

- clarity over cleverness
- small safe iterations
- mechanics first, polish second
- realistic engineering trade-offs
- educational value through consequences
- code that is easy to refactor
- maintainable boundaries between logic and UI

## What Agents Should Avoid

- overengineering too early
- introducing heavy dependencies without clear need
- mixing UI logic with core game state logic
- turning the game into a multiple-choice quiz
- hiding essential game rules so deeply that balancing becomes impossible
- bloating the first prototype with too many systems

## Current Next Steps

1. build or refine the CLI/web prototype around the order API theme
2. model the flow as decision -> follow-up -> event -> consequence
3. keep decisions realistic and neutral in wording
4. add contributor-based explanations after events
5. tune the balance of hidden traits and visible outcomes
6. only after the core loop feels good, invest more in UI polish

## Summary

This project is a systems-design educational game built first as a clean TypeScript simulation with a lightweight web UI.

The short-term goal is to find a fun and teachable core loop.
The long-term goal is to keep the architecture clean enough that the project can grow, be polished, and potentially be reimplemented in a more serious engine or language later if needed.
