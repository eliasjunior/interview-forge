import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";
import { buildFlashcardDrafts } from "../flashcardUtils.js";

export function registerPrepareFlashcardsTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "prepare_flashcards",
    {
      description:
        "Build ready-to-submit create_flashcard payloads for weak answers in a completed interview. " +
        "Use this after end_interview or next_question finishes the session, then call create_flashcard once per returned draft.",
      inputSchema: {
        sessionId: z.string().describe("The completed interview session id."),
      },
    },
    async ({ sessionId }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);
      if (session.state !== "ENDED") {
        return deps.stateError(`Session '${sessionId}' must be ENDED before preparing flashcards.`);
      }

      const drafts = buildFlashcardDrafts(session);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            draftCount: drafts.length,
            drafts,
            instruction: drafts.length > 0
              ? "Call create_flashcard once per draft object. Pass each draft as-is."
              : "No weak answers were found, so no flashcard drafts were prepared.",
          }, null, 2),
        }],
      };
    }
  );
}
