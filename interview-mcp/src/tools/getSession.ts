import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

export function registerGetSessionTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "get_session",
    { description: "Retrieve a session by ID — transcript, state, evaluations, and summary.", inputSchema: { sessionId: z.string() } },
    async ({ sessionId }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);

      const instruction =
        session.interviewType === "code"
          ? "This is a CODE interview session (algorithm problem). " +
            `Topic/category: "${session.topic}". ` +
            (session.problemTitle ? `Concrete problem: "${session.problemTitle}". ` : "") +
            "The problem is in customContent under '## Problem Statement'. " +
            "Flow: (1) present the problem to the candidate, (2) ask them to explain their approach before coding, " +
            "(3) hints are allowed when they unblock progress, but never reveal the full solution, " +
            "(4) if the candidate submits code without time/space complexity, ask for that explicitly after the solution, " +
            "(5) after a complete solution plus complexity, ask at most one problem-aware follow-up if it adds value; otherwise finish, " +
            "(6) do not continue through extra scripted questions once the solution phase is complete, " +
            "(7) end_interview when done. Do NOT run a system-design or API-design interview."
          : undefined;

      const payload = instruction ? { ...session, instruction } : session;
      return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
    }
  );
}
