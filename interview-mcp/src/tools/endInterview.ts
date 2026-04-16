import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";
import { buildSessionRewardSummary } from "./getTopicLevel.js";
import { buildEndInterviewRecommendations } from "../sessionUtils.js";
import { buildFlashcardDrafts } from "../flashcardUtils.js";

export function registerEndInterviewTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "end_interview",
    { description: "Force-end the interview at any point and generate a summary. Valid in any active state.", inputSchema: { sessionId: z.string() } },
    async ({ sessionId }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);
      if (session.state === "ENDED") return deps.stateError("Session is already ended.");

      const { summary, concepts, reportFile } = await deps.finalizeSession(session, sessions);
      const recommendations = buildEndInterviewRecommendations(session, deps.loadMistakes(session.topic));
      const flashcardDrafts = buildFlashcardDrafts(session);
      const knowledgeTopic = deps.knowledge.findByTopic(session.topic);
      const hasWarmupContent =
        knowledgeTopic != null &&
        knowledgeTopic.warmupLevels != null &&
        Object.keys(knowledgeTopic.warmupLevels).length > 0;
      const rewardSummary = buildSessionRewardSummary(session, deps.loadSessions(), hasWarmupContent);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            state: session.state,
            summary,
            conceptsExtracted: concepts.length,
            reportFile,
            rewardSummary,
            recommendations,
            flashcards: {
              draftCount: flashcardDrafts.length,
              nextStep: flashcardDrafts.length > 0
                ? {
                    tool: "prepare_flashcards",
                    args: { sessionId },
                    hint: "Call prepare_flashcards to build the drafts, then present them to the user for confirmation before creating any card.",
                  }
                : null,
            },
          }),
        }],
      };
    }
  );
}
