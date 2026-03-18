import type {
  InterviewType,
  KnowledgeGraph,
  Session,
  SessionKind,
  StudyCategory,
} from "@mock-interview/shared";

export interface SessionRow {
  id: string;
  topic: string;
  interview_type: string | null;
  session_kind: string | null;
  study_category: string | null;
  source_path: string | null;
  source_type: string | null;
  seeded: number;
  custom_content: string | null;
  focus_area: string | null;
  state: string;
  current_question_index: number;
  summary: string | null;
  knowledge_source: string;
  created_at: string;
  ended_at: string | null;
}

export interface SessionQuestionRow {
  session_id: string;
  position: number;
  question: string;
}

export interface SessionMessageRow {
  session_id: string;
  position: number;
  role: string;
  content: string;
  timestamp: string;
}

export interface SessionEvaluationRow {
  session_id: string;
  position: number;
  question_index: number;
  question: string;
  answer: string;
  strong_answer: string | null;
  score: number;
  feedback: string;
  needs_follow_up: number;
  follow_up_question: string | null;
  deeper_dive: string | null;
}

export interface SessionConceptRow {
  session_id: string;
  word: string;
  cluster: string;
}

export interface GraphNodeRow {
  id: string;
  label: string;
}

export interface GraphNodeClusterRow {
  node_id: string;
  cluster: string;
}

export interface GraphEdgeRow {
  source: string;
  target: string;
  weight: number;
}

export interface GraphSessionRow {
  session_id: string;
}

export function mapSessionRowsToDomain(args: {
  session: SessionRow;
  questions: SessionQuestionRow[];
  messages: SessionMessageRow[];
  evaluations: SessionEvaluationRow[];
  concepts: SessionConceptRow[];
}): Session {
  const { session, questions, messages, evaluations, concepts } = args;

  return {
    id: session.id,
    topic: session.topic,
    interviewType: (session.interview_type as InterviewType | null) ?? undefined,
    sessionKind: (session.session_kind as SessionKind | null) ?? undefined,
    studyCategory: (session.study_category as StudyCategory | null) ?? undefined,
    sourcePath: session.source_path ?? undefined,
    sourceType: (session.source_type as Session["sourceType"] | null) ?? undefined,
    seeded: Boolean(session.seeded),
    customContent: session.custom_content ?? undefined,
    focusArea: session.focus_area ?? undefined,
    state: session.state as Session["state"],
    currentQuestionIndex: session.current_question_index,
    questions: questions.slice().sort((a, b) => a.position - b.position).map((row) => row.question),
    messages: messages.slice().sort((a, b) => a.position - b.position).map((row) => ({
      role: row.role as Session["messages"][number]["role"],
      content: row.content,
      timestamp: row.timestamp,
    })),
    evaluations: evaluations.slice().sort((a, b) => a.position - b.position).map((row) => ({
      questionIndex: row.question_index,
      question: row.question,
      answer: row.answer,
      strongAnswer: row.strong_answer ?? undefined,
      score: row.score,
      feedback: row.feedback,
      needsFollowUp: Boolean(row.needs_follow_up),
      followUpQuestion: row.follow_up_question ?? undefined,
      deeperDive: row.deeper_dive ?? undefined,
    })),
    concepts: concepts.length ? concepts.map((row) => ({ word: row.word, cluster: row.cluster })) : undefined,
    summary: session.summary ?? undefined,
    createdAt: session.created_at,
    endedAt: session.ended_at ?? undefined,
    knowledgeSource: session.knowledge_source as Session["knowledgeSource"],
  };
}

export function mapSessionToSqliteRows(session: Session) {
  return {
    session: {
      id: session.id,
      topic: session.topic,
      interview_type: session.interviewType ?? null,
      session_kind: session.sessionKind ?? null,
      study_category: session.studyCategory ?? null,
      source_path: session.sourcePath ?? null,
      source_type: session.sourceType ?? null,
      seeded: session.seeded ? 1 : 0,
      custom_content: session.customContent ?? null,
      focus_area: session.focusArea ?? null,
      state: session.state,
      current_question_index: session.currentQuestionIndex,
      summary: session.summary ?? null,
      knowledge_source: session.knowledgeSource,
      created_at: session.createdAt,
      ended_at: session.endedAt ?? null,
    },
    questions: session.questions.map((question, position) => ({
      session_id: session.id,
      position,
      question,
    })),
    messages: session.messages.map((message, position) => ({
      session_id: session.id,
      position,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    })),
    evaluations: session.evaluations.map((evaluation, position) => ({
      session_id: session.id,
      position,
      question_index: evaluation.questionIndex,
      question: evaluation.question,
      answer: evaluation.answer,
      strong_answer: evaluation.strongAnswer ?? null,
      score: evaluation.score,
      feedback: evaluation.feedback,
      needs_follow_up: evaluation.needsFollowUp ? 1 : 0,
      follow_up_question: evaluation.followUpQuestion ?? null,
      deeper_dive: evaluation.deeperDive ?? null,
    })),
    concepts: (session.concepts ?? []).map((concept) => ({
      session_id: session.id,
      word: concept.word,
      cluster: concept.cluster,
    })),
  };
}

export function mapGraphRowsToDomain(args: {
  nodes: GraphNodeRow[];
  nodeClusters: GraphNodeClusterRow[];
  edges: GraphEdgeRow[];
  sessions: GraphSessionRow[];
}): KnowledgeGraph {
  const clustersByNodeId = new Map<string, string[]>();
  for (const row of args.nodeClusters) {
    const clusters = clustersByNodeId.get(row.node_id) ?? [];
    clusters.push(row.cluster);
    clustersByNodeId.set(row.node_id, clusters);
  }

  return {
    nodes: args.nodes.map((row) => ({
      id: row.id,
      label: row.label,
      clusters: (clustersByNodeId.get(row.id) ?? []).slice().sort((a, b) => a.localeCompare(b)),
    })),
    edges: args.edges.map((row) => ({
      source: row.source,
      target: row.target,
      weight: row.weight,
    })),
    sessions: args.sessions.map((row) => row.session_id),
  };
}
