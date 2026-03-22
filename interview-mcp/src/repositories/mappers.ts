import type {
  Flashcard,
  GraphEdge,
  GraphNode,
  InterviewType,
  KnowledgeGraph,
  Session,
  SessionKind,
  StudyCategory,
} from "@mock-interview/shared";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  flashcardConcepts,
  flashcards,
  flashcardTags,
  graphEdges,
  graphNodeClusters,
  graphNodes,
  graphSessions,
  sessionConcepts,
  sessionEvaluations,
  sessionMessages,
  sessionQuestions,
  sessions,
} from "../db/schema.js";

type SessionRow = InferSelectModel<typeof sessions>;
type SessionQuestionRow = InferSelectModel<typeof sessionQuestions>;
type SessionMessageRow = InferSelectModel<typeof sessionMessages>;
type SessionEvaluationRow = InferSelectModel<typeof sessionEvaluations>;
type SessionConceptRow = InferSelectModel<typeof sessionConcepts>;

type FlashcardRow = InferSelectModel<typeof flashcards>;
type FlashcardTagRow = InferSelectModel<typeof flashcardTags>;
type FlashcardConceptRow = InferSelectModel<typeof flashcardConcepts>;

type GraphNodeRow = InferSelectModel<typeof graphNodes>;
type GraphNodeClusterRow = InferSelectModel<typeof graphNodeClusters>;
type GraphEdgeRow = InferSelectModel<typeof graphEdges>;
type GraphSessionRow = InferSelectModel<typeof graphSessions>;

export interface SessionAggregateRows {
  session: SessionRow;
  questions: SessionQuestionRow[];
  messages: SessionMessageRow[];
  evaluations: SessionEvaluationRow[];
  concepts: SessionConceptRow[];
}

export interface NormalizedSessionRecord {
  session: InferInsertModel<typeof sessions>;
  questions: InferInsertModel<typeof sessionQuestions>[];
  messages: InferInsertModel<typeof sessionMessages>[];
  evaluations: InferInsertModel<typeof sessionEvaluations>[];
  concepts: InferInsertModel<typeof sessionConcepts>[];
}

export interface FlashcardAggregateRows {
  flashcard: FlashcardRow;
  tags: FlashcardTagRow[];
  concepts: FlashcardConceptRow[];
}

export interface NormalizedFlashcardRecord {
  flashcard: InferInsertModel<typeof flashcards>;
  tags: InferInsertModel<typeof flashcardTags>[];
  concepts: InferInsertModel<typeof flashcardConcepts>[];
}

export interface GraphAggregateRows {
  nodes: GraphNodeRow[];
  nodeClusters: GraphNodeClusterRow[];
  edges: GraphEdgeRow[];
  sessions: GraphSessionRow[];
}

export interface NormalizedGraphRecord {
  nodes: InferInsertModel<typeof graphNodes>[];
  nodeClusters: InferInsertModel<typeof graphNodeClusters>[];
  edges: InferInsertModel<typeof graphEdges>[];
  sessions: InferInsertModel<typeof graphSessions>[];
}

export function mapSessionToNormalizedRecord(session: Session): NormalizedSessionRecord {
  return {
    session: {
      id: session.id,
      topic: session.topic,
      interviewType: session.interviewType,
      sessionKind: session.sessionKind,
      studyCategory: session.studyCategory,
      sourcePath: session.sourcePath,
      sourceType: session.sourceType,
      seeded: session.seeded ?? false,
      customContent: session.customContent,
      focusArea: session.focusArea,
      state: session.state,
      currentQuestionIndex: session.currentQuestionIndex,
      summary: session.summary,
      knowledgeSource: session.knowledgeSource,
      createdAt: session.createdAt,
      endedAt: session.endedAt,
    },
    questions: session.questions.map((question, position) => ({
      sessionId: session.id,
      position,
      question,
    })),
    messages: session.messages.map((message, position) => ({
      sessionId: session.id,
      position,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    })),
    evaluations: session.evaluations.map((evaluation, position) => ({
      sessionId: session.id,
      position,
      questionIndex: evaluation.questionIndex,
      question: evaluation.question,
      answer: evaluation.answer,
      strongAnswer: evaluation.strongAnswer,
      score: evaluation.score,
      feedback: evaluation.feedback,
      needsFollowUp: evaluation.needsFollowUp,
      followUpQuestion: evaluation.followUpQuestion,
      deeperDive: evaluation.deeperDive,
    })),
    concepts: (session.concepts ?? []).map((concept) => ({
      sessionId: session.id,
      word: concept.word,
      cluster: concept.cluster,
    })),
  };
}

export function mapSessionAggregateToDomain(rows: SessionAggregateRows): Session {
  return {
    id: rows.session.id,
    topic: rows.session.topic,
    interviewType: (rows.session.interviewType as InterviewType | null) ?? undefined,
    sessionKind: (rows.session.sessionKind as SessionKind | null) ?? undefined,
    studyCategory: (rows.session.studyCategory as StudyCategory | null) ?? undefined,
    sourcePath: rows.session.sourcePath ?? undefined,
    sourceType: (rows.session.sourceType as Session["sourceType"] | null) ?? undefined,
    seeded: rows.session.seeded,
    customContent: rows.session.customContent ?? undefined,
    focusArea: rows.session.focusArea ?? undefined,
    state: rows.session.state as Session["state"],
    currentQuestionIndex: rows.session.currentQuestionIndex,
    questions: rows.questions
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row) => row.question),
    messages: rows.messages
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        role: row.role as Session["messages"][number]["role"],
        content: row.content,
        timestamp: row.timestamp,
      })),
    evaluations: rows.evaluations
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        questionIndex: row.questionIndex,
        question: row.question,
        answer: row.answer,
        strongAnswer: row.strongAnswer ?? undefined,
        score: row.score,
        feedback: row.feedback,
        needsFollowUp: row.needsFollowUp,
        followUpQuestion: row.followUpQuestion ?? undefined,
        deeperDive: row.deeperDive ?? undefined,
      })),
    concepts: rows.concepts.length
      ? rows.concepts.map((row) => ({
          word: row.word,
          cluster: row.cluster,
        }))
      : undefined,
    summary: rows.session.summary ?? undefined,
    createdAt: rows.session.createdAt,
    endedAt: rows.session.endedAt ?? undefined,
    knowledgeSource: rows.session.knowledgeSource as Session["knowledgeSource"],
  };
}

export function mapFlashcardToNormalizedRecord(flashcard: Flashcard): NormalizedFlashcardRecord {
  const concepts: NormalizedFlashcardRecord["concepts"] = [];

  return {
    flashcard: {
      id: flashcard.id,
      front: flashcard.front,
      back: flashcard.back,
      topic: flashcard.topic,
      difficulty: flashcard.difficulty,
      createdAt: flashcard.createdAt,
      dueDate: flashcard.dueDate,
      interval: flashcard.interval,
      easeFactor: flashcard.easeFactor,
      repetitions: flashcard.repetitions,
      lastReviewedAt: flashcard.lastReviewedAt,
      sourceSessionId: flashcard.source?.sessionId ?? null,
      sourceQuestionIndex: flashcard.source?.questionIndex ?? null,
      sourceOriginalScore: flashcard.source?.originalScore ?? null,
      title: null,
      focusItem: null,
      studyNotes: null,
    },
    tags: flashcard.tags.map((tag) => ({
      flashcardId: flashcard.id,
      tag,
    })),
    concepts,
  };
}

export function mapFlashcardAggregateToDomain(rows: FlashcardAggregateRows): Flashcard {
  return {
    id: rows.flashcard.id,
    front: rows.flashcard.front,
    back: rows.flashcard.back,
    topic: rows.flashcard.topic,
    tags: rows.tags.slice().sort((a, b) => a.tag.localeCompare(b.tag)).map((row) => row.tag),
    difficulty: rows.flashcard.difficulty as Flashcard["difficulty"],
    source: rows.flashcard.sourceSessionId != null
      ? {
          sessionId: rows.flashcard.sourceSessionId,
          questionIndex: rows.flashcard.sourceQuestionIndex!,
          originalScore: rows.flashcard.sourceOriginalScore!,
        }
      : undefined,
    createdAt: rows.flashcard.createdAt,
    dueDate: rows.flashcard.dueDate,
    interval: rows.flashcard.interval,
    easeFactor: rows.flashcard.easeFactor,
    repetitions: rows.flashcard.repetitions,
    lastReviewedAt: rows.flashcard.lastReviewedAt ?? undefined,
  };
}

export function mapGraphToNormalizedRecord(graph: KnowledgeGraph): NormalizedGraphRecord {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      label: node.label,
    })),
    nodeClusters: graph.nodes.flatMap((node) =>
      node.clusters.map((cluster) => ({
        nodeId: node.id,
        cluster,
      }))
    ),
    edges: graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
    })),
    sessions: graph.sessions.map((sessionId) => ({
      sessionId,
    })),
  };
}

export function mapGraphAggregateToDomain(rows: GraphAggregateRows): KnowledgeGraph {
  const clustersByNodeId = new Map<string, string[]>();
  for (const row of rows.nodeClusters) {
    const clusters = clustersByNodeId.get(row.nodeId) ?? [];
    clusters.push(row.cluster);
    clustersByNodeId.set(row.nodeId, clusters);
  }

  const nodes: GraphNode[] = rows.nodes.map((row) => ({
    id: row.id,
    label: row.label,
    clusters: (clustersByNodeId.get(row.id) ?? []).slice().sort((a, b) => a.localeCompare(b)),
  }));

  const edges: GraphEdge[] = rows.edges.map((row) => ({
    source: row.source,
    target: row.target,
    weight: row.weight,
  }));

  return {
    nodes,
    edges,
    sessions: rows.sessions.map((row) => row.sessionId),
  };
}
