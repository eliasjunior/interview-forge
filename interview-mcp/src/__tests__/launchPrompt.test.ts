import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Session } from "@mock-interview/shared";
import { buildSessionLaunchPrompt } from "../sessions/launchPrompt.js";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "code-session-1",
    topic: "Arrays",
    problemTitle: "Two Sum",
    interviewType: "code",
    sessionKind: "interview",
    state: "ASK_QUESTION",
    currentQuestionIndex: 0,
    questions: [],
    messages: [],
    evaluations: [],
    createdAt: "2026-06-08T00:00:00.000Z",
    knowledgeSource: "file",
    ...overrides,
  };
}

describe("buildSessionLaunchPrompt", () => {
  test("generates a code-specific handoff for algorithm sessions", () => {
    const result = buildSessionLaunchPrompt(makeSession());

    assert.equal(result.title, "Arrays — Two Sum — code interview");
    assert.match(result.prompt, /algorithm\/coding interview/i);
    assert.match(result.prompt, /Do not turn it into API design/i);
    assert.match(result.prompt, /working code or precise pseudocode/i);
    assert.doesNotMatch(result.prompt, /three numbered answer styles/i);
  });
});
