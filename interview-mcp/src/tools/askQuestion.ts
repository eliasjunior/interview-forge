import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerAskQuestionTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "ask_question",
    { description: "Present the current interview question to the candidate. Valid in state: ASK_QUESTION.", inputSchema: { sessionId: z.string() } },
    async ({ sessionId }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);

      const guard = deps.assertState(session, "ask_question");
      if (!guard.ok) return deps.stateError(guard.error);

      const question = session.questions[session.currentQuestionIndex];
      const entry = deps.knowledge.findByTopic(session.topic);
      const evaluationCriteria = entry?.evaluationCriteria[session.currentQuestionIndex];

      session.messages.push({
        role: "interviewer",
        content: question,
        timestamp: new Date().toISOString(),
      });
      session.state = "WAIT_FOR_ANSWER";
      deps.saveSessions(sessions);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            state: session.state,
            questionNumber: session.currentQuestionIndex + 1,
            totalQuestions: session.questions.length,
            question,
            evaluationCriteria: evaluationCriteria ?? null,
            nextTool: "submit_answer",
          }),
        }],
      };
    }
  );
}
