export type {
  InterviewState,
  Message,
  Evaluation,
  Session,
  Concept,
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  Flashcard,
  FlashcardDifficulty,
  Mistake,
} from "@mock-interview/shared";
import type {
  InterviewState,
  Session,
  Evaluation,
  Concept,
  KnowledgeGraph,
  Flashcard,
  FlashcardDifficulty,
  Mistake,
} from "@mock-interview/shared";
import {
  canonicalizeConceptWord,
  deriveSemanticConceptEdges,
  filterGraphNodeConcepts,
  normalizeConcepts,
} from "./graph/concepts.js";

// ─────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────

export const VALID_TOOLS: Record<InterviewState, string[]> = {
  ASK_QUESTION:    ["ask_question",    "end_interview", "get_session", "list_sessions", "get_graph"],
  WAIT_FOR_ANSWER: ["submit_answer",   "end_interview", "get_session", "list_sessions", "get_graph"],
  EVALUATE_ANSWER: ["evaluate_answer", "end_interview", "get_session", "list_sessions", "get_graph"],
  FOLLOW_UP:       ["ask_followup", "next_question", "end_interview", "get_session", "list_sessions", "get_graph"],
  ENDED:           ["get_session", "list_sessions", "get_graph"],
};

export function assertState(
  session: Session,
  toolName: string
): { ok: true } | { ok: false; error: string } {
  const valid = VALID_TOOLS[session.state];
  if (!valid.includes(toolName)) {
    return {
      ok: false,
      error:
        `Tool '${toolName}' is not valid in state '${session.state}'. ` +
        `Valid tools right now: [${valid.join(", ")}]`,
    };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────
// Session utilities
// ─────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// findLast polyfill — Array.findLast is ES2023, our target is ES2022
export function findLast<T>(arr: T[], pred: (item: T) => boolean): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return arr[i];
  }
  return undefined;
}

export function calcAvgScore(evaluations: Evaluation[]): string {
  if (evaluations.length === 0) return "N/A";
  return (
    evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length
  ).toFixed(1);
}

export function buildTranscript(session: Session): string {
  return session.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

export function buildSummary(session: Session): string {
  const avg = calcAvgScore(session.evaluations);

  const lines = session.evaluations
    .map((e, i) => `  Q${i + 1} [${e.score}/5]: ${e.feedback}`)
    .join("\n");

  return (
    `## Interview Summary — ${session.topic}\n` +
    `Date: ${new Date(session.createdAt).toLocaleDateString()}\n` +
    `Questions: ${session.evaluations.length} | Avg score: ${avg}/5\n\n` +
    `### Question breakdown\n${lines || "  No evaluations recorded."}`
  );
}

export function buildReport(session: Session): string {
  const avg = calcAvgScore(session.evaluations);
  const date = new Date(session.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const scoreBar = (score: number) => "█".repeat(score) + "░".repeat(5 - score);

  // ── Header ────────────────────────────────────────────────────────────────
  const lines: string[] = [
    `# Interview Report — ${session.topic}`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Date** | ${date} |`,
    `| **Session ID** | \`${session.id}\` |`,
    `| **Questions answered** | ${session.evaluations.length} of ${session.questions.length} |`,
    `| **Average score** | ${avg} / 5 |`,
    ``,
    `---`,
    ``,
  ];

  // ── Question breakdown ────────────────────────────────────────────────────
  if (session.evaluations.length > 0) {
    lines.push(`## Question Breakdown`, ``);

    for (let i = 0; i < session.evaluations.length; i++) {
      const e = session.evaluations[i];
      lines.push(
        `### Q${i + 1} &nbsp; ${scoreBar(e.score)} &nbsp; ${e.score}/5`,
        ``,
        `**Question:** ${e.question}`,
        ``,
        `**Answer:** ${e.answer}`,
        ``,
        ...(e.strongAnswer?.trim()
          ? [`**Strong answer:** ${e.strongAnswer}`, ``]
          : []),
        `**Feedback:** ${e.feedback}`,
        ``,
      );

      if (e.deeperDive?.trim()) {
        lines.push(
          `#### 🔍 Where to go deeper`,
          ``,
          e.deeperDive.trim(),
          ``,
        );
      }

      lines.push(`---`, ``);
    }
  }

  // ── Overall summary ───────────────────────────────────────────────────────
  lines.push(
    `## Summary`,
    ``,
    buildSummary(session),
    ``,
  );

  // ── Concepts ──────────────────────────────────────────────────────────────
  if (session.concepts && session.concepts.length > 0) {
    const byCluster: Record<string, string[]> = {};
    for (const c of session.concepts) {
      if (!byCluster[c.cluster]) {
        byCluster[c.cluster] = [];
      }
      byCluster[c.cluster].push(c.word);
    }
    lines.push(`## Concepts Extracted`, ``);
    for (const [cluster, words] of Object.entries(byCluster)) {
      lines.push(`**${cluster}:** ${words.join(", ")}`);
    }
    lines.push(``);
  }

  // ── Full transcript ───────────────────────────────────────────────────────
  if (session.messages.length > 0) {
    lines.push(`---`, ``, `## Full Transcript`, ``);
    for (const m of session.messages) {
      const role = m.role === "interviewer" ? "🎙 **Interviewer**" : "🧑‍💻 **Candidate**";
      lines.push(`${role}`, ``, `> ${m.content.replace(/\n/g, "\n> ")}`, ``);
    }
  }

  return lines.join("\n");
}

const RECOMMENDATION_SCORE_THRESHOLD = 4;

export interface EndInterviewRecommendations {
  weakAreasDetected: boolean;
  recommendedActions: string[];
  drill: null | {
    available: boolean;
    tool: "start_drill";
    args: {
      topic: string;
      sessionId: string;
    };
    weakQuestionCount: number;
    reason: string;
  };
  deepExplanation: null | {
    available: boolean;
    mode: "deep_explanation";
    reason: string;
    focusAreas: Array<{
      question: string;
      score: number;
      gap: string;
      strongAnswer?: string;
    }>;
    mistakePatterns: Array<{
      mistake: string;
      pattern: string;
      fix: string;
    }>;
    prompt: string;
  };
}

function summarizeGap(feedback: string): string {
  const normalized = feedback.replace(/\s+/g, " ").trim();
  if (!normalized) return "Needs a deeper explanation of the underlying model and tradeoffs.";
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`;
}

function dedupeWeakEvaluations(session: Session): Evaluation[] {
  const weakByIndex = new Map<number, Evaluation>();
  for (const evaluation of session.evaluations) {
    if (evaluation.score >= RECOMMENDATION_SCORE_THRESHOLD) continue;
    const existing = weakByIndex.get(evaluation.questionIndex);
    if (!existing || evaluation.score < existing.score) {
      weakByIndex.set(evaluation.questionIndex, evaluation);
    }
  }
  return Array.from(weakByIndex.values()).sort((a, b) => a.score - b.score);
}

export function buildEndInterviewRecommendations(
  session: Session,
  mistakes: Mistake[],
): EndInterviewRecommendations {
  const weakEvaluations = dedupeWeakEvaluations(session);
  const focusAreas = weakEvaluations.slice(0, 3).map((evaluation) => ({
    question: evaluation.question,
    score: evaluation.score,
    gap: summarizeGap(evaluation.feedback),
    strongAnswer: evaluation.strongAnswer,
  }));
  const mistakePatterns = mistakes.slice(0, 3).map((mistake) => ({
    mistake: mistake.mistake,
    pattern: mistake.pattern,
    fix: mistake.fix,
  }));

  const recommendedActions: string[] = [];
  if (weakEvaluations.length > 0) recommendedActions.push("start_drill");
  if (focusAreas.length > 0 || mistakePatterns.length > 0) recommendedActions.push("deep_explanation");

  const deepExplanationPromptParts = [
    `Explain ${session.topic} in depth for interview preparation.`,
    "For each weak area, cover the mental model, why it matters, tradeoffs, common mistakes, and when to use it.",
  ];

  if (focusAreas.length > 0) {
    deepExplanationPromptParts.push(
      `Weak areas:\n${focusAreas.map((item, index) =>
        `${index + 1}. Question: ${item.question}\n   Gap: ${item.gap}${
          item.strongAnswer ? `\n   Strong answer: ${item.strongAnswer}` : ""
        }`
      ).join("\n")}`
    );
  }

  if (mistakePatterns.length > 0) {
    deepExplanationPromptParts.push(
      `Known mistake patterns:\n${mistakePatterns.map((item, index) =>
        `${index + 1}. Mistake: ${item.mistake}\n   Pattern: ${item.pattern}\n   Fix: ${item.fix}`
      ).join("\n")}`
    );
  }

  return {
    weakAreasDetected: weakEvaluations.length > 0 || mistakePatterns.length > 0,
    recommendedActions,
    drill: weakEvaluations.length > 0
      ? {
          available: true,
          tool: "start_drill",
          args: {
            topic: session.topic,
            sessionId: session.id,
          },
          weakQuestionCount: weakEvaluations.length,
          reason:
            weakEvaluations.length === 1
              ? "One weak answer was detected. A drill can revisit it immediately."
              : `${weakEvaluations.length} weak answers were detected. A drill can target them directly.`,
        }
      : null,
    deepExplanation: focusAreas.length > 0 || mistakePatterns.length > 0
      ? {
          available: true,
          mode: "deep_explanation",
          reason:
            "The candidate showed gaps that would benefit from a teaching pass focused on mental models, tradeoffs, and when to use the subject correctly.",
          focusAreas,
          mistakePatterns,
          prompt: deepExplanationPromptParts.join("\n\n"),
        }
      : null,
  };
}

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

/**
 * Builds the back-of-card content from evaluation fields available after an
 * interview ends. Works in both AI and file-only mode — no external calls needed.
 */
function buildFlashcardBack(e: Evaluation): string {
  const lines: string[] = [];

  lines.push(`## Your answer`, ``, `> ${e.answer.replace(/\n/g, "\n> ")}`, ``);
  lines.push(`## Feedback`, ``, e.feedback, ``);

  if (e.deeperDive?.trim()) {
    lines.push(`## Where to go deeper`, ``, e.deeperDive.trim(), ``);
  }

  return lines.join("\n");
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
  if (session.sessionKind === "warmup" && (session.questLevel === 0 || session.questLevel === 1)) {
    return [];
  }

  // Deduplicate by questionIndex — keep the evaluation with the lowest score
  const weakByIndex = new Map<number, Evaluation>();
  for (const e of session.evaluations) {
    if (e.score >= FLASHCARD_SCORE_THRESHOLD) continue;
    const existing = weakByIndex.get(e.questionIndex);
    if (!existing || e.score < existing.score) {
      weakByIndex.set(e.questionIndex, e);
    }
  }

  if (weakByIndex.size === 0) return [];

  const now = new Date().toISOString();

  return Array.from(weakByIndex.values()).map((e) => ({
    id: `fc-${session.id}-q${e.questionIndex}`,
    front: e.question,
    back: buildFlashcardBack(e),
    topic: session.topic,
    tags: topicToTags(session.topic),
    difficulty: mapScoreToDifficulty(e.score),
    source: {
      sessionId: session.id,
      questionIndex: e.questionIndex,
      originalScore: e.score,
    },
    createdAt: now,
    // SM-2 initial values — card is due immediately so it can be reviewed right away
    dueDate: now,
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
  }));
}

// ─────────────────────────────────────────────
// Graph merge
// ─────────────────────────────────────────────

export function mergeConceptsIntoGraph(
  graph: KnowledgeGraph,
  concepts: Concept[],
  sessionId: string
): KnowledgeGraph {
  const incrementEdge = (
    sourceId: string,
    targetId: string,
    kind: "cooccurrence" | "semantic",
    relation: string
  ) => {
    const [source, target] = [sourceId, targetId].sort();
    const existing = graph.edges.find(
      (edge) =>
        edge.source === source &&
        edge.target === target &&
        edge.kind === kind &&
        edge.relation === relation
    );
    if (existing) existing.weight++;
    else graph.edges.push({ source, target, weight: 1, kind, relation });
  };

  const normalizedConcepts = normalizeConcepts(concepts);
  const graphNodeConcepts = filterGraphNodeConcepts(normalizedConcepts);

  for (const concept of graphNodeConcepts) {
    const canonical = canonicalizeConceptWord(concept.word);
    const id = canonical.id;
    const existing = graph.nodes.find((n) => n.id === id);
    if (existing) {
      if (!existing.clusters.includes(concept.cluster)) {
        existing.clusters.push(concept.cluster);
      }
      existing.label = canonical.label;
    } else {
      graph.nodes.push({ id, label: canonical.label, clusters: [concept.cluster] });
    }
  }

  const clusterMap: Record<string, string[]> = {};
  for (const c of graphNodeConcepts) {
    if (!clusterMap[c.cluster]) {
      clusterMap[c.cluster] = [];
    }
    clusterMap[c.cluster].push(canonicalizeConceptWord(c.word).id);
  }

  for (const words of Object.values(clusterMap)) {
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        incrementEdge(words[i], words[j], "cooccurrence", "co-occurs-with");
      }
    }
  }

  const clustersByWord = new Map<string, Set<string>>();
  for (const concept of graphNodeConcepts) {
    const id = canonicalizeConceptWord(concept.word).id;
    const clusters = clustersByWord.get(id) ?? new Set<string>();
    clusters.add(concept.cluster);
    clustersByWord.set(id, clusters);
  }

  const uniqueWords = Array.from(clustersByWord.keys()).sort();
  for (let i = 0; i < uniqueWords.length; i++) {
    for (let j = i + 1; j < uniqueWords.length; j++) {
      const source = uniqueWords[i];
      const target = uniqueWords[j];
      const sourceClusters = clustersByWord.get(source)!;
      const targetClusters = clustersByWord.get(target)!;
      const sharesCluster = Array.from(sourceClusters).some((cluster) =>
        targetClusters.has(cluster)
      );

      // Add a weaker bridge whenever concepts co-occur in the same session
      // but never share a cluster. This keeps related areas connected.
      if (!sharesCluster) {
        incrementEdge(source, target, "cooccurrence", "co-occurs-with");
      }
    }
  }

  for (const semanticEdge of deriveSemanticConceptEdges(normalizedConcepts)) {
    incrementEdge(
      semanticEdge.source,
      semanticEdge.target,
      "semantic",
      semanticEdge.relation
    );
  }

  if (!graph.sessions.includes(sessionId)) graph.sessions.push(sessionId);
  return graph;
}
