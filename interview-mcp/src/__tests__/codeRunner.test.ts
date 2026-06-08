import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { StoredCodeChallenge } from "../repositories/codeChallengeRepository.js";
import { runCodeChallenge } from "../codeExecution/runner.js";

function challenge(
  language: StoredCodeChallenge["language"],
  testHarness: string,
): StoredCodeChallenge {
  return {
    sessionId: "session-1",
    language,
    functionSignature: language === "java"
      ? "public static int add(int a, int b)"
      : "function add(a, b)",
    starterCode: "",
    sampleTests: ["add(1, 2) -> 3"],
    hints: ["Return the sum."],
    hiddenTestCount: 2,
    testHarness,
    referenceSolution: "private",
    teacherNotes: "",
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
  };
}

describe("runCodeChallenge", () => {
  test("runs JavaScript candidate code against a hidden harness", async () => {
    const result = await runCodeChallenge(
      challenge("javascript", `
const tests = [[1, 2, 3], [-2, 5, 3]];
for (const [a, b, expected] of tests) {
  if (add(a, b) !== expected) {
    console.error("FAIL addition");
    process.exit(1);
  }
}
console.log("PASS 2 tests");
      `),
      "function add(a, b) { return a + b; }",
    );

    assert.equal(result.ok, true);
    assert.match(result.stdout, /PASS 2 tests/);
  });

  test("returns JavaScript test failures without exposing the harness", async () => {
    const result = await runCodeChallenge(
      challenge("javascript", `
if (add(1, 2) !== 3) {
  console.error("FAIL addition");
  process.exit(1);
}
      `),
      "function add(a, b) { return a - b; }",
    );

    assert.equal(result.ok, false);
    assert.equal(result.phase, "test");
    assert.match(result.stderr, /FAIL addition/);
  });

  test("compiles and runs Java candidate code", async () => {
    const result = await runCodeChallenge(
      challenge("java", `
class TestRunner {
  public static void main(String[] args) {
    if (Solution.add(1, 2) != 3 || Solution.add(-2, 5) != 3) {
      System.err.println("FAIL addition");
      System.exit(1);
    }
    System.out.println("PASS 2 tests");
  }
}
      `),
      "public class Solution { public static int add(int a, int b) { return a + b; } }",
    );

    assert.equal(result.ok, true);
    assert.match(result.stdout, /PASS 2 tests/);
  });

  test("returns Java compilation errors", async () => {
    const result = await runCodeChallenge(
      challenge("java", "class TestRunner { public static void main(String[] args) {} }"),
      "public class Solution { this is not java }",
    );

    assert.equal(result.ok, false);
    assert.equal(result.phase, "compile");
    assert.match(result.stderr, /error:/i);
  });
});
