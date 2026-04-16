import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDeps } from "./deps.js";

const ANSWER_MODE_OPTIONS = [
  {
    id: "brief",
    label: "Brief",
    guidance: "Answer in 2-4 tight sentences. Prioritize the main decision and one trade-off.",
  },
  {
    id: "bullets",
    label: "Bullets",
    guidance: "Answer as 3-5 bullets. Prioritize coverage and structure over prose.",
  },
  {
    id: "deep_dive",
    label: "Deep dive",
    guidance: "Answer in fuller detail with trade-offs, examples, and edge cases.",
  },
] as const;

const ANSWER_MODE_PROMPT =
  "After presenting the question, invite the candidate to answer in one of three styles: Brief (2-4 sentences), Bullets (3-5 bullets), or Deep dive (fuller trade-offs and edge cases). Ask for the mode naturally after the question instead of turning it into a separate pre-question step.";

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
      const choices = session.questChoices?.[session.currentQuestionIndex];
      // Prefer pre-selected criteria stored on the session (populated when questions are
      // sampled from a knowledge file — avoids mismatched indices after shuffling).
      // Fall back to positional lookup from the knowledge file for legacy sessions.
      const evaluationCriteria =
        session.questionCriteria?.[session.currentQuestionIndex] ??
        deps.knowledge.findByTopic(session.topic)?.evaluationCriteria[session.currentQuestionIndex];

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
            choices: choices && choices.length > 0 ? choices : null,
            evaluationCriteria: evaluationCriteria ?? null,
            answerModes: ANSWER_MODE_OPTIONS,
            defaultAnswerMode: "deep_dive",
            answerModePrompt: ANSWER_MODE_PROMPT,
            nextTool: "submit_answer",
          }),
        }],
      };
    }
  );
}
