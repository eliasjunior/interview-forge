import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Evaluation } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";

export function registerEvaluateAnswerTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "evaluate_answer",
    "Score the last answer (1–5) and decide if a follow-up is needed. Valid in state: EVALUATE_ANSWER. When AI is enabled call with sessionId only. When AI is disabled also provide score, feedback, and needsFollowUp.",
    {
      sessionId: z.string(),
      score: z.number().int().min(1).max(5).optional()
        .describe("Score 1–5 (required when AI is disabled)"),
      feedback: z.string().optional()
        .describe("Detailed feedback (required when AI is disabled)"),
      needsFollowUp: z.boolean().optional()
        .describe("Whether a follow-up question would help (required when AI is disabled)"),
      followUpQuestion: z.string().optional()
        .describe("The follow-up question to ask (provide when needsFollowUp is true)"),
    },
    async ({ sessionId, score, feedback, needsFollowUp, followUpQuestion }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);

      const guard = deps.assertState(session, "evaluate_answer");
      if (!guard.ok) return deps.stateError(guard.error);

      const lastQuestion = deps.findLast(session.messages, (m) => m.role === "interviewer");
      const lastAnswer = deps.findLast(session.messages, (m) => m.role === "candidate");

      if (!lastQuestion || !lastAnswer) {
        return deps.stateError("No question/answer pair found to evaluate.");
      }

      let result: { score: number; feedback: string; needsFollowUp: boolean; followUpQuestion?: string | null; deeperDive?: string };

      if (deps.ai) {
        const entry = deps.knowledge.findByTopic(session.topic);
        const criteria = entry?.evaluationCriteria[session.currentQuestionIndex];
        result = await deps.ai.evaluateAnswer(lastQuestion.content, lastAnswer.content, criteria);
      } else {
        if (score === undefined || feedback === undefined || needsFollowUp === undefined) {
          return deps.stateError(
            "AI is disabled (AI_ENABLED=false). Provide score, feedback, and needsFollowUp. " +
            "Evaluate the answer against the evaluationCriteria returned by ask_question."
          );
        }
        result = { score, feedback, needsFollowUp, followUpQuestion };
      }

      const evaluation: Evaluation = {
        questionIndex: session.currentQuestionIndex,
        question: lastQuestion.content,
        answer: lastAnswer.content,
        score: result.score,
        feedback: result.feedback,
        needsFollowUp: result.needsFollowUp,
        followUpQuestion: result.followUpQuestion ?? undefined,
        deeperDive: result.deeperDive,
      };

      session.evaluations.push(evaluation);
      session.state = "FOLLOW_UP";
      deps.saveSessions(sessions);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            state: session.state,
            score: result.score,
            feedback: result.feedback,
            needsFollowUp: result.needsFollowUp,
            followUpQuestion: result.followUpQuestion ?? null,
            nextTool: result.needsFollowUp
              ? "ask_followup  (or next_question to skip follow-up)"
              : "next_question",
          }),
        }],
      };
    }
  );
}
