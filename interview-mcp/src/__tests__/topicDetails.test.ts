import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { getKnowledgeTopicDetails, listKnowledgeTopics, normalizeTopicPlanKey } from "../http/topicDetails.js";

function makeTempKnowledgeDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "topic-details-"));
}

function writeKnowledgeFile(dir: string, name: string, content: string) {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
}

test("listKnowledgeTopics reads markdown titles and file slugs", () => {
  const dir = makeTempKnowledgeDir();
  writeKnowledgeFile(dir, "data-access.md", `# Data Access\n\n## Summary\nSummary\n\n## Questions\n1. First question?\n`);

  const topics = listKnowledgeTopics(dir);
  assert.deepEqual(topics, [{ file: "data-access", displayName: "Data Access" }]);
});

test("normalizeTopicPlanKey matches both slug and display name", () => {
  const dir = makeTempKnowledgeDir();
  writeKnowledgeFile(dir, "data-access.md", `# Data Access\n\n## Summary\nSummary\n\n## Questions\n1. First question?\n`);

  assert.equal(normalizeTopicPlanKey(dir, "data-access"), "data-access");
  assert.equal(normalizeTopicPlanKey(dir, "Data Access"), "data-access");
});

test("normalizeTopicPlanKey tolerates missing topic values", () => {
  const dir = makeTempKnowledgeDir();
  writeKnowledgeFile(dir, "data-access.md", `# Data Access\n\n## Summary\nSummary\n\n## Questions\n1. First question?\n`);

  assert.equal(normalizeTopicPlanKey(dir, undefined), "");
  assert.equal(normalizeTopicPlanKey(dir, null), "");
});

test("getKnowledgeTopicDetails returns summary and question difficulty metadata", () => {
  const dir = makeTempKnowledgeDir();
  writeKnowledgeFile(dir, "data-access.md", `# Data Access

## Summary
Backend trade-offs at scale.

## Questions
1. Why does deep offset pagination get slower?
2. How do you stabilize pagination under updates?

   Exercise fit: micro
   Exercise goal: Make pagination stable.

## Difficulty
- Question 1: intermediate
- Question 2: advanced
`);

  const details = getKnowledgeTopicDetails(dir, "data-access");
  assert.ok(details);
  assert.equal(details.file, "data-access");
  assert.equal(details.topic, "Data Access");
  assert.equal(details.summary, "Backend trade-offs at scale.");
  assert.deepEqual(details.questions, [
    { index: 0, text: "Why does deep offset pagination get slower?", difficulty: "intermediate", exercise: { fit: "none" } },
    { index: 1, text: "How do you stabilize pagination under updates?", difficulty: "advanced", exercise: { fit: "micro", goal: "Make pagination stable." } },
  ]);
});

test("getKnowledgeTopicDetails returns null for missing topic", () => {
  const dir = makeTempKnowledgeDir();
  writeKnowledgeFile(dir, "data-access.md", `# Data Access\n\n## Summary\nSummary\n\n## Questions\n1. First question?\n`);

  assert.equal(getKnowledgeTopicDetails(dir, "missing-topic"), null);
});
