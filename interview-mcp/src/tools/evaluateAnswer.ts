import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AnswerMode, Evaluation, FollowUpType, Session } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";
import { buildStrongAnswer } from "../evaluation/strongAnswer.js";

const CODE_COMPLEXITY_FOLLOW_UP =
  "Before we wrap, quantify your solution: what are the time and space complexities, and why do those bounds hold?";
const DEFAULT_ANSWER_MODE: AnswerMode = "deep_dive";

function getAnswerModeGuidance(answerMode: AnswerMode): string {
  if (answerMode === "brief") {
    return "Candidate chose brief mode: judge them on concise correctness and one solid trade-off, not essay length.";
  }
  if (answerMode === "bullets") {
    return "Candidate chose bullets mode: judge them on structured coverage and clear key points, not paragraph flow.";
  }
  return "Candidate chose deep_dive mode: expect fuller depth, trade-offs, examples, and edge cases.";
}

function getCandidateDeliveryGuidance(answerMode: AnswerMode, hasFollowUp: boolean): string {
  if (answerMode === "brief") {
    return hasFollowUp
      ? "Respond to the candidate in 2-3 tight sentences: name the main mistake, give the corrected concept, then ask one focused follow-up."
      : "Respond to the candidate in 1-2 tight sentences: name the main mistake or success and the corrected concept.";
  }
  if (answerMode === "bullets") {
    return hasFollowUp
      ? "Respond with 2-4 compact bullets, then ask one focused follow-up."
      : "Respond with 2-4 compact bullets. Keep the correction structured and brief.";
  }
  return hasFollowUp
    ? "A fuller explanation is acceptable here, but keep it focused before asking one follow-up."
    : "A fuller explanation is acceptable here, but keep it focused on the highest-value correction.";
}

function getTimingGuidance(
  answerElapsedSec: number | undefined,
  responseTimeLimitSec: number | undefined,
): string | undefined {
  if (answerElapsedSec == null && responseTimeLimitSec == null) return undefined;

  if (answerElapsedSec == null) {
    return `Suggested time limit: ${responseTimeLimitSec} seconds. Use this as soft pressure context only; do not penalize timing by itself.`;
  }

  if (responseTimeLimitSec == null) {
    return `Candidate took about ${answerElapsedSec} seconds to answer. Use this as soft pressure context only; do not score timing directly.`;
  }

  const timingStatus =
    answerElapsedSec <= responseTimeLimitSec
      ? `Candidate answered in about ${answerElapsedSec} seconds, within the suggested ${responseTimeLimitSec}-second window.`
      : `Candidate answered in about ${answerElapsedSec} seconds, over the suggested ${responseTimeLimitSec}-second window.`;

  return `${timingStatus} Use this as soft pressure context only; evaluate answer quality first and mention timing only if it adds useful coaching context.`;
}

function normalizeLower(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function buildFollowUpMetadata(
  session: Session,
  question: string,
  answer: string,
  feedback: string,
  followUpQuestion?: string,
): Pick<Evaluation, "followUpType" | "followUpFocus" | "followUpRationale"> {
  const followUp = normalizeLower(followUpQuestion);
  const answerText = normalizeLower(answer);
  const feedbackText = normalizeLower(feedback);
  const questionText = normalizeLower(question);

  if (isComplexityFollowUpQuestion(followUpQuestion ?? "")) {
    return {
      followUpType: "code_complexity",
      followUpFocus: "time and space complexity",
      followUpRationale: "The candidate submitted code without quantifying complexity bounds.",
    };
  }

  if (session.interviewType === "code" && followUpQuestion?.trim()) {
    return {
      followUpType: "problem_aware",
      followUpFocus: session.problemTitle?.trim() || session.topic,
      followUpRationale: "The candidate finished the main solution, so the loop is using one focused problem-aware follow-up instead of another scripted question.",
    };
  }

  if (
    /trade-?off|why|choose|prefer|versus|vs\b|cost/.test(followUp) ||
    /trade-?off|too generic|didn'?t justify|did not justify/.test(feedbackText)
  ) {
    return {
      followUpType: "vague_tradeoff",
      followUpFocus: "the main trade-off and why this design is preferable",
      followUpRationale: "The answer named an approach but did not make the decision boundary or trade-off explicit enough.",
    };
  }

  if (
    /example|scenario|concrete|real[- ]world|walk me through/.test(followUp) ||
    (/example|scenario/.test(feedbackText) && !/example|scenario/.test(answerText))
  ) {
    return {
      followUpType: "no_example",
      followUpFocus: "one concrete example or scenario",
      followUpRationale: "The answer stayed abstract and needs one specific example to prove understanding.",
    };
  }

  if (
    /failure|edge case|under load|timeout|retry|fallback|resilien|incident|outage|stale/.test(followUp) ||
    /edge case|failure mode|resilien|under load/.test(questionText) ||
    /edge case|failure mode|resilien|under load/.test(feedbackText)
  ) {
    return {
      followUpType: "shallow_failure_mode",
      followUpFocus: "the main failure mode or edge case",
      followUpRationale: "The answer needs deeper reasoning about what breaks under pressure and how the design responds.",
    };
  }

  if (followUpQuestion?.trim()) {
    return {
      followUpType: "missing_concept",
      followUpFocus: "the missing core concept from the previous answer",
      followUpRationale: "The answer was directionally correct but left out a key concept that the follow-up should isolate.",
    };
  }

  return {
    followUpType: "generic",
    followUpFocus: undefined,
    followUpRationale: undefined,
  };
}

function buildAdaptiveChallenge(
  evaluation: Pick<Evaluation, "score" | "needsFollowUp" | "followUpFocus" | "followUpType" | "followUpQuestion">,
): Pick<Evaluation, "adaptiveChallengeType" | "adaptiveChallengePrompt" | "adaptiveChallengeGoal" | "adaptiveChallengeReward"> {
  if (!evaluation.needsFollowUp || evaluation.score > 3 || !evaluation.followUpQuestion) {
    return {
      adaptiveChallengeType: undefined,
      adaptiveChallengePrompt: undefined,
      adaptiveChallengeGoal: undefined,
      adaptiveChallengeReward: undefined,
    };
  }

  const goal = evaluation.followUpFocus ?? "the missing key point from the previous answer";
  const reward =
    evaluation.score <= 2
      ? "Recovery round: win back the point by correcting the core mistake."
      : "Recovery round: tighten the answer and lock in the missing detail.";

  return {
    adaptiveChallengeType: "recovery_round",
    adaptiveChallengePrompt:
      evaluation.followUpType === "no_example"
        ? `Recovery round: answer again, but this time anchor it with one concrete example.`
        : evaluation.followUpType === "vague_tradeoff"
        ? `Recovery round: tighten the answer by naming the trade-off explicitly and defending your choice.`
        : evaluation.followUpType === "shallow_failure_mode"
        ? `Recovery round: tighten the answer by focusing on what breaks first and how you respond.`
        : `Recovery round: improve the answer by fixing one gap only: ${goal}.`,
    adaptiveChallengeGoal: goal,
    adaptiveChallengeReward: reward,
  };
}

function buildFallbackRecoveryFollowUp(
  question: string,
  answerMode: AnswerMode,
): string {
  const brevityHint =
    answerMode === "brief"
      ? "Keep it to 2-3 tight sentences."
      : answerMode === "bullets"
      ? "Keep it to 3-5 bullets."
      : "Keep it focused on one missing gap.";

  return `Recovery round: answer again and fix the main missing point in "${question}". ${brevityHint}`;
}

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

function isComplexityFollowUpQuestion(question: string): boolean {
  return question.startsWith("Before we wrap, quantify your solution:");
}

function extractBulletSection(content: string | undefined, heading: string): string[] {
  if (!content) return [];

  const lines = content.split("\n");
  const headingIndex = lines.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase());
  if (headingIndex === -1) return [];

  const bullets: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index++) {
    const line = lines[index]?.trim() ?? "";
    if (line.startsWith("## ")) break;
    if (line.startsWith("- ")) bullets.push(line.slice(2).trim());
  }

  return bullets;
}

function hasOptionalCodeFollowUpAlready(session: { questions: string[]; evaluations: Evaluation[] }): boolean {
  const finalIndex = session.questions.length - 1;
  const finalQuestion = session.questions[finalIndex];

  return session.evaluations.some((evaluation) =>
    evaluation.questionIndex === finalIndex &&
    evaluation.question !== finalQuestion &&
    !isComplexityFollowUpQuestion(evaluation.question)
  );
}

function isGenericCodeFollowUp(question: string): boolean {
  return /optimi[sz]e it further|anything else you would improve|any improvements/i.test(question);
}

function buildProblemAwareFollowUp(
  session: { customContent?: string; topic: string; problemTitle?: string },
  suggested?: string | null,
): string | undefined {
  const candidates = extractBulletSection(session.customContent, "## Common Interview Follow-Ups (interviewer only)");
  if (suggested?.trim() && !isGenericCodeFollowUp(suggested)) return suggested.trim();
  if (candidates.length > 0) return candidates[0];
  if (suggested?.trim()) return suggested.trim();

  const label = session.problemTitle?.trim() || session.topic;
  return `What would you optimize or simplify next in ${label}, and what trade-off would that change?`;
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
      const answerMode = session.pendingAnswerMode ?? DEFAULT_ANSWER_MODE;
      const answerElapsedSec = session.pendingAnswerElapsedSec;
      const responseTimeLimitSec = session.pendingResponseTimeLimitSec;
      const existingAdaptiveChallenge = session.activeAdaptiveChallenge;
      const resolvingAdaptiveChallenge =
        existingAdaptiveChallenge != null &&
        existingAdaptiveChallenge.sourceQuestionIndex === session.currentQuestionIndex;

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

        const contextBase = knowledgeCriteria ?? scopedContext;
        const timingGuidance = getTimingGuidance(answerElapsedSec, responseTimeLimitSec);
        const contextParts = [
          contextBase,
          `Answer mode guidance:\n${getAnswerModeGuidance(answerMode)}`,
          timingGuidance ? `Timing context:\n${timingGuidance}` : undefined,
        ].filter((value): value is string => Boolean(value));
        const context = contextParts.join("\n\n");
        result = await deps.ai.evaluateAnswer(lastQuestion.content, lastAnswer.content, context, answerMode);
      } else {
        if (score === undefined || feedback === undefined || needsFollowUp === undefined) {
          return deps.stateError(
            "AI is disabled (AI_ENABLED=false). Provide score, feedback, and needsFollowUp. " +
            "Evaluate the answer against the evaluationCriteria returned by ask_question and the answer mode guidance."
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
        answerMode,
        answerElapsedSec,
        responseTimeLimitSec,
        strongAnswer: resolvedStrongAnswer,
        score: result.score,
        feedback: result.feedback,
        needsFollowUp: result.needsFollowUp,
        followUpQuestion: result.followUpQuestion ?? undefined,
        deeperDive: result.deeperDive,
      };

      if (evaluation.score <= 3 && session.sessionKind !== "warmup") {
        evaluation.needsFollowUp = true;
        evaluation.followUpQuestion =
          evaluation.followUpQuestion ??
          buildFallbackRecoveryFollowUp(lastQuestion.content, answerMode);
      }

      let earlyCompletionDetected = false;
      if (session.interviewType === "code" && looksLikeCodeSubmission(lastAnswer.content)) {
        const solvedWithComplexity = mentionsComplexity(lastAnswer.content);
        const optionalFollowUpAlreadyUsed = hasOptionalCodeFollowUpAlready(session);

        if (session.currentQuestionIndex < session.questions.length - 1) {
          session.currentQuestionIndex = session.questions.length - 1;
        }

        if (!solvedWithComplexity) {
          evaluation.needsFollowUp = true;
          evaluation.followUpQuestion = CODE_COMPLEXITY_FOLLOW_UP;
        } else if (!optionalFollowUpAlreadyUsed) {
          const problemAwareFollowUp = buildProblemAwareFollowUp(session, result.followUpQuestion);
          evaluation.needsFollowUp = Boolean(result.needsFollowUp && problemAwareFollowUp);
          evaluation.followUpQuestion = evaluation.needsFollowUp ? problemAwareFollowUp : undefined;
          earlyCompletionDetected = !evaluation.needsFollowUp;
        } else {
          evaluation.needsFollowUp = false;
          evaluation.followUpQuestion = undefined;
          earlyCompletionDetected = true;
        }
      } else if (
        session.interviewType === "code" &&
        isComplexityFollowUpQuestion(lastQuestion.content)
      ) {
        const optionalFollowUpAlreadyUsed = hasOptionalCodeFollowUpAlready(session);
        if (!optionalFollowUpAlreadyUsed) {
          const problemAwareFollowUp = buildProblemAwareFollowUp(session, result.followUpQuestion);
          evaluation.needsFollowUp = Boolean(result.needsFollowUp && problemAwareFollowUp);
          evaluation.followUpQuestion = evaluation.needsFollowUp ? problemAwareFollowUp : undefined;
          earlyCompletionDetected = !evaluation.needsFollowUp;
        } else {
          evaluation.needsFollowUp = false;
          evaluation.followUpQuestion = undefined;
          earlyCompletionDetected = true;
        }
      }

      if (evaluation.needsFollowUp && evaluation.followUpQuestion) {
        Object.assign(
          evaluation,
          buildFollowUpMetadata(
            session,
            lastQuestion.content,
            lastAnswer.content,
            result.feedback,
            evaluation.followUpQuestion,
          ),
        );
      }
      Object.assign(evaluation, buildAdaptiveChallenge(evaluation));

      if (resolvingAdaptiveChallenge) {
        evaluation.needsFollowUp = false;
        evaluation.followUpQuestion = undefined;
        evaluation.followUpType = undefined;
        evaluation.followUpFocus = undefined;
        evaluation.followUpRationale = undefined;
        evaluation.adaptiveChallengeType = undefined;
        evaluation.adaptiveChallengePrompt = undefined;
        evaluation.adaptiveChallengeGoal = undefined;
        evaluation.adaptiveChallengeReward = undefined;
        session.activeAdaptiveChallenge = undefined;
      } else if (evaluation.adaptiveChallengeType && evaluation.adaptiveChallengePrompt) {
        session.activeAdaptiveChallenge = {
          type: evaluation.adaptiveChallengeType,
          status: "pending",
          sourceQuestionIndex: session.currentQuestionIndex,
          prompt: evaluation.adaptiveChallengePrompt,
          goal: evaluation.adaptiveChallengeGoal,
          reward: evaluation.adaptiveChallengeReward,
        };
      } else {
        session.activeAdaptiveChallenge = undefined;
      }

      session.evaluations.push(evaluation);
      session.pendingAnswerMode = undefined;
      session.pendingResponseTimeLimitSec = undefined;
      session.pendingResponseStartedAt = undefined;
      session.pendingAnswerElapsedSec = undefined;
      if (earlyCompletionDetected && session.interviewType === "code") {
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
            answerMode,
            answerElapsedSec: evaluation.answerElapsedSec ?? null,
            responseTimeLimitSec: evaluation.responseTimeLimitSec ?? null,
            score: result.score,
            feedback: result.feedback,
            strongAnswer: resolvedStrongAnswer ?? null,
            needsFollowUp: evaluation.needsFollowUp,
            followUpQuestion: evaluation.followUpQuestion ?? null,
            followUpType: evaluation.followUpType ?? null,
            followUpFocus: evaluation.followUpFocus ?? null,
            followUpRationale: evaluation.followUpRationale ?? null,
            adaptiveChallengeType: evaluation.adaptiveChallengeType ?? null,
            adaptiveChallengePrompt: evaluation.adaptiveChallengePrompt ?? null,
            adaptiveChallengeGoal: evaluation.adaptiveChallengeGoal ?? null,
            adaptiveChallengeReward: evaluation.adaptiveChallengeReward ?? null,
            activeAdaptiveChallenge: session.activeAdaptiveChallenge ?? null,
            candidateDeliveryGuidance: getCandidateDeliveryGuidance(answerMode, evaluation.needsFollowUp),
            earlyCompletionDetected,
            nextTool: earlyCompletionDetected
              ? "end_interview"
              : session.activeAdaptiveChallenge
              ? "ask_followup"
              : evaluation.needsFollowUp
              ? "ask_followup  (or next_question to skip follow-up)"
              : "next_question",
            instruction: earlyCompletionDetected
              ? "Code interview complete. Do not ask more questions; finish the interview now."
              : session.activeAdaptiveChallenge
              ? "A recovery round is active. Do not advance to the next question yet; run ask_followup and let the candidate try to fix the gap."
              : undefined,
          }),
        }],
      };
    }
  );
}
