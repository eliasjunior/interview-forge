import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Flashcard } from "@mock-interview/shared";
import {
  VARIATION_ANGLES,
  pickVariationAngle,
  registerGenerateFlashcardVariationTool,
} from "../tools/generateFlashcardVariation.js";
import { registerReviewFlashcardTool } from "../tools/reviewFlashcard.js";
import type { ToolDeps } from "../tools/deps.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "fc-test-001",
    front: "What is the in-place marker technique?",
    back: "Use first row/col as markers to zero the matrix.",
    topic: "Zero Matrix",
    tags: ["zero", "matrix"],
    difficulty: "medium",
    createdAt: now,
    dueDate: now,
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    ...overrides,
  };
}

function makeMockDeps(initial: Flashcard[] = []) {
  const store: Flashcard[] = [...initial];
  return {
    deps: {
      loadFlashcards: () => [...store],
      saveFlashcard: (card: Flashcard) => {
        const idx = store.findIndex((c) => c.id === card.id);
        if (idx === -1) store.push(card); else store[idx] = card;
      },
      saveFlashcards: (cards: Flashcard[]) => {
        store.length = 0;
        store.push(...cards);
      },
      stateError: (msg: string) => ({ content: [{ type: "text" as const, text: msg }] }),
    } as unknown as ToolDeps,
    store,
  };
}

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

function captureVariationHandler(deps: ToolDeps): Handler {
  let handler!: Handler;
  const mockServer = {
    registerTool(_n: string, _config: object, h: Handler) { handler = h; },
  };
  registerGenerateFlashcardVariationTool(mockServer as any, deps);
  return handler;
}

function captureReviewHandler(deps: ToolDeps): Handler {
  let handler!: Handler;
  const mockServer = {
    registerTool(_n: string, _config: object, h: Handler) { handler = h; },
  };
  registerReviewFlashcardTool(mockServer as any, deps);
  return handler;
}

// ─── pickVariationAngle ───────────────────────────────────────────────────────

describe("pickVariationAngle", () => {
  test("cycles through all angles based on repetitions", () => {
    const seen = new Set<string>();
    for (let i = 0; i < VARIATION_ANGLES.length; i++) {
      seen.add(pickVariationAngle(i).name);
    }
    assert.equal(seen.size, VARIATION_ANGLES.length, "each angle should appear exactly once per cycle");
  });

  test("wraps around after exhausting all angles", () => {
    const first = pickVariationAngle(0);
    const wrapped = pickVariationAngle(VARIATION_ANGLES.length);
    assert.equal(first.name, wrapped.name);
  });

  test("returns a different angle for consecutive repetition counts", () => {
    const a = pickVariationAngle(0);
    const b = pickVariationAngle(1);
    assert.notEqual(a.name, b.name);
  });

  test("every angle has a non-empty name and prompt", () => {
    for (const angle of VARIATION_ANGLES) {
      assert.ok(angle.name.length > 0, `angle name should not be empty`);
      assert.ok(angle.prompt.length > 0, `angle prompt should not be empty`);
    }
  });
});

// ─── generate_flashcard_variation tool ───────────────────────────────────────

describe("generate_flashcard_variation — not found", () => {
  test("returns stateError when cardId does not exist", async () => {
    const { deps } = makeMockDeps([]);
    const handler = captureVariationHandler(deps);
    const result = await handler({ cardId: "fc-missing" });
    assert.ok(result.content[0].text.includes("fc-missing"));
  });
});

describe("generate_flashcard_variation — response shape", () => {
  test("returns cardId, topic, originalQuestion, modelAnswer, variationAngle, instruction", async () => {
    const card = makeFlashcard({ repetitions: 0 });
    const { deps } = makeMockDeps([card]);
    const handler = captureVariationHandler(deps);
    const result = await handler({ cardId: card.id });
    const payload = JSON.parse(result.content[0].text);

    assert.equal(payload.cardId, card.id);
    assert.equal(payload.topic, card.topic);
    assert.equal(payload.originalQuestion, card.front);
    assert.equal(payload.modelAnswer, card.back);
    assert.ok(typeof payload.variationAngle === "string");
    assert.ok(typeof payload.instruction === "string");
  });

  test("instruction contains the variation angle name", async () => {
    const card = makeFlashcard({ repetitions: 0 });
    const { deps } = makeMockDeps([card]);
    const handler = captureVariationHandler(deps);
    const result = await handler({ cardId: card.id });
    const payload = JSON.parse(result.content[0].text);

    assert.ok(
      payload.instruction.includes(payload.variationAngle),
      "instruction should reference the chosen angle name"
    );
  });

  test("instruction forbids revealing the original question to the candidate", async () => {
    const card = makeFlashcard({ repetitions: 0 });
    const { deps } = makeMockDeps([card]);
    const handler = captureVariationHandler(deps);
    const result = await handler({ cardId: card.id });
    const payload = JSON.parse(result.content[0].text);

    assert.ok(
      payload.instruction.toLowerCase().includes("do not reveal") ||
      payload.instruction.toLowerCase().includes("not reveal"),
      "instruction must tell the LLM not to reveal the original question"
    );
  });
});

describe("generate_flashcard_variation — angle rotation", () => {
  test("uses a different angle for repetitions=0 vs repetitions=1", async () => {
    const { deps: deps0 } = makeMockDeps([makeFlashcard({ id: "a", repetitions: 0 })]);
    const { deps: deps1 } = makeMockDeps([makeFlashcard({ id: "b", repetitions: 1 })]);

    const r0 = JSON.parse((await captureVariationHandler(deps0)({ cardId: "a" })).content[0].text);
    const r1 = JSON.parse((await captureVariationHandler(deps1)({ cardId: "b" })).content[0].text);

    assert.notEqual(r0.variationAngle, r1.variationAngle);
  });

  test("uses the same angle when repetitions wraps around the full cycle", async () => {
    const n = VARIATION_ANGLES.length;
    const { deps: deps0 } = makeMockDeps([makeFlashcard({ id: "a", repetitions: 0 })]);
    const { deps: depsN } = makeMockDeps([makeFlashcard({ id: "b", repetitions: n })]);

    const r0 = JSON.parse((await captureVariationHandler(deps0)({ cardId: "a" })).content[0].text);
    const rN = JSON.parse((await captureVariationHandler(depsN)({ cardId: "b" })).content[0].text);

    assert.equal(r0.variationAngle, rN.variationAngle);
  });
});

// ─── review_flashcard — nextStep behaviour ────────────────────────────────────

describe("review_flashcard — nextStep", () => {
  test("no nextStep on first successful review (repetitions was 0)", async () => {
    const card = makeFlashcard({ repetitions: 0 });
    const { deps } = makeMockDeps([card]);
    const handler = captureReviewHandler(deps);
    const result = await handler({ cardId: card.id, rating: 3 });
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.nextStep, undefined);
  });

  test("nextStep present when card has been seen before and recall succeeds (rating 3)", async () => {
    const card = makeFlashcard({ repetitions: 2 });
    const { deps } = makeMockDeps([card]);
    const handler = captureReviewHandler(deps);
    const result = await handler({ cardId: card.id, rating: 3 });
    const payload = JSON.parse(result.content[0].text);
    assert.ok(payload.nextStep, "nextStep should be present");
    assert.equal(payload.nextStep.tool, "generate_flashcard_variation");
    assert.equal(payload.nextStep.cardId, card.id);
  });

  test("nextStep present when card has been seen before and recall succeeds (rating 4)", async () => {
    const card = makeFlashcard({ repetitions: 1 });
    const { deps } = makeMockDeps([card]);
    const handler = captureReviewHandler(deps);
    const result = await handler({ cardId: card.id, rating: 4 });
    const payload = JSON.parse(result.content[0].text);
    assert.ok(payload.nextStep);
    assert.equal(payload.nextStep.tool, "generate_flashcard_variation");
  });

  test("no nextStep when recall fails (rating 1 — Again), even if card was seen before", async () => {
    const card = makeFlashcard({ repetitions: 3 });
    const { deps } = makeMockDeps([card]);
    const handler = captureReviewHandler(deps);
    const result = await handler({ cardId: card.id, rating: 1 });
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.nextStep, undefined);
  });

  test("no nextStep when recall was hard (rating 2 — Hard), even if card was seen before", async () => {
    const card = makeFlashcard({ repetitions: 3 });
    const { deps } = makeMockDeps([card]);
    const handler = captureReviewHandler(deps);
    const result = await handler({ cardId: card.id, rating: 2 });
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.nextStep, undefined);
  });

  test("returns stateError for unknown cardId", async () => {
    const { deps } = makeMockDeps([]);
    const handler = captureReviewHandler(deps);
    const result = await handler({ cardId: "fc-ghost", rating: 3 });
    assert.ok(result.content[0].text.includes("fc-ghost"));
  });
});
