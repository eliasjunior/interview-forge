import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { detectContentType, detectGaps, discoverScopeFiles } from "../content/analyzer.js";
import { extractSpec } from "../content/parser.js";
import { buildAlgorithmQuestions, buildQuestions, polishContent } from "../content/questionBuilder.js";
import { buildDrillCustomContent, buildRecallContext } from "../drills/contentBuilder.js";
import { assessComplexity } from "../exercises/assessment.js";
import { buildExerciseMarkdown } from "../exercises/markdown.js";
import { buildScopeContent, deriveSessionGoal } from "../scope/builder.js";
import type { Evaluation, Exercise, Mistake } from "@mock-interview/shared";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("content extraction modules", () => {
  const apiSpec = `
POST /payments (create payment)
GET /payments/{id} (fetch payment)

Payment contains the fields amount (number), currency (string), status (string)

Business rules
- amount must be greater than zero
- currency is required
- data is kept in memory on startup
`;

  test("extractSpec pulls endpoints, models, rules, and notes", () => {
    const spec = extractSpec(apiSpec);
    assert.equal(spec.endpoints.length, 2);
    assert.equal(spec.models[0]?.name, "Payment");
    assert.ok(spec.rules.some((rule) => rule.includes("amount must be greater than zero")));
    assert.ok(spec.notes.some((note) => note.includes("in memory on startup")));
  });

  test("questionBuilder builds polished markdown and api questions", () => {
    const spec = extractSpec(apiSpec);
    const gaps = detectGaps(apiSpec);
    const polished = polishContent("Payments", apiSpec, "reliability");
    const questions = buildQuestions("Payments", spec, gaps, "reliability");

    assert.match(polished, /# Payments — Structured Spec/);
    assert.match(polished, /## API Endpoints/);
    assert.equal(questions.length, 6);
    assert.match(questions[0], /most critical missing pieces/);
  });

  test("detectContentType routes algorithm content to algorithm question generation", () => {
    const algorithmSpec = `
## Problem Statement
## Constraints
Time: O(n)
Space: O(1)
`;

    assert.equal(detectContentType(algorithmSpec), "algorithm");
    assert.equal(buildAlgorithmQuestions("Rotate Matrix", algorithmSpec, "correctness").length, 6);
  });

  test("discoverScopeFiles ranks topic matches and returns previews", () => {
    const scopeDir = makeTempDir("first-mcp-scope-");
    fs.writeFileSync(path.join(scopeDir, "payments-api.md"), "# Payments API\nCreate and fetch payments\n", "utf-8");
    fs.writeFileSync(path.join(scopeDir, "jwt-auth.md"), "# JWT\nToken validation\n", "utf-8");

    const candidates = discoverScopeFiles("payments api", scopeDir);
    assert.equal(candidates[0]?.filename, "payments-api.md");
    assert.match(candidates[0]?.preview ?? "", /Payments API/);
  });
});

describe("supporting builders", () => {
  test("scope builder derives a goal and renders all sections", () => {
    const goal = deriveSessionGoal("Event Loop", ["microtasks", "macrotasks"], "mixed");
    const content = buildScopeContent({
      topic: "Event Loop",
      focusAreas: ["microtasks", "macrotasks"],
      weakSpots: ["Promise ordering"],
      depth: "mixed",
      outOfScope: ["DOM APIs"],
      sessionGoal: goal,
    });

    assert.match(content, /## Focus Areas/);
    assert.match(content, /## Known Weak Spots/);
    assert.match(content, /Promise ordering/);
  });

  test("drill builder creates recall context and drill content", () => {
    const weakEvals: Evaluation[] = [{
      questionIndex: 0,
      question: "What is a race condition?",
      answer: "Unsure",
      score: 2,
      feedback: "Define it and give an example.",
      needsFollowUp: true,
      strongAnswer: "A race condition occurs when outcome depends on timing.",
    }];
    const mistakes: Mistake[] = [{
      id: "m1",
      mistake: "Confused race condition with deadlock",
      pattern: "Concurrency terms blur together",
      fix: "Explain both with examples before comparing them",
      topic: "java-concurrency",
      createdAt: "2026-01-01T00:00:00.000Z",
    }];

    const recall = buildRecallContext(weakEvals, mistakes);
    const content = buildDrillCustomContent("Java Concurrency", "s1", "2026-01-02T00:00:00.000Z", "2.0", weakEvals, mistakes);

    assert.equal(recall.knownMistakes.length, 1);
    assert.equal(recall.weakAreas[0]?.previousScore, 2);
    assert.match(content, /Known Mistake Patterns/);
    assert.match(content, /Strong answer looks like/);
  });

  test("exercise modules render markdown and assess prerequisites", () => {
    const exercise: Exercise = {
      id: "ex-1",
      name: "Race Condition Lab",
      slug: "race-condition-lab",
      topic: "java-concurrency",
      language: "java",
      difficulty: 4,
      description: "Practice race condition debugging",
      scenario: "Concurrent counter service",
      problemMeaning: ["Shows how unsafe shared state fails under load"],
      tags: ["concurrency"],
      prerequisites: [{ name: "Atomic Counter Basics", reason: "Learn atomic primitives first" }],
      filePath: "java-concurrency/race-condition-lab.md",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const markdown = buildExerciseMarkdown(exercise, {
      learningGoal: "Understand race conditions",
      problemStatement: "Fix the counter implementation",
      steps: ["Run the code", "Identify the race", "Fix it"],
      evaluationCriteria: ["Uses atomic or synchronized protection"],
      hints: [],
      relatedConcepts: ["atomicity"],
    });
    const assessment = assessComplexity(exercise.difficulty, exercise.prerequisites, []);

    assert.match(markdown, /# Exercise: Race Condition Lab/);
    assert.equal(assessment.tooHard, true);
    assert.deepEqual(assessment.unmetPrerequisites, ["Atomic Counter Basics"]);
  });
});
