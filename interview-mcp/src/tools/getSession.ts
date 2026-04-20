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
          : "Keep the interview immersive. Ask the question first, then offer answer style naturally. " +
            "If ask_question returns a responseTimeLimitSec value, present it as soft timing pressure like 'Take up to 60 seconds.' " +
            "After evaluation, adapt the amount of explanation to the answer mode: " +
            "brief mode = 2-3 tight sentences plus one focused follow-up, " +
            "bullets mode = compact structured correction, " +
            "deep_dive mode = fuller explanation is fine. " +
            "Do not expose tool chatter or internal workflow details to the candidate.";

      const lastEval = session.evaluations[session.evaluations.length - 1];
      const activeFollowUp =
        session.state === "FOLLOW_UP" && lastEval?.needsFollowUp && lastEval.followUpQuestion
          ? {
              question: lastEval.followUpQuestion,
              type: lastEval.followUpType ?? null,
              focus: lastEval.followUpFocus ?? null,
              rationale: lastEval.followUpRationale ?? null,
              adaptiveChallengeType: lastEval.adaptiveChallengeType ?? null,
              adaptiveChallengePrompt: lastEval.adaptiveChallengePrompt ?? null,
              adaptiveChallengeGoal: lastEval.adaptiveChallengeGoal ?? null,
              adaptiveChallengeReward: lastEval.adaptiveChallengeReward ?? null,
            }
          : null;

      const payload = instruction || activeFollowUp
        ? {
            ...session,
            instruction,
            activeFollowUp,
          }
        : session;
      return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
    }
  );
}
