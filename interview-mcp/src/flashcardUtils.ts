import type { Session, Evaluation, Flashcard, FlashcardDifficulty } from "@mock-interview/shared";

// ─────────────────────────────────────────────
// Flashcard generation
// ─────────────────────────────────────────────

const FLASHCARD_SCORE_THRESHOLD = 4;

function mapScoreToDifficulty(score: number): FlashcardDifficulty {
  if (score <= 2) return "hard";
  if (score === 3) return "medium";
  return "easy";
}

/** Extract simple tags from a topic string: "JWT authentication" → ["jwt", "authentication"] */
function topicToTags(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

const CODE_EXERCISE_KEYWORDS = [
  "algorithm",
  "array",
  "binary",
  "code",
  "data structure",
  "dynamic programming",
  "graph",
  "heap",
  "implement",
  "index",
  "linked list",
  "matrix",
  "pointer",
  "queue",
  "recursion",
  "ring",
  "rotate",
  "rotation",
  "stack",
  "string",
  "traversal",
  "tree",
  "two pointer",
];

function containsCodeExerciseKeyword(text: string | undefined): boolean {
  if (!text?.trim()) return false;
  const normalized = text.toLowerCase();
  return CODE_EXERCISE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isCodeExerciseFlashcard(session: Session, evaluation: Evaluation): boolean {
  if (session.sourcePath?.includes("/knowledge/exercises/")) return true;

  return [
    session.topic,
    session.focusArea,
    session.customContent,
    evaluation.question,
    evaluation.answer,
    evaluation.feedback,
    evaluation.strongAnswer,
    evaluation.deeperDive,
  ].some((value) => containsCodeExerciseKeyword(value));
}

function buildMatrixLayerCodeExample(): string {
  return [
    "type LayerBounds = { first: number; last: number; shouldProcess: boolean };",
    "",
    "function getLayerBounds(n: number, k: number): LayerBounds {",
    "  const first = k;",
    "  const last = n - 1 - k;",
    "",
    "  return {",
    "    first,",
    "    last,",
    "    // Invariant: a ring only exists when first < last.",
    "    shouldProcess: k < Math.floor(n / 2) && first < last,",
    "  };",
    "}",
    "",
    "for (let k = 0; k < Math.floor(matrix.length / 2); k += 1) {",
    "  const { first, last, shouldProcess } = getLayerBounds(matrix.length, k);",
    "  if (!shouldProcess) break;",
    "",
    "  // Process the current ring [first..last].",
    "}",
    "",
    "// Odd-sized matrices leave the center cell untouched.",
  ].join("\n");
}

function buildGenericCodeExample(): string {
  return [
    "function solve(input: unknown) {",
    "  // 1. Establish the bounds or base case up front.",
    "  // 2. Keep the core invariant true on every iteration.",
    "  // 3. Handle edge cases before mutating state.",
    "  return input;",
    "}",
  ].join("\n");
}

function buildCodeExample(session: Session, evaluation: Evaluation): string {
  const combined = [
    session.topic,
    session.focusArea,
    evaluation.question,
    evaluation.feedback,
  ].join(" ").toLowerCase();

  if (
    combined.includes("matrix") &&
    (combined.includes("layer") || combined.includes("ring") || combined.includes("index"))
  ) {
    return buildMatrixLayerCodeExample();
  }

  return buildGenericCodeExample();
}

function buildCodeExerciseFront(session: Session, evaluation: Evaluation): string {
  const combined = [session.topic, evaluation.question].join(" ").toLowerCase();

  if (
    combined.includes("matrix") &&
    (combined.includes("layer") || combined.includes("ring") || combined.includes("index"))
  ) {
    return "In TypeScript, write a helper for an n x n matrix layer k that computes `first` and `last`, stops at the right time, and makes the ring invariant explicit in code comments.";
  }

  return `Turn this weak spot into code: ${evaluation.question}`;
}

type FlashcardRouteStep = {
  anchor: string;
  detail: string;
};

export type FlashcardDraftInput = {
  front?: string;
  back?: string;
  prompt?: string;
  cardStyle?: "basic" | "open" | "multiple_choice";
  anchors?: string[];
  route?: FlashcardRouteStep[];
  learnerAnswer?: string;
  feedback?: string;
  strongerAnswer?: string;
  correctAnswer?: string;
  studyNotes?: string;
  topic: string;
  difficulty: FlashcardDifficulty;
  tags: string[];
  sourceSessionId?: string;
  sourceQuestionIndex?: number;
  sourceOriginalScore?: number;
};

function splitIntoStudyLines(text: string | undefined): string[] {
  if (!text?.trim()) return [];

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) return [bullet[1]!.trim()];
      return line.split(/(?<=[.?!])\s+/).map((part) => part.trim()).filter(Boolean);
    });
}

function cleanOptionPrefix(text: string): string {
  return text.replace(/^[A-Z]\)\s*/, "").trim();
}

function extractCorrectOptionSteps(feedback: string): FlashcardRouteStep[] {
  const matches = Array.from(feedback.matchAll(/([A-Z])\)\s+([^\n]+)/g));

  return matches.map((match) => {
    const detail = cleanOptionPrefix(match[0] ?? "");
    return {
      anchor: inferAnchor(detail),
      detail,
    };
  });
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length >= 3)
    .filter((word) => ![
      "that", "this", "with", "from", "into", "your", "have", "help", "helps", "across",
      "where", "what", "when", "which", "about", "single", "correct", "answer", "statements",
      "would", "could", "should", "their", "there", "them", "they", "because", "using",
      "used", "than", "then", "also", "only", "over", "under", "after", "before", "through",
      "during", "whether", "requires", "knowing", "issue", "failure", "originated",
    ].includes(word));
}

function isLowSignalStudyLine(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return true;

  return [
    "good answer.",
    "good answer",
    "solid answer.",
    "solid answer",
    "great answer.",
    "great answer",
    "correct.",
    "correct",
    "needs work.",
    "needs work",
    "too broad.",
    "too broad",
    "partial.",
    "partial",
  ].includes(normalized);
}

function inferAnchor(text: string): string {
  const normalized = text.toLowerCase();

  if (/(trace|request).*(id|correlat)|correlat.*(trace|request)/.test(normalized)) {
    return "correlate request";
  }
  if (/metric|latency|error rate|dependency/.test(normalized)) {
    return "dependency metrics";
  }
  if (/app|database|db|api|layer|fault domain/.test(normalized)) {
    return "isolate layer";
  }
  if (/log/.test(normalized)) {
    return "logs";
  }
  if (/trace/.test(normalized)) {
    return "traces";
  }
  if (/trade.?off|consisten|stale/.test(normalized)) {
    return "tradeoff";
  }
  if (/cache|invalidate|expiry|ttl/.test(normalized)) {
    return "invalidation";
  }
  if (/index|scan|lookup|query/.test(normalized)) {
    return "query path";
  }

  const keywords = extractKeywords(text).slice(0, 3);
  if (keywords.length === 0) return "key idea";
  return keywords.join(" ");
}

function buildRouteSteps(evaluation: Evaluation): FlashcardRouteStep[] {
  const mcqSteps = extractCorrectOptionSteps(evaluation.feedback);
  if (mcqSteps.length > 0) return mcqSteps.slice(0, 3);

  const sourceLines = [
    ...splitIntoStudyLines(evaluation.strongAnswer),
    ...splitIntoStudyLines(evaluation.deeperDive),
    ...splitIntoStudyLines(evaluation.feedback),
  ];

  const seen = new Set<string>();
  const steps: FlashcardRouteStep[] = [];

  for (const line of sourceLines) {
    const detail = line.replace(/\s+/g, " ").trim();
    if (!detail || isLowSignalStudyLine(detail)) continue;

    const anchor = inferAnchor(detail);
    const key = `${anchor}::${detail.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push({ anchor, detail });
    if (steps.length === 3) break;
  }

  return steps;
}

function buildFlashcardFront(question: string, routeSteps: FlashcardRouteStep[]): string {
  const lines = [question.trim()];

  if (routeSteps.length > 0) {
    lines.push("", "Anchors:");
    for (const step of routeSteps) {
      lines.push(`- ${step.anchor}`);
    }
  }

  return lines.join("\n");
}

function extractCorrectAnswerLabel(feedback: string): string | undefined {
  const options = Array.from(feedback.matchAll(/([A-Z])\)\s+/g)).map((match) => match[1]);
  if (options.length > 0) return options.join(", ");

  const inline = feedback.match(/correct answer is\s+([A-Z](?:,\s*[A-Z])*(?:\s*(?:and|&)\s*[A-Z])?)/i);
  if (inline?.[1]) {
    return inline[1]
      .replace(/\band\b/gi, ",")
      .replace(/\s*&\s*/g, ",")
      .replace(/\s+/g, "")
      .replace(/,+/g, ", ")
      .trim();
  }

  return undefined;
}

function dedupeWeakFlashcardEvaluations(session: Session): Evaluation[] {
  const weakByIndex = new Map<number, Evaluation>();
  for (const evaluation of session.evaluations) {
    if (evaluation.score >= FLASHCARD_SCORE_THRESHOLD) continue;
    const existing = weakByIndex.get(evaluation.questionIndex);
    if (!existing || evaluation.score < existing.score) {
      weakByIndex.set(evaluation.questionIndex, evaluation);
    }
  }

  return Array.from(weakByIndex.values());
}

/**
 * Builds the back-of-card content from evaluation fields available after an
 * interview ends. Works in both AI and file-only mode — no external calls needed.
 */
function buildFlashcardBack(session: Session, e: Evaluation): string {
  if (isCodeExerciseFlashcard(session, e)) {
    const lines: string[] = [];

    lines.push(`## Code example`, ``, "```ts", buildCodeExample(session, e), "```", ``);
    lines.push(`## Why this version is safer`, ``, `- ${e.feedback}`, ``);

    if (e.deeperDive?.trim()) {
      lines.push(`## Where to go deeper`, ``, e.deeperDive.trim(), ``);
    }

    lines.push(`## Original weak answer`, ``, `> ${e.answer.replace(/\n/g, "\n> ")}`, ``);

    return lines.join("\n");
  }

  const lines: string[] = [];
  const routeSteps = buildRouteSteps(e);
  const correctAnswer = extractCorrectAnswerLabel(e.feedback);

  lines.push(`## Your answer`, ``, `> ${e.answer.replace(/\n/g, "\n> ")}`, ``);
  lines.push(`## Feedback`, ``, e.feedback, ``);

  if (e.strongAnswer?.trim()) {
    lines.push(`## Stronger answer`, ``, e.strongAnswer.trim(), ``);
  }

  if (correctAnswer) {
    lines.push(`## Correct`, ``, correctAnswer, ``);
  }

  if (routeSteps.length > 0) {
    lines.push(`## Route`, ``);
    for (const step of routeSteps) {
      lines.push(`- ${step.anchor} -> ${step.detail}`);
    }
    lines.push(``);
  }

  if (e.deeperDive?.trim()) {
    lines.push(`## Where to go deeper`, ``, e.deeperDive.trim(), ``);
  }

  return lines.join("\n");
}

function buildFlashcardDraft(session: Session, evaluation: Evaluation): FlashcardDraftInput {
  const routeSteps = buildRouteSteps(evaluation);
  const correctAnswer = extractCorrectAnswerLabel(evaluation.feedback);
  const common = {
    topic: session.topic,
    difficulty: mapScoreToDifficulty(evaluation.score),
    tags: topicToTags(session.topic),
    sourceSessionId: session.id,
    sourceQuestionIndex: evaluation.questionIndex,
    sourceOriginalScore: evaluation.score,
  } satisfies Omit<FlashcardDraftInput, "front" | "back" | "prompt" | "cardStyle" | "anchors" | "route" | "learnerAnswer" | "feedback" | "strongerAnswer" | "correctAnswer" | "studyNotes">;

  if (isCodeExerciseFlashcard(session, evaluation)) {
    return {
      ...common,
      front: buildCodeExerciseFront(session, evaluation),
      back: buildFlashcardBack(session, evaluation),
      cardStyle: "basic",
    };
  }

  return {
    ...common,
    prompt: evaluation.question,
    cardStyle: correctAnswer ? "multiple_choice" : "open",
    anchors: routeSteps.map((step) => step.anchor),
    route: routeSteps,
    learnerAnswer: evaluation.answer,
    feedback: evaluation.feedback,
    strongerAnswer: evaluation.strongAnswer,
    correctAnswer,
    studyNotes: evaluation.deeperDive,
  };
}

export function buildFlashcardDrafts(session: Session): FlashcardDraftInput[] {
  if (session.sessionKind === "warmup" && (session.questLevel === 0 || session.questLevel === 1)) {
    return [];
  }

  return dedupeWeakFlashcardEvaluations(session).map((evaluation) => buildFlashcardDraft(session, evaluation));
}

/**
 * Generates flashcards for every unique question in the session that scored
 * below the threshold. When a question has a follow-up (same questionIndex),
 * we keep the evaluation with the lowest score so the card reflects the
 * weakest understanding.
 *
 * Returns an empty array if there are no weak evaluations.
 */
export function generateFlashcards(session: Session): Flashcard[] {
  const now = new Date().toISOString();
  return buildFlashcardDrafts(session).map((draft) => ({
    id: `fc-${draft.sourceSessionId ?? "manual"}-q${draft.sourceQuestionIndex ?? 0}`,
    front: draft.front ?? buildFlashcardFront(draft.prompt!, draft.route ?? []),
    back: draft.back ?? buildFlashcardBack(session, {
      questionIndex: draft.sourceQuestionIndex ?? 0,
      question: draft.prompt ?? draft.front ?? "",
      answer: draft.learnerAnswer ?? "",
      score: draft.sourceOriginalScore ?? 3,
      feedback: draft.feedback ?? "",
      strongAnswer: draft.strongerAnswer,
      needsFollowUp: false,
      deeperDive: draft.studyNotes,
    }),
    topic: draft.topic,
    tags: draft.tags,
    difficulty: draft.difficulty,
    source: draft.sourceSessionId != null && draft.sourceQuestionIndex != null && draft.sourceOriginalScore != null
      ? {
          sessionId: draft.sourceSessionId,
          questionIndex: draft.sourceQuestionIndex,
          originalScore: draft.sourceOriginalScore,
        }
      : undefined,
    createdAt: now,
    dueDate: now,
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
  }));
}
