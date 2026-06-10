import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Session } from "@mock-interview/shared";
import type { StoredCodeChallenge } from "../repositories/codeChallengeRepository.js";
import { replaceProblemStatement } from "../codeChallenges/problemDefinition.js";
import { registerAskQuestionTool } from "../tools/askQuestion.js";
import { registerConfigureCodeChallengeTool } from "../tools/configureCodeChallenge.js";
import type { ToolDeps } from "../tools/deps.js";

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0]!.text);
}

describe("code problem definitions", () => {
  test("renders LeetCode-style examples inside the problem statement section", () => {
    const content = replaceProblemStatement(
      "# Study Scope: Valid Anagram\n\n## Problem Statement\nProblem definition pending.",
      {
        problemStatement: "Given two strings s and t, return true if t is an anagram of s.",
        examples: [
          {
            input: 's = "anagram", t = "nagaram"',
            output: "true",
            explanation: "Both strings contain the same characters with the same frequencies.",
          },
          {
            input: 's = "rat", t = "car"',
            output: "false",
          },
        ],
        constraints: [
          "1 <= s.length, t.length <= 5 * 10^4",
          "s and t contain lowercase English letters.",
        ],
      },
    );

    assert.match(content, /## Problem Statement/);
    assert.match(content, /#### Example 1/);
    assert.match(content, /\*\*Input:\*\* s = "anagram", t = "nagaram"/);
    assert.match(content, /\*\*Output:\*\* true/);
    assert.match(content, /### Constraints/);
    assert.doesNotMatch(content, /Problem definition pending/);
  });

  test("configure_code_challenge persists the public definition and keeps private artifacts private", async () => {
    const session: Session = {
      id: "valid-anagram-session",
      topic: "Strings",
      problemTitle: "Valid Anagram",
      interviewType: "code",
      sessionKind: "interview",
      state: "ASK_QUESTION",
      currentQuestionIndex: 0,
      questions: ["Explain your approach.", "Implement Valid Anagram."],
      messages: [],
      evaluations: [],
      customContent: "# Study Scope: Valid Anagram\n\n## Problem Statement\nProblem definition pending.",
      createdAt: "2026-06-09T10:00:00.000Z",
      knowledgeSource: "file",
    };
    const sessions = { [session.id]: session };
    let storedChallenge: StoredCodeChallenge | null = null;
    const deps = {
      loadSessions: () => sessions,
      saveSessions: (next: Record<string, Session>) => Object.assign(sessions, next),
      getCodeChallenge: () => storedChallenge,
      saveCodeChallenge: (challenge: StoredCodeChallenge) => {
        storedChallenge = challenge;
      },
      stateError: (message: string) => ({
        content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
      }),
    } as unknown as ToolDeps;
    const handlers = new Map<string, Handler>();
    const server = {
      registerTool(name: string, _config: object, handler: Handler) {
        handlers.set(name, handler);
      },
    };
    registerConfigureCodeChallengeTool(server as never, deps);

    const payload = parse(await handlers.get("configure_code_challenge")!({
      sessionId: session.id,
      language: "javascript",
      problemStatement: "Given two strings s and t, return true if t is an anagram of s, otherwise return false.",
      examples: [
        { input: 's = "anagram", t = "nagaram"', output: "true" },
        { input: 's = "rat", t = "car"', output: "false" },
      ],
      constraints: [
        "1 <= s.length, t.length <= 5 * 10^4",
        "s and t contain lowercase English letters.",
      ],
      functionSignature: "function isAnagram(s, t)",
      starterCode: "function isAnagram(s, t) {\n  // TODO\n}",
      sampleTests: [
        'isAnagram("anagram", "nagaram") -> true',
        'isAnagram("rat", "car") -> false',
      ],
      hints: ["Compare lengths first.", "Track character frequencies."],
      hiddenTestCount: 8,
      testHarness: "private hidden harness",
      referenceSolution: "private reference solution",
      teacherNotes: "Probe Unicode assumptions only after the base solution.",
    }));

    assert.equal(payload.configured, true);
    assert.equal(payload.problemDefinition.examples.length, 2);
    assert.equal(payload.privateArtifactsStored.referenceSolution, true);
    assert.doesNotMatch(JSON.stringify(payload), /private reference solution/);
    assert.doesNotMatch(JSON.stringify(payload), /private hidden harness/);
    assert.match(sessions[session.id]!.customContent ?? "", /Given two strings s and t/);
    assert.match(sessions[session.id]!.customContent ?? "", /#### Example 2/);
    assert.ok(storedChallenge);
  });

  test("ask_question blocks code interviews until the challenge is configured", async () => {
    const session: Session = {
      id: "pending-code-session",
      topic: "Strings",
      problemTitle: "Valid Anagram",
      interviewType: "code",
      state: "ASK_QUESTION",
      currentQuestionIndex: 0,
      questions: ["Explain your approach."],
      messages: [],
      evaluations: [],
      createdAt: "2026-06-09T10:00:00.000Z",
      knowledgeSource: "file",
    };
    const deps = {
      loadSessions: () => ({ [session.id]: session }),
      getCodeChallenge: () => null,
      assertState: () => ({ ok: true as const }),
      stateError: (message: string) => ({
        content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
      }),
    } as unknown as ToolDeps;
    const handlers = new Map<string, Handler>();
    const server = {
      registerTool(name: string, _config: object, handler: Handler) {
        handlers.set(name, handler);
      },
    };
    registerAskQuestionTool(server as never, deps);

    const payload = parse(await handlers.get("ask_question")!({ sessionId: session.id }));

    assert.match(payload.error, /not configured/);
    assert.match(payload.error, /configure_code_challenge/);
    assert.equal(session.state, "ASK_QUESTION");
    assert.equal(session.messages.length, 0);
  });
});
