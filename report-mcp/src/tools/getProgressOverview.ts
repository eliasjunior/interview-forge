import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerGetProgressOverviewTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "get_progress_overview",
    {
      description: "Aggregate ended sessions into a progress snapshot: score trend, topic breakdown, repeated-topic improvement, weak-question rate, and recent sessions.",
      inputSchema: {
        sessionKind: z.enum(["interview", "study", "drill", "all"]).default("interview")
          .describe("Filter to one session kind. Legacy sessions without sessionKind are treated as interview."),
        weakScoreThreshold: z.number().int().min(1).max(5).default(3)
          .describe("Treat scores <= this threshold as weak."),
        recentSessionsLimit: z.number().int().min(1).max(20).default(5)
          .describe("How many recent sessions to include."),
        topicLimit: z.number().int().min(1).max(20).default(10)
          .describe("How many topics to include in the topic breakdown."),
      },
    },
    async ({ sessionKind, weakScoreThreshold, recentSessionsLimit, topicLimit }) => {
      const sessions = deps.loadSessions();
      const progress = deps.buildProgressOverview(sessions, {
        sessionKind,
        weakScoreThreshold,
        recentSessionsLimit,
        topicLimit,
      });

      if (progress.totals.sessions === 0) {
        return deps.stateError(
          sessionKind === "all"
            ? "No ended sessions found."
            : `No ended sessions found for sessionKind='${sessionKind}'.`
        );
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(progress),
        }],
      };
    }
  );
}
