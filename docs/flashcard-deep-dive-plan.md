# Flashcard Deep-Dive Implementation Plan

## Goal

Add a reusable flashcard deep-dive capability that works through two entry points:

- Browser flow: `FlashcardsPage` -> `POST /api/flashcards/:id/deep-dive` -> shared service -> AI provider -> structured result -> study panel/modal
- MCP flow: `get_flashcard_deep_dive` -> same shared service -> same structured result

The final goal is not just "show more flashcard details". The goal is to introduce a single backend deep-dive use case with:

- one shared contract across `shared`, `interview-mcp`, and `ui`
- one service implementation reused by HTTP and MCP
- one structured JSON response shape suitable for UI rendering and agent/tool use
- no coupling between the existing review/rating flow and the new study/deep-dive flow

## Design Constraints

- Keep the review/rating experience unchanged
- Browser uses HTTP, not MCP directly
- Claude/Codex gets a first-class MCP tool
- Return structured JSON, not markdown blobs
- Reuse existing port/adapter patterns in the AI layer
- Avoid duplicating flashcard/session loading logic in multiple entry points

## Current Repo Reality

These details matter for implementation isolation:

- [`shared/src/types.ts`](/Users/eliasjunior/Projects/first-mcp/shared/src/types.ts) is already the shared contract source
- [`interview-mcp/src/http.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/http.ts) currently loads flashcards inline
- [`interview-mcp/src/tools/deps.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/tools/deps.ts) already exposes session/flashcard loading helpers
- [`interview-mcp/src/ai/port.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/ai/port.ts) already defines the AI provider abstraction
- [`ui/src/pages/FlashcardsPage.tsx`](/Users/eliasjunior/Projects/first-mcp/ui/src/pages/FlashcardsPage.tsx) currently combines list and review concerns, but has no deep-dive study mode yet

## Target Architecture

```text
FlashcardsPage click
  -> POST /api/flashcards/:id/deep-dive
  -> flashcardDeepDive service
  -> AIProvider.generateFlashcardDeepDive(...)
  -> FlashcardDeepDiveResult
  -> side panel/modal

get_flashcard_deep_dive MCP tool
  -> flashcardDeepDive service
  -> AIProvider.generateFlashcardDeepDive(...)
  -> FlashcardDeepDiveResult
```

## Shared Response Contract

The new shared types should support both rendering and tool usage.

### `Flashcard`

Extend with optional enrichment fields:

- `title?: string`
- `focusItem?: string`
- `concepts?: string[]`
- `studyNotes?: string`

### `FlashcardDeepDiveContext`

Purpose:

- normalized backend input to the AI layer
- decouples prompt assembly from raw file/session shapes

Suggested contents:

- `cardId: string`
- `topic: string`
- `item: string`
- `title?: string`
- `front: string`
- `back: string`
- `concepts: string[]`
- `studyNotes?: string`
- `question?: string`
- `sessionId?: string`
- `questionIndex?: number`
- `originalQuestion?: string`
- `originalAnswer?: string`
- `originalFeedback?: string`
- `originalScore?: number`

### `FlashcardDeepDiveSection`

Purpose:

- stable UI-renderable section model
- avoids UI hardcoding against raw provider text

Suggested shape:

- `id: string`
- `title: string`
- `content: string`

### `FlashcardDeepDiveResult`

Suggested required shape:

- `cardId: string`
- `topic: string`
- `item: string`
- `title: string`
- `summary: string`
- `sections: FlashcardDeepDiveSection[]`
- `relatedConcepts: string[]`
- `suggestedFollowups: string[]`
- `aiGenerated: boolean`

## Isolated Workstreams

Each workstream below is intended to be owned and implemented with minimal overlap.

### Workstream 1: Shared Contract

Files:

- [`shared/src/types.ts`](/Users/eliasjunior/Projects/first-mcp/shared/src/types.ts)

Responsibilities:

- extend `Flashcard`
- define `FlashcardDeepDiveContext`
- define `FlashcardDeepDiveSection`
- define `FlashcardDeepDiveResult`

Dependencies:

- none

Outputs:

- final cross-package contract

Done when:

- backend, MCP, and UI can all import the same deep-dive types

### Workstream 2: Backend Deep-Dive Use Case

Files:

- [`interview-mcp/src/flashcardDeepDive.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/flashcardDeepDive.ts)
- [`interview-mcp/src/tools/deps.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/tools/deps.ts)

Responsibilities:

- load flashcards
- find card by id
- resolve source session and evaluation context
- build `FlashcardDeepDiveContext`
- call AI provider when enabled
- produce degraded fallback result when AI is unavailable

Dependencies:

- Workstream 1
- existing `loadFlashcards`, `loadSessions`, and shared error patterns

Outputs:

- one reusable business-flow module

Done when:

- both HTTP and MCP can delegate to the same service
- missing card errors are explicit
- missing session degrades predictably if that is the chosen behavior

### Workstream 3: AI Port and Anthropic Adapter

Files:

- [`interview-mcp/src/ai/port.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/ai/port.ts)
- [`interview-mcp/src/ai/anthropic.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/ai/anthropic.ts)
- [`interview-mcp/src/ai/index.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/ai/index.ts)

Responsibilities:

- add `generateFlashcardDeepDive(context)`
- assemble prompt inputs from normalized context
- enforce strict JSON output
- keep generation focused on the selected item
- provide adapter-level fallback behavior only where appropriate

Dependencies:

- Workstream 1

Outputs:

- provider support for deep-dive generation

Done when:

- the service can request a structured deep-dive result from the AI provider

### Workstream 4: MCP Entry Point

Files:

- [`interview-mcp/src/tools/getFlashcardDeepDive.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/tools/getFlashcardDeepDive.ts)
- [`interview-mcp/src/tools/registerAllTools.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/tools/registerAllTools.ts)

Responsibilities:

- expose `get_flashcard_deep_dive`
- validate `cardId`, optional `item`, optional `question`
- call the shared deep-dive service
- return structured JSON text

Dependencies:

- Workstream 2

Outputs:

- MCP tool for Claude/Codex

Done when:

- the tool is discoverable and calls the shared service instead of duplicating logic

### Workstream 5: HTTP Entry Point

Files:

- [`interview-mcp/src/http.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/http.ts)

Responsibilities:

- add `POST /api/flashcards/:id/deep-dive`
- validate request body
- map service errors to `400`, `404`, and `500`
- return `FlashcardDeepDiveResult`

Dependencies:

- Workstream 2

Outputs:

- browser-facing API route

Done when:

- the UI can request a deep-dive without touching MCP

### Workstream 6: Frontend API and Study UI

Files:

- [`ui/src/api.ts`](/Users/eliasjunior/Projects/first-mcp/ui/src/api.ts)
- [`ui/src/pages/FlashcardsPage.tsx`](/Users/eliasjunior/Projects/first-mcp/ui/src/pages/FlashcardsPage.tsx)
- optional: [`ui/src/components/FlashcardDeepDivePanel.tsx`](/Users/eliasjunior/Projects/first-mcp/ui/src/components/FlashcardDeepDivePanel.tsx)

Responsibilities:

- add `getFlashcardDeepDive(id, body)`
- introduce selected card/item state
- introduce loading/error/result state for the panel
- render clickable concept/subtopic affordances
- keep existing review flow isolated

Dependencies:

- Workstream 1
- Workstream 5

Outputs:

- study-mode UI for opening and reading a structured deep-dive

Done when:

- clicking a concept or subtopic opens a detail panel or modal
- review/rating still behaves as before

### Workstream 7: Flashcard Metadata Enrichment

Files:

- file to identify where flashcards are created during interview finalization

Responsibilities:

- populate richer flashcard metadata during creation
- backfill `title`, `focusItem`, `concepts`, and possibly `studyNotes`

Dependencies:

- Workstream 1

Outputs:

- higher quality deep-dive input context

Done when:

- newly generated flashcards carry useful metadata beyond `front` and `back`

### Workstream 8: Tests and Docs

Files:

- [`interview-mcp/src/__tests__/flashcardDeepDive.test.ts`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/src/__tests__/flashcardDeepDive.test.ts)
- [`README.md`](/Users/eliasjunior/Projects/first-mcp/README.md)
- [`interview-mcp/README.md`](/Users/eliasjunior/Projects/first-mcp/interview-mcp/README.md)
- [`ui/README.md`](/Users/eliasjunior/Projects/first-mcp/ui/README.md)

Responsibilities:

- verify card lookup and context assembly
- verify fallback behavior
- verify clear error handling
- document MCP tool, HTTP route, and UI behavior

Dependencies:

- Workstreams 2 through 6

Outputs:

- regression coverage and repo documentation

Done when:

- the feature contract is documented and the deep-dive service behavior is covered by tests

## Parallelization Map

Safe to do first:

- Workstream 1

Can start after Workstream 1:

- Workstream 2
- Workstream 3

Can start after Workstream 2:

- Workstream 4
- Workstream 5

Can start after Workstream 5:

- Workstream 6

Can run in parallel once the contract is stable:

- Workstream 7

Should land near the end:

- Workstream 8

## Recommended Delivery Order

1. Shared types
2. Shared deep-dive service
3. AI port and Anthropic implementation
4. MCP tool
5. HTTP route
6. Frontend API client
7. Flashcards UI
8. Flashcard creation metadata
9. Tests
10. README updates

## API and Tool Contract Summary

### MCP tool

Name:

- `get_flashcard_deep_dive`

Input:

- `cardId: string`
- `item?: string`
- `question?: string`

Output:

- serialized `FlashcardDeepDiveResult`

### HTTP route

Route:

- `POST /api/flashcards/:id/deep-dive`

Body:

- `item?: string`
- `question?: string`

Responses:

- `200` with `FlashcardDeepDiveResult`
- `400` invalid input
- `404` card not found
- `500` provider/runtime failure

## Open Decisions To Lock Before Coding

These are the only meaningful design choices still worth confirming:

- whether missing session data should be a degraded success or a hard failure
- exact fallback output shape when AI is unavailable
- exact section titles and whether they are fixed or model-driven
- whether `item` defaults to `focusItem`, first concept, or a title-derived label

## Acceptance Criteria

- A single service owns deep-dive generation
- MCP and HTTP reuse that service
- UI renders structured sections, related concepts, and follow-up prompts
- Existing review/rating flow is untouched
- Shared types are the only source of truth for the deep-dive contract
- Missing-card and invalid-input failures are explicit

## Final Goal Check

Yes, the final goal is clear:

You want to add a new flashcard study capability centered on a reusable deep-dive service, exposed through both MCP and HTTP, and consumed by the UI through a dedicated study panel, while keeping the existing flashcard review flow separate and stable.
