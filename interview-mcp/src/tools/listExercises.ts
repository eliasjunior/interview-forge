import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";

export function registerListExercisesTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "list_exercises",
    {
      description: "List practice exercises in the knowledge center. " +
      "Filter by topic or max difficulty to find what to work on next. " +
      "Returns exercises sorted by difficulty ascending, with prerequisite chains intact.",
      inputSchema: {
        topic: z.string().optional().describe("Filter by knowledge topic slug, e.g. 'java-concurrency', 'jwt'"),
        maxDifficulty: z.number().int().min(1).max(5).optional().describe("Only return exercises with difficulty ≤ this value"),
        tags: z.preprocess((v) => typeof v === "string" ? JSON.parse(v) : v, z.array(z.string()).optional()).describe("Only return exercises containing all of these tags, e.g. ['matrix', '2d-indexing']"),
      },
    },
    async ({ topic, maxDifficulty, tags }) => {
      const list = deps.loadExercises(topic, maxDifficulty, tags);

      // Group by topic for a structured overview
      const byTopic: Record<string, typeof list> = {};
      for (const ex of list) {
        if (!byTopic[ex.topic]) byTopic[ex.topic] = [];
        byTopic[ex.topic].push(ex);
      }

      const summary = Object.entries(byTopic).map(([t, exercises]) => ({
        topic: t,
        count: exercises.length,
        exercises: exercises.map((e) => ({
          name: e.name,
          difficulty: e.difficulty,
          language: e.language,
          description: e.description,
          scenario: e.scenario,
          problemMeaning: e.problemMeaning,
          tags: e.tags,
          prerequisites: e.prerequisites.map((p) => p.name),
          filePath: e.filePath,
        })),
      }));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            total: list.length,
            filters: { topic: topic ?? null, maxDifficulty: maxDifficulty ?? null, tags: tags ?? null },
            byTopic: summary,
            tip: "Use create_exercise to add new exercises. Use start_scoped_interview with the exercise file content to run a drill on it.",
          }, null, 2),
        }],
      };
    }
  );
}
