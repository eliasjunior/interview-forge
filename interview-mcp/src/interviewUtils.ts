export type {
  InterviewState,
  Message,
  Evaluation,
  Session,
  Concept,
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
} from "./types.js";
import type { InterviewState, Session, Evaluation, Concept, KnowledgeGraph } from "./types.js";

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
      (byCluster[c.cluster] ??= []).push(c.word);
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

// ─────────────────────────────────────────────
// Graph merge
// ─────────────────────────────────────────────

export function mergeConceptsIntoGraph(
  graph: KnowledgeGraph,
  concepts: Concept[],
  sessionId: string
): KnowledgeGraph {
  for (const concept of concepts) {
    const id = concept.word.toLowerCase();
    const existing = graph.nodes.find((n) => n.id === id);
    if (existing) {
      if (!existing.clusters.includes(concept.cluster)) {
        existing.clusters.push(concept.cluster);
      }
    } else {
      graph.nodes.push({ id, label: concept.word, clusters: [concept.cluster] });
    }
  }

  const clusterMap: Record<string, string[]> = {};
  for (const c of concepts) {
    (clusterMap[c.cluster] ??= []).push(c.word.toLowerCase());
  }

  for (const words of Object.values(clusterMap)) {
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        const [src, tgt] = [words[i], words[j]].sort();
        const existing = graph.edges.find(
          (e) => e.source === src && e.target === tgt
        );
        if (existing) existing.weight++;
        else graph.edges.push({ source: src, target: tgt, weight: 1 });
      }
    }
  }

  if (!graph.sessions.includes(sessionId)) graph.sessions.push(sessionId);
  return graph;
}
