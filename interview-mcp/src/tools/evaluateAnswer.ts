import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Evaluation } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";
import { buildStrongAnswer } from "../evaluation/strongAnswer.js";

function parseMcqAnswer(answer: string, choiceCount: number): string[] {
  const normalised = answer.trim().toUpperCase();
  if (!normalised) return [];

  if (normalised === "ALL") {
    return Array.from({ length: choiceCount }, (_, index) => String.fromCharCode(65 + index));
  }

  if (normalised === "NONE") {
    return ["NONE"];
  }

  return Array.from(
    new Set(
      normalised
        .split(/[,\s]+/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  ).sort();
}

function formatMcqAnswer(answer: string[], choices: string[]): string {
  if (answer.length === 1 && answer[0] === "NONE") return "NONE";

  return answer
    .map((letter) => {
      const index = letter.charCodeAt(0) - 65;
      const choiceText = choices[index];
      return choiceText ? `${letter}) ${choiceText}` : letter;
    })
    .join(", ");
}

function looksLikeCodeSubmission(answer: string): boolean {
  return (
    /```[\s\S]*```/.test(answer) ||
    /\b(class|function|def|public|private|static|const|let|var)\b/.test(answer) ||
    /\breturn\b/.test(answer) ||
    /=>/.test(answer) ||
    /\bfor\s*\(|\bwhile\s*\(|\bif\s*\(/.test(answer)
  );
}

function mentionsComplexity(answer: string): boolean {
  return /\btime complexity\b|\bspace complexity\b|\bbig[- ]?o\b|O\([^)]+\)/i.test(answer);
}

function shouldFinishCodeInterviewEarly(session: { interviewType?: string; currentQuestionIndex: number; questions: string[] }, answer: string): boolean {
  if (session.interviewType !== "code") return false;
  if (session.currentQuestionIndex >= session.questions.length - 1) return false;
  return looksLikeCodeSubmission(answer) && mentionsComplexity(answer);
}

export function registerEvaluateAnswerTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "evaluate_answer",
    {
      description: "Score the last answer (1–5) and decide if a follow-up is needed. Valid in state: EVALUATE_ANSWER. When AI is enabled call with sessionId only. When AI is disabled also provide score, feedback, and needsFollowUp.",
      inputSchema: {
        sessionId: z.string(),
        score: z.union([z.number(), z.string()])
          .transform(v => Number(v))
          .pipe(z.number().int().min(1).max(5))
          .optional()
          .describe("Score 1–5 (required when AI is disabled)"),
        feedback: z.string().optional()
          .describe("Detailed feedback (required when AI is disabled)"),
        needsFollowUp: z.union([z.boolean(), z.string()])
          .transform(v => v === "true" ? true : v === "false" ? false : v)
          .pipe(z.boolean())
          .optional()
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

      // ── Warm-up auto-evaluation (L0/L1 MCQ, legacy L1 fill-in-blank) ───────
      // For these formats the correct answer is stored on the session.
      // No AI or orchestrator scoring is needed — evaluate automatically.
      const warmupAnswer = session.questAnswers?.[session.currentQuestionIndex];
      if (
        session.sessionKind === "warmup" &&
        (session.questFormat === "mcq" || session.questFormat === "fill_blank") &&
        warmupAnswer !== undefined
      ) {
        const expected = warmupAnswer.trim();
        let isCorrect: boolean;
        let feedback: string;

        if (session.questFormat === "mcq") {
          const choices = session.questChoices?.[session.currentQuestionIndex] ?? [];
          const expectedAnswers = parseMcqAnswer(expected, choices.length);
          const candidateAnswers = parseMcqAnswer(lastAnswer.content, choices.length);
          isCorrect =
            expectedAnswers.length === candidateAnswers.length &&
            expectedAnswers.every((value, index) => value === candidateAnswers[index]);

          const renderedCorrectAnswer = formatMcqAnswer(expectedAnswers, choices);
          feedback = isCorrect
            ? `Correct! ${renderedCorrectAnswer} ${expectedAnswers.length > 1 || expectedAnswers[0] === "NONE" ? "are" : "is"} right.`
            : `Not quite — the correct answer is ${renderedCorrectAnswer}.`;
        } else {
          // fill_blank: accept if the candidate's answer contains the expected key term
          isCorrect = lastAnswer.content.toLowerCase().includes(expected.toLowerCase());
          feedback = isCorrect
            ? `Correct! The expected answer is: "${expected}".`
            : `Not quite — the expected answer is: "${expected}".`;
        }

        result = { score: isCorrect ? 5 : 1, feedback, needsFollowUp: false };
      } else if (deps.ai) {
        const entry = deps.knowledge.findByTopic(session.topic);
        // Prefer pre-selected criteria stored on the session (safe after question shuffling).
        // Fall back to positional lookup for legacy sessions and AI-generated questions.
        const knowledgeCriteria =
          session.questionCriteria?.[session.currentQuestionIndex] ??
          entry?.evaluationCriteria[session.currentQuestionIndex];

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
        criteria:
          session.questionCriteria?.[session.currentQuestionIndex] ??
          deps.knowledge.findByTopic(session.topic)?.evaluationCriteria[session.currentQuestionIndex],
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

      const earlyCompletionDetected = shouldFinishCodeInterviewEarly(session, lastAnswer.content);
      if (earlyCompletionDetected) {
        evaluation.needsFollowUp = false;
        evaluation.followUpQuestion = undefined;
      }

      session.evaluations.push(evaluation);
      if (earlyCompletionDetected) {
        session.currentQuestionIndex = session.questions.length - 1;
      }
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
            needsFollowUp: earlyCompletionDetected ? false : result.needsFollowUp,
            followUpQuestion: earlyCompletionDetected ? null : result.followUpQuestion ?? null,
            earlyCompletionDetected,
            nextTool: earlyCompletionDetected
              ? "end_interview"
              : result.needsFollowUp
              ? "ask_followup  (or next_question to skip follow-up)"
              : "next_question",
            instruction: earlyCompletionDetected
              ? "Complete code submission with complexity analysis detected. Do not ask more questions; finish the interview now."
              : undefined,
          }),
        }],
      };
    }
  );
}
