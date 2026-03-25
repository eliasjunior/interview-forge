import { z } from "zod";
import fs from "fs";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Exercise } from "@mock-interview/shared";
import { assessComplexity } from "../exercises/assessment.js";
import { buildExerciseMarkdown, DIFFICULTY_LABELS } from "../exercises/markdown.js";
import type { ToolDeps } from "./deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// create_exercise
//
// Creates a structured practice exercise and stores it in the knowledge center.
// The tool writes the .md file and persists metadata to SQLite, then returns
// complexitySignals + roadmap so the orchestrator LLM can reason about whether
// the exercise is appropriate and propose a progression if it is too hard.
//
// OCP: entirely additive — zero changes to existing tools.
// ─────────────────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function registerCreateExerciseTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "create_exercise",
    {
      description: "Create a structured practice exercise in the knowledge center. " +
      "The tool writes a rich .md file under data/knowledge/exercises/<topic>/, persists metadata, " +
      "and returns complexity signals + a progression roadmap so you can reason about whether to " +
      "start this exercise directly or propose simpler prerequisite exercises first. " +
      "If the exercise is too hard (difficulty ≥ 4 or unmet prerequisites), show the roadmap to the candidate.",
      inputSchema: {
        name: z.string().min(1).describe("Exercise name, e.g. 'RaceConditionLab'"),
        topic: z.string().min(1).describe("Knowledge topic slug, e.g. 'java-concurrency', 'jwt'"),
        language: z.string().default("java").describe("Programming language: 'java' | 'typescript' | 'python' | 'any'"),
        difficulty: z.preprocess((v) => typeof v === "string" ? parseInt(v, 10) : v, z.number().int().min(1).max(5)).describe("1=Trivial, 2=Easy, 3=Medium, 4=Hard, 5=Very Hard"),
        description: z.string().min(1).describe("One-line summary of what the exercise practices"),
        scenario: z.string().min(1).describe("Real-world system this exercise is drawn from, e.g. 'Background email/job processing system'"),
        problemMeaning: z.preprocess((v) => typeof v === "string" ? JSON.parse(v) : v, z.array(z.string()).min(1)).describe("Why this matters in production — 2-4 bullet points explaining the real problem it solves"),
        tags: z.preprocess((v) => typeof v === "string" ? JSON.parse(v) : v, z.array(z.string()).default([])).describe("Optional grouping labels, e.g. ['matrix', '2d-indexing', 'array-traversal']"),
        learningGoal: z.string().min(1).describe("What the candidate will understand after completing this exercise"),
        problemStatement: z.string().min(1).describe("What to build — the concrete problem to solve"),
        steps: z.preprocess((v) => typeof v === "string" ? JSON.parse(v) : v, z.array(z.string()).min(1)).describe("Incremental implementation steps from simplest to complete"),
        evaluationCriteria: z.preprocess((v) => typeof v === "string" ? JSON.parse(v) : v, z.array(z.string()).min(1)).describe("What a good solution must demonstrate"),
        hints: z.preprocess((v) => typeof v === "string" ? JSON.parse(v) : v, z.array(z.string()).default([])).describe("Optional hints — shown only when stuck"),
        relatedConcepts: z.preprocess((v) => typeof v === "string" ? JSON.parse(v) : v, z.array(z.string()).default([])).describe("Concept links back to the knowledge file, e.g. 'java-concurrency.md: race condition, atomicity'"),
        prerequisites: z.preprocess((v) => typeof v === "string" ? JSON.parse(v) : v, z.array(z.object({
          name: z.string().describe("Exercise name that must be done first"),
          reason: z.string().describe("Why this is a prerequisite"),
        })).default([])).describe("Simpler exercises that should be completed before this one"),
      },
    },
    async ({
      name,
      topic,
      language,
      difficulty,
      description,
      scenario,
      problemMeaning,
      tags,
      learningGoal,
      problemStatement,
      steps,
      evaluationCriteria,
      hints,
      relatedConcepts,
      prerequisites,
    }) => {
      // ── 1. Duplicate check ───────────────────────────────────────────────────
      const existing = deps.findExerciseByName(name);
      if (existing) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: `Exercise "${name}" already exists.`,
              existing,
            }),
          }],
        };
      }

      // ── 2. Build exercise record ─────────────────────────────────────────────
      const slug = toSlug(name);
      const topicDir = path.join(deps.exercisesDir, topic);
      if (!fs.existsSync(topicDir)) fs.mkdirSync(topicDir, { recursive: true });

      const fileName = `${slug}.md`;
      const fullPath = path.join(topicDir, fileName);
      const relFilePath = path.join(topic, fileName);

      const exercise: Exercise = {
        id: deps.generateId(),
        name,
        slug,
        topic,
        language,
        difficulty: difficulty as Exercise["difficulty"],
        description,
        scenario,
        problemMeaning,
        tags,
        prerequisites: prerequisites as Exercise["prerequisites"],
        filePath: relFilePath,
        createdAt: new Date().toISOString(),
      };

      // ── 3. Write .md file ────────────────────────────────────────────────────
      const markdown = buildExerciseMarkdown(exercise, {
        learningGoal,
        problemStatement,
        steps,
        evaluationCriteria,
        hints,
        relatedConcepts,
      });
      fs.writeFileSync(fullPath, markdown, "utf-8");

      // ── 4. Persist metadata ──────────────────────────────────────────────────
      deps.saveExercise(exercise);

      // ── 5. Complexity assessment ─────────────────────────────────────────────
      const allExercises = deps.loadExercises();
      const assessment = assessComplexity(difficulty, exercise.prerequisites, allExercises);

      console.error(
        `[create_exercise] name="${name}" topic="${topic}" difficulty=${difficulty}/5 ` +
        `tooHard=${assessment.tooHard} file=${relFilePath}`
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            created: true,
            exercise,
            filePath: fullPath,
            complexityAssessment: {
              difficulty,
              difficultyLabel: DIFFICULTY_LABELS[difficulty],
              tags,
              prerequisiteCount: prerequisites.length,
              unmetPrerequisites: assessment.unmetPrerequisites,
              tooHard: assessment.tooHard,
              reason: assessment.reason,
              roadmap: assessment.roadmap,
            },
            instruction:
              "IMPORTANT — reason about this exercise before presenting it: " +
              "(1) If complexityAssessment.tooHard is true, DO NOT jump straight into the exercise. " +
              "Instead, show the candidate the roadmap: 'Before this exercise, I recommend completing: [roadmap]'. " +
              "Ask: 'Do you want to start with the prerequisites, or jump straight into this one?' " +
              "(2) If unmetPrerequisites is non-empty, suggest creating those exercises first with create_exercise. " +
              "(3) If tooHard is false, present the exercise directly: show the Learning Goal and Problem Statement, " +
              "then ask the candidate to start. " +
              "(4) After the candidate completes the exercise, call log_mistake for any gaps found, " +
              "and use start_scoped_interview with the exercise content as a follow-up drill.",
          }, null, 2),
        }],
      };
    }
  );
}
