import test from "node:test";
import assert from "node:assert/strict";
import { buildStrongAnswer } from "../evaluation/strongAnswer.js";

test("buildStrongAnswer prefers explicit strong-answer guidance from criteria", () => {
  const result = buildStrongAnswer({
    criteria: "Question 7: Must explain X. Strong answer: Name at least three JVM internal thread types and explain how to filter them out first. Bonus: mention ThreadMXBean.",
    feedback: "Partial answer.",
    answer: "Some answer",
  });

  assert.equal(
    result,
    "Name at least three JVM internal thread types and explain how to filter them out first."
  );
});

test("buildStrongAnswer derives a corrected answer from criteria when no explicit strong-answer clause exists", () => {
  const result = buildStrongAnswer({
    criteria: "Question 1: Must mention statelessness and self-contained claims. Bonus: contrast with session cookies.",
    feedback: "Too shallow.",
  });

  assert.equal(result, "mention statelessness and self-contained claims.");
});

test("buildStrongAnswer falls back to feedback when no criteria exists", () => {
  const result = buildStrongAnswer({
    feedback: "Missing the loop stop condition and odd-sized matrix edge case.",
    answer: "Start from zero and go to the center.",
  });

  assert.equal(
    result,
    "A stronger answer would cover the missing points called out in feedback: Missing the loop stop condition and odd-sized matrix edge case."
  );
});
