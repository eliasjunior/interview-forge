import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Flashcard } from "@mock-interview/shared";
import { buildFlashcardHistory, paginateFlashcards } from "../http/flashcards.js";

function makeFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "fc-1",
    front: "Question",
    back: "Answer",
    topic: "JWT authentication",
    tags: [],
    difficulty: "medium",
    createdAt: "2026-04-01T10:00:00.000Z",
    dueDate: "2026-04-02T09:00:00.000Z",
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    ...overrides,
  };
}

describe("flashcard http helpers", () => {
  test("paginateFlashcards sorts active cards by closest due date first", () => {
    const result = paginateFlashcards([
      makeFlashcard({ id: "fc-2", dueDate: "2026-04-03T09:00:00.000Z" }),
      makeFlashcard({ id: "fc-1", dueDate: "2026-04-01T09:00:00.000Z" }),
      makeFlashcard({ id: "fc-3", dueDate: "2026-04-01T09:00:00.000Z" }),
    ], { status: "active", limit: 10 });

    assert.deepEqual(result.items.map((card) => card.id), ["fc-1", "fc-3", "fc-2"]);
    assert.equal(result.hasMore, false);
    assert.equal(result.nextCursor, null);
  });

  test("paginateFlashcards advances active cursor without duplicates", () => {
    const cards = [
      makeFlashcard({ id: "fc-1", dueDate: "2026-04-01T09:00:00.000Z" }),
      makeFlashcard({ id: "fc-2", dueDate: "2026-04-02T09:00:00.000Z" }),
      makeFlashcard({ id: "fc-3", dueDate: "2026-04-03T09:00:00.000Z" }),
    ];

    const first = paginateFlashcards(cards, { status: "active", limit: 2 });
    assert.deepEqual(first.items.map((card) => card.id), ["fc-1", "fc-2"]);
    assert.equal(first.hasMore, true);
    assert.ok(first.nextCursor);

    const second = paginateFlashcards(cards, { status: "active", limit: 2, cursor: first.nextCursor ?? undefined });
    assert.deepEqual(second.items.map((card) => card.id), ["fc-3"]);
    assert.equal(second.hasMore, false);
  });

  test("paginateFlashcards sorts archived cards by most recently archived first", () => {
    const result = paginateFlashcards([
      makeFlashcard({ id: "fc-1", archivedAt: "2026-04-01T12:00:00.000Z" }),
      makeFlashcard({ id: "fc-2", archivedAt: "2026-04-03T12:00:00.000Z" }),
      makeFlashcard({ id: "fc-3", archivedAt: "2026-04-02T12:00:00.000Z" }),
    ], { status: "archived", limit: 10 });

    assert.deepEqual(result.items.map((card) => card.id), ["fc-2", "fc-3", "fc-1"]);
  });

  test("paginateFlashcards applies topic filter before paginating", () => {
    const result = paginateFlashcards([
      makeFlashcard({ id: "jwt-1", topic: "JWT authentication" }),
      makeFlashcard({ id: "java-1", topic: "Java OS & JVM Internals" }),
    ], { status: "active", topic: "Java OS & JVM Internals", limit: 10 });

    assert.deepEqual(result.items.map((card) => card.id), ["java-1"]);
  });

  test("buildFlashcardHistory returns ordered replacement chain and empty-history flag", () => {
    const history = buildFlashcardHistory([
      makeFlashcard({ id: "v1", replacedByFlashcardId: "v2", archivedAt: "2026-04-02T12:00:00.000Z" }),
      makeFlashcard({ id: "v2", parentFlashcardId: "v1", replacedByFlashcardId: "v3", archivedAt: "2026-04-03T12:00:00.000Z" }),
      makeFlashcard({ id: "v3", parentFlashcardId: "v2" }),
    ], "v2");

    assert.ok(history);
    assert.equal(history?.selectedId, "v2");
    assert.equal(history?.hasHistory, true);
    assert.deepEqual(history?.items.map((card) => card.id), ["v1", "v2", "v3"]);
  });

  test("buildFlashcardHistory returns friendly empty-history state for standalone cards", () => {
    const history = buildFlashcardHistory([makeFlashcard({ id: "solo" })], "solo");

    assert.ok(history);
    assert.equal(history?.hasHistory, false);
    assert.deepEqual(history?.items.map((card) => card.id), ["solo"]);
  });
});
