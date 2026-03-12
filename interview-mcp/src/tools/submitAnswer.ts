import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerSubmitAnswerTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "submit_answer",
    "Submit the candidate's answer to the current question. Valid in state: WAIT_FOR_ANSWER.",
    {
      sessionId: z.string(),
      answer: z.string().describe("The candidate's full answer"),
    },
    async ({ sessionId, answer }) => {
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
      session.state = "EVALUATE_ANSWER";
      deps.saveSessions(sessions);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            state: session.state,
            nextTool: "evaluate_answer",
          }),
        }],
      };
    }
  );
}
