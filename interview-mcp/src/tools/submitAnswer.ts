import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AnswerMode } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";

const DEFAULT_ANSWER_MODE: AnswerMode = "deep_dive";

export function registerSubmitAnswerTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "submit_answer",
    {
      description: "Submit the candidate's answer to the current question. Valid in state: WAIT_FOR_ANSWER.",
      inputSchema: {
        sessionId: z.string(),
        answer: z.string().describe("The candidate's full answer"),
        answerMode: z.enum(["brief", "bullets", "deep_dive"]).optional()
          .describe("How the candidate chose to answer: brief, bullets, or deep_dive. Defaults to deep_dive."),
      },
    },
    async ({ sessionId, answer, answerMode }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);

      const guard = deps.assertState(session, "submit_answer");
      if (!guard.ok) return deps.stateError(guard.error);

      session.messages.push({
        role: "candidate",
        content: answer,
        timestamp: new Date().toISOString(),
      });
      session.pendingAnswerMode = (answerMode ?? DEFAULT_ANSWER_MODE) as AnswerMode;
      session.state = "EVALUATE_ANSWER";
      deps.saveSessions(sessions);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            state: session.state,
            answerMode: session.pendingAnswerMode,
            nextTool: "evaluate_answer",
          }),
        }],
      };
    }
  );
}
