import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerAskFollowupTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "ask_followup",
    { description: "Ask the follow-up question generated during evaluation. Valid in state: FOLLOW_UP.", inputSchema: { sessionId: z.string() } },
    async ({ sessionId }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);

      const guard = deps.assertState(session, "ask_followup");
      if (!guard.ok) return deps.stateError(guard.error);

      const lastEval = session.evaluations[session.evaluations.length - 1];
      const followUp =
        lastEval?.followUpQuestion ?? "Can you elaborate further on your previous answer?";

      session.messages.push({
        role: "interviewer",
        content: followUp,
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
            followUpQuestion: followUp,
            nextTool: "submit_answer",
          }),
        }],
      };
    }
  );
}
