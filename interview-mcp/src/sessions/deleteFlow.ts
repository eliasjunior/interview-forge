import type { Flashcard, KnowledgeGraph, Session } from "@mock-interview/shared";
import { mergeConceptsIntoGraph } from "../graphUtils.js";

export interface SessionArtifactStatus {
  markdownReport: boolean;
  reportUiDataset: boolean;
  weakSubjectsHtml: boolean;
}

export interface SessionDeletionPreview {
  session: {
    id: string;
    topic: string;
    state: string;
    createdAt: string;
    endedAt: string | null;
    questionCount: number;
    messageCount: number;
    evaluationCount: number;
    conceptCount: number;
    hasSummary: boolean;
  };
  flashcards: {
    count: number;
    ids: string[];
  };
  graph: {
    includedInGraphSessions: boolean;
    rebuildRequired: boolean;
    currentNodeCount: number;
    currentEdgeCount: number;
  };
  artifacts: SessionArtifactStatus;
  warnings: string[];
}

export function buildSessionDeletionPreview(
  session: Session,
  flashcards: Flashcard[],
  graph: KnowledgeGraph,
  artifacts: SessionArtifactStatus,
): SessionDeletionPreview {
  const warnings: string[] = [];
  const includedInGraphSessions = graph.sessions.includes(session.id);
  const rebuildRequired = includedInGraphSessions || (session.concepts?.length ?? 0) > 0;

  if (session.state !== "ENDED") {
    warnings.push("Session is not ended. Deleting it will remove an in-progress transcript.");
  }
  if (session.evaluations.length === 0) {
    warnings.push("Session has no evaluations. This looks like incomplete or low-value data.");
  }
  if (flashcards.length > 0) {
    warnings.push(`Deleting this session will also delete ${flashcards.length} sourced flashcard(s).`);
  }
  if (rebuildRequired) {
    warnings.push("Graph must be rebuilt after deletion because this session contributes derived graph state.");
  }

  return {
    session: {
      id: session.id,
      topic: session.topic,
      state: session.state,
      createdAt: session.createdAt,
      endedAt: session.endedAt ?? null,
      questionCount: session.questions.length,
      messageCount: session.messages.length,
      evaluationCount: session.evaluations.length,
      conceptCount: session.concepts?.length ?? 0,
      hasSummary: Boolean(session.summary),
    },
    flashcards: {
      count: flashcards.length,
      ids: flashcards.map((card) => card.id),
    },
    graph: {
      includedInGraphSessions,
      rebuildRequired,
      currentNodeCount: graph.nodes.length,
      currentEdgeCount: graph.edges.length,
    },
    artifacts,
    warnings,
  };
}

export function rebuildGraphFromSessions(sessions: Session[]): KnowledgeGraph {
  let graph: KnowledgeGraph = { nodes: [], edges: [], sessions: [] };

  for (const session of sessions) {
    if (!session.concepts || session.concepts.length === 0) continue;
    graph = mergeConceptsIntoGraph(
      { nodes: [...graph.nodes], edges: [...graph.edges], sessions: [...graph.sessions] },
      session.concepts,
      session.id
    );
  }

  return graph;
}
