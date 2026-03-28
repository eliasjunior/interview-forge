import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import { createSqliteClient } from "../db/client.js";
import { createSqliteRepositories } from "../db/repositories/createRepositories.js";
import type { Flashcard } from "@mock-interview/shared";
import { persistFlashcard, registerCreateFlashcardTool } from "../tools/createFlashcard.js";
import type { ToolDeps } from "../tools/deps.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

// ─── Test DB setup ────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function setupDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "first-mcp-fc-test-"));
  tempDirs.push(tempDir);
  const sqlite = createSqliteClient(path.join(tempDir, "app.db"));
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return { sqlite, repos: createSqliteRepositories(db) };
}

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

/** Minimal in-memory ToolDeps — tracks calls to saveFlashcard. */
function makeMockDeps(initial: Flashcard[] = []) {
  const store: Flashcard[] = [...initial];
  let saveCalls = 0;
  return {
    deps: {
      loadFlashcards: () => store,
      saveFlashcard: (card: Flashcard) => { store.push(card); saveCalls++; },
    } as unknown as ToolDeps,
    store,
    getSaveCalls: () => saveCalls,
  };
}

/** Minimal ToolDeps backed by real SQLite repositories. */
function makeRealDeps(repos: ReturnType<typeof createSqliteRepositories>): ToolDeps {
  return {
    loadFlashcards: () => repos.flashcards.list(),
    saveFlashcard: (card: Flashcard) => repos.flashcards.save(card),
  } as unknown as ToolDeps;
}

/** Spin up the tool and capture its handler without starting a real MCP server. */
function captureToolHandler(deps: ToolDeps) {
  type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;
  let handler!: Handler;
  const mockServer = {
    registerTool(_n: string, _config: object, h: Handler) { handler = h; },
  };
  registerCreateFlashcardTool(mockServer as any, deps);
  return handler;
}

// ─── Unit: persistFlashcard ───────────────────────────────────────────────────

describe("persistFlashcard — unit (mock deps)", () => {
  test("saves a new card and returns true", () => {
    const { deps, store } = makeMockDeps();
    const result = persistFlashcard(deps, makeFlashcard());
    assert.equal(result, true);
    assert.equal(store.length, 1);
  });

  test("skips a duplicate id and returns false without calling saveFlashcard", () => {
    const card = makeFlashcard();
    const { deps, store, getSaveCalls } = makeMockDeps([card]);
    const result = persistFlashcard(deps, card);
    assert.equal(result, false);
    assert.equal(getSaveCalls(), 0);
    assert.equal(store.length, 1);
  });

  test("saves multiple cards with distinct ids", () => {
    const { deps, store } = makeMockDeps();
    persistFlashcard(deps, makeFlashcard({ id: "fc-a" }));
    persistFlashcard(deps, makeFlashcard({ id: "fc-b" }));
    assert.equal(store.length, 2);
  });

  test("second persist of same id after first succeeds is a no-op", () => {
    const { deps, store, getSaveCalls } = makeMockDeps();
    persistFlashcard(deps, makeFlashcard({ id: "fc-x" }));
    persistFlashcard(deps, makeFlashcard({ id: "fc-x" }));
    assert.equal(store.length, 1);
    assert.equal(getSaveCalls(), 1);
  });
});

// ─── Integration: persistFlashcard with real SQLite ──────────────────────────

describe("persistFlashcard — integration (SQLite)", () => {
  test("persists a card to the DB and it is retrievable", () => {
    const { sqlite, repos } = setupDb();
    try {
      const deps = makeRealDeps(repos);
      const card = makeFlashcard();
      persistFlashcard(deps, card);
      const saved = repos.flashcards.getById(card.id);
      assert.ok(saved !== null);
      assert.equal(saved!.front, card.front);
      assert.equal(saved!.topic, card.topic);
      assert.equal(saved!.difficulty, card.difficulty);
    } finally {
      sqlite.close();
    }
  });

  test("idempotent: second persist with the same id does not create a duplicate row", () => {
    const { sqlite, repos } = setupDb();
    try {
      const deps = makeRealDeps(repos);
      const card = makeFlashcard();
      const first = persistFlashcard(deps, card);
      const second = persistFlashcard(deps, card);
      assert.equal(first, true);
      assert.equal(second, false);
      assert.equal(repos.flashcards.list().length, 1);
    } finally {
      sqlite.close();
    }
  });

  test("persists tags correctly", () => {
    const { sqlite, repos } = setupDb();
    try {
      const deps = makeRealDeps(repos);
      persistFlashcard(deps, makeFlashcard({ tags: ["arrays", "in-place", "matrix"] }));
      const saved = repos.flashcards.getById("fc-test-001")!;
      assert.deepEqual([...saved.tags].sort(), ["arrays", "in-place", "matrix"]);
    } finally {
      sqlite.close();
    }
  });
});

// ─── Integration: create_flashcard tool handler ──────────────────────────────

describe("create_flashcard tool handler — integration", () => {
  test("creates a card, returns created:true and correct fields in JSON payload", async () => {
    const { sqlite, repos } = setupDb();
    try {
      const handler = captureToolHandler(makeRealDeps(repos));
      const result = await handler({
        front: "What is the in-place marker technique?",
        back: "Use first row/col as markers to zero the matrix.",
        topic: "Zero Matrix",
        difficulty: "medium",
        tags: ["arrays", "in-place"],
      });
      const payload = JSON.parse(result.content[0].text);
      assert.equal(payload.created, true);
      assert.ok(typeof payload.cardId === "string");
      assert.ok(payload.cardId.startsWith("fc-manual-"));
      assert.equal(payload.topic, "Zero Matrix");
      assert.equal(payload.difficulty, "medium");
      assert.equal(repos.flashcards.list().length, 1);
    } finally {
      sqlite.close();
    }
  });

  test("card is immediately due (dueDate == createdAt)", async () => {
    const { sqlite, repos } = setupDb();
    try {
      const handler = captureToolHandler(makeRealDeps(repos));
      await handler({
        front: "What is due immediately?",
        back: "A newly created flashcard.",
        topic: "Timing",
        difficulty: "easy",
        tags: [],
      });
      const card = repos.flashcards.list()[0];
      assert.equal(card.dueDate, card.createdAt);
      assert.equal(card.repetitions, 0);
      assert.equal(card.interval, 1);
      assert.equal(card.easeFactor, 2.5);
    } finally {
      sqlite.close();
    }
  });

  test("returns created:false and skips insert when persistFlashcard detects a duplicate", async () => {
    const { deps, getSaveCalls } = makeMockDeps();
    const handler = captureToolHandler(deps);

    // First call creates the card
    await handler({
      front: "What is idempotency?",
      back: "Repeated saves should not duplicate the same card.",
      topic: "Persistence",
      difficulty: "easy",
      tags: [],
    });
    assert.equal(getSaveCalls(), 1);

    // Force a second persist of the same id to test the idempotency path
    const savedCard = deps.loadFlashcards()[0];
    const second = persistFlashcard(deps, savedCard);
    assert.equal(second, false);
    assert.equal(getSaveCalls(), 1); // no additional save
    assert.equal(deps.loadFlashcards().length, 1);
  });

  test("derives tags from topic when tags are omitted", async () => {
    const { deps } = makeMockDeps();
    const handler = captureToolHandler(deps);

    await handler({ front: "What is JWT?", back: "A token format.", topic: "JWT authentication", difficulty: "medium" });
    const card = deps.loadFlashcards()[0];
    assert.ok(card.tags.includes("jwt"));
    assert.ok(card.tags.includes("authentication"));
  });

  test("two separate calls create two distinct cards (new random id each time)", async () => {
    const { sqlite, repos } = setupDb();
    try {
      const handler = captureToolHandler(makeRealDeps(repos));
      await handler({ front: "Question one?", back: "Answer one.", topic: "Topic", difficulty: "easy", tags: [] });
      await handler({ front: "Question two?", back: "Answer two.", topic: "Topic", difficulty: "hard", tags: [] });
      assert.equal(repos.flashcards.list().length, 2);
    } finally {
      sqlite.close();
    }
  });
});
