# ui — Context

## Key Files & Paths

```
ui/src/
├── pages/
│   ├── SessionsPage.tsx
│   ├── ReportPage.tsx
│   ├── GraphPage.tsx
│   ├── FlashcardsPage.tsx      # Flashcard overview + flip-card review UI
│   └── ForgeArenaPage.tsx      # Crisis Mode page (front-end only)
├── components/
│   ├── NavBar.tsx
│   └── FloatingPoints.tsx      # Floating +X pts overlay used by Crisis Mode
├── crisis/
│   └── topicArena.ts           # Crisis Mode single-topic scenario map
├── api.ts                      # Typed fetch helpers for all REST endpoints
└── index.css
```

The UI calls the HTTP API at `http://localhost:3001` by default. When the UI is opened from another device, the API URL must resolve to the host machine's LAN IP.

## Crisis Mode

### Current scope

`Crisis Mode` is currently a **front-end-only** feature and is intentionally **not generic yet**.

It is hard-wired to exactly one topic: `data-access-tradeoffs-growing-complexity`

The page loads the topic through the existing UI API: `getTopicDetails(CRISIS_TOPIC_FILE)` from `ui/src/api.ts`. It does **not** read markdown files directly in the browser.

### Files

- `ui/src/pages/ForgeArenaPage.tsx`
- `ui/src/crisis/topicArena.ts`
- `ui/src/components/FloatingPoints.tsx`
- `.floating-points` styles in `ui/src/index.css`

### Interview loop

`decision -> follow-up prompt -> answer -> concept feedback -> improve once -> twist -> done`

### Evaluation model

Evaluation is **deterministic** and **not AI-based**. For each scenario, `topicArena.ts` defines `expectedConcepts[]`, `twistPrompt`, and fixed decision options.

Each concept has a small keyword list — the page checks whether the submitted answer contains any of those keywords.

Helpers: `evaluateConceptCoverage(answer, concepts)`, `getGrade(coverage)`, `compareAttempts(first, second)`

Grade thresholds: `Strong` ≥ 80%, `Decent` ≥ 40%, `Weak` < 40%

### Points / scoring

**Decision selection points** — triggered when the user clicks one of the 3 crisis options (base score + remaining timer).

**Answer submission points** — triggered only for the normal first answer:
- `Weak → +5 pts`, `Decent → +15 pts`, `Strong → +30 pts`
- Not used for improvement, combos, or bonus systems

### Floating points animation

- Component: `ui/src/components/FloatingPoints.tsx`
- CSS: `.floating-points` and `@keyframes floating-points-pop` in `ui/src/index.css`
- Uses a changing React `key` at the call site to force animation replay on repeat triggers
- A previous bug came from clearing floating state inside `resetInterviewState()`

If the floating points animation is "not visible", verify in this order:
1. whether `.floating-points` is actually inserted into the DOM
2. whether React state is being cleared too early
3. whether the component is being remounted so the CSS animation restarts
4. whether the overlay position is anchored near the intended UI element

### Constraints for future work

Until explicitly changed:
- do **not** generalize Crisis Mode to all topics yet
- do **not** introduce AI evaluation
- do **not** add backend persistence for Crisis Mode state
- do **not** move this into MCP tools yet
- keep the feature deterministic and easy to debug

## FlashcardsPage (`/flashcards`)

**Overview mode:** Stats row (Total / Due Today / Topics / Reviewed), topic filter tabs, card list split into Due now and Upcoming.

**Review mode:** 3D CSS flip card, optional answer textarea on front, rating buttons (Again / Hard / Good / Easy) after flip, auto-advances after 400 ms, 🎉 completion screen when queue is empty.

## Session type badge

Each session card on `/sessions` shows a `🏗️ Design` badge (teal) derived from `session.interviewType`, defaults gracefully for legacy sessions.
