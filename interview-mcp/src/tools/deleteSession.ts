import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerDeleteSessionTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "delete_session",
    {
      description: "Inspect or delete a session and all derived artifacts tied to it. " +
      "Dry-run mode is the default and returns the full impact scan without deleting anything. " +
      "When dryRun=false, the tool deletes the session, sourced flashcards, session-specific report files, " +
      "and rebuilds the graph from remaining sessions.",
      inputSchema: {
        sessionId: z.string().describe("Session id to inspect or delete."),
        dryRun: z.boolean().default(true)
          .describe("Default true. When true, return the deletion impact scan only. When false, perform deletion."),
      },
    },
    async ({ sessionId, dryRun }) => {
      const preview = deps.inspectSessionDeletion(sessionId);
      if (!preview) {
        return deps.stateError(`Session '${sessionId}' not found.`);
      }

      if (dryRun) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              dryRun: true,
              preview,
              instruction:
                "Review the impact scan above. If this is the correct low-value or duplicate session, " +
                "call delete_session again with the same sessionId and dryRun=false.",
            }, null, 2),
          }],
        };
      }

      const result = deps.deleteSessionById(sessionId);
      if (!result) {
        return deps.stateError(`Session '${sessionId}' not found.`);
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            deleted: true,
            sessionId,
            preview: result.preview,
            deletedFlashcards: result.deletedFlashcards,
            deletedArtifacts: result.deletedArtifacts,
            graphAfterRebuild: result.graph,
          }, null, 2),
        }],
      };
    }
  );
}
