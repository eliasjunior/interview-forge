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
        "Use this after end_interview finishes the session. " +
        "Always present the proposed drafts to the user, confirm which ones to create, " +
        "and ask if they want additional cards on any topic before calling create_flashcard.",
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
              ? "Present the proposed flashcard topics to the user as a numbered list (topic + difficulty for each draft). " +
                "Ask the user which ones they want to create — they can say 'all', pick specific numbers, or exclude some. " +
                "Then ask: 'Are there any other topics from this session you'd like a flashcard for?' " +
                "Only call create_flashcard for the cards the user confirms or requests. " +
                "Do not create any card without explicit user confirmation."
              : "No weak answers were found, so no flashcard drafts were prepared. Ask the user if they would like to create any flashcards manually for topics covered in this session.",
          }, null, 2),
        }],
      };
    }
  );
}
