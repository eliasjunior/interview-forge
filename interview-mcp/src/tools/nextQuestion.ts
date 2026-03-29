import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";
import { buildSessionRewardSummary } from "./getTopicLevel.js";
import { buildEndInterviewRecommendations } from "../interviewUtils.js";

export function registerNextQuestionTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "next_question",
    { description: "Advance to the next question, or end the interview if all questions are done. Valid in state: FOLLOW_UP.", inputSchema: { sessionId: z.string() } },
    async ({ sessionId }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);

      const guard = deps.assertState(session, "next_question");
      if (!guard.ok) return deps.stateError(guard.error);

      session.currentQuestionIndex++;
      const done = session.currentQuestionIndex >= session.questions.length;

      if (done) {
        const { summary, avgScore, concepts, reportFile } = await deps.finalizeSession(session, sessions);
        const recommendations = buildEndInterviewRecommendations(session, deps.loadMistakes(session.topic));
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
              done: true,
              avgScore,
              summary,
              conceptsExtracted: concepts.length,
              reportFile,
              rewardSummary,
              recommendations,
              nextTool: null,
              instruction: "Interview complete. Use get_graph to inspect the knowledge graph.",
            }),
          }],
        };
      }

      session.state = "ASK_QUESTION";
      deps.saveSessions(sessions);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            state: session.state,
            questionNumber: session.currentQuestionIndex + 1,
            totalQuestions: session.questions.length,
            nextTool: "ask_question",
          }),
        }],
      };
    }
  );
}
