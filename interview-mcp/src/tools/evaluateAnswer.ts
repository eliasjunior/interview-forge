import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Evaluation } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";
import { buildStrongAnswer } from "../evaluation/strongAnswer.js";

export function registerEvaluateAnswerTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "evaluate_answer",
    {
      description: "Score the last answer (1–5) and decide if a follow-up is needed. Valid in state: EVALUATE_ANSWER. When AI is enabled call with sessionId only. When AI is disabled also provide score, feedback, and needsFollowUp.",
      inputSchema: {
        sessionId: z.string(),
        score: z.number().int().min(1).max(5).optional()
          .describe("Score 1–5 (required when AI is disabled)"),
        feedback: z.string().optional()
          .describe("Detailed feedback (required when AI is disabled)"),
        needsFollowUp: z.boolean().optional()
          .describe("Whether a follow-up question would help (required when AI is disabled)"),
        followUpQuestion: z.string().optional()
          .describe("The follow-up question to ask (provide when needsFollowUp is true)"),
        strongAnswer: z.string().optional()
          .describe("A concise corrected or stronger answer (optional when AI is disabled)"),
      },
    },
    async ({ sessionId, score, feedback, needsFollowUp, followUpQuestion, strongAnswer }) => {
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

      let result: { score: number; feedback: string; strongAnswer?: string; needsFollowUp: boolean; followUpQuestion?: string | null; deeperDive?: string };

      if (deps.ai) {
        const entry = deps.knowledge.findByTopic(session.topic);
        const knowledgeCriteria = entry?.evaluationCriteria[session.currentQuestionIndex];

        // For scoped sessions (started via start_scoped_interview), use the project spec
        // and focus angle as rubric context so the AI evaluates against the original content.
        const scopedContext = session.customContent
          ? `Project specification (used as evaluation rubric):\n${session.customContent}` +
            (session.focusArea ? `\n\nInterview focus: ${session.focusArea}` : "")
          : undefined;

        const context = knowledgeCriteria ?? scopedContext;
        result = await deps.ai.evaluateAnswer(lastQuestion.content, lastAnswer.content, context);
      } else {
        if (score === undefined || feedback === undefined || needsFollowUp === undefined) {
          return deps.stateError(
            "AI is disabled (AI_ENABLED=false). Provide score, feedback, and needsFollowUp. " +
            "Evaluate the answer against the evaluationCriteria returned by ask_question."
          );
        }
        result = { score, feedback, strongAnswer, needsFollowUp, followUpQuestion };
      }

      const resolvedStrongAnswer = buildStrongAnswer({
        criteria: deps.knowledge.findByTopic(session.topic)?.evaluationCriteria[session.currentQuestionIndex],
        feedback: result.feedback,
        answer: result.strongAnswer ?? lastAnswer.content,
      });

      const evaluation: Evaluation = {
        questionIndex: session.currentQuestionIndex,
        question: lastQuestion.content,
        answer: lastAnswer.content,
        strongAnswer: resolvedStrongAnswer,
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
            strongAnswer: resolvedStrongAnswer ?? null,
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
