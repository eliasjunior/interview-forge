import { relations } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  interviewType: text("interview_type"),
  sessionKind: text("session_kind"),
  studyCategory: text("study_category"),
  sourcePath: text("source_path"),
  sourceType: text("source_type"),
  seeded: integer("seeded", { mode: "boolean" }).notNull().default(false),
  customContent: text("custom_content"),
  focusArea: text("focus_area"),
  state: text("state").notNull(),
  currentQuestionIndex: integer("current_question_index").notNull(),
  summary: text("summary"),
  knowledgeSource: text("knowledge_source").notNull(),
  createdAt: text("created_at").notNull(),
  endedAt: text("ended_at"),
});

export const sessionQuestions = sqliteTable(
  "session_questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    question: text("question").notNull(),
  },
  (table) => ({
    sessionPositionUnique: uniqueIndex("session_questions_session_position_idx").on(table.sessionId, table.position),
  })
);

export const sessionMessages = sqliteTable(
  "session_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    timestamp: text("timestamp").notNull(),
  },
  (table) => ({
    sessionPositionUnique: uniqueIndex("session_messages_session_position_idx").on(table.sessionId, table.position),
  })
);

export const sessionEvaluations = sqliteTable(
  "session_evaluations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    questionIndex: integer("question_index").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    strongAnswer: text("strong_answer"),
    score: integer("score").notNull(),
    feedback: text("feedback").notNull(),
    needsFollowUp: integer("needs_follow_up", { mode: "boolean" }).notNull(),
    followUpQuestion: text("follow_up_question"),
    deeperDive: text("deeper_dive"),
  },
  (table) => ({
    sessionPositionUnique: uniqueIndex("session_evaluations_session_position_idx").on(table.sessionId, table.position),
  })
);

export const sessionConcepts = sqliteTable("session_concepts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  cluster: text("cluster").notNull(),
});

export const flashcards = sqliteTable("flashcards", {
  id: text("id").primaryKey(),
  front: text("front").notNull(),
  back: text("back").notNull(),
  topic: text("topic").notNull(),
  difficulty: text("difficulty").notNull(),
  createdAt: text("created_at").notNull(),
  dueDate: text("due_date").notNull(),
  interval: integer("interval").notNull(),
  easeFactor: real("ease_factor").notNull(),
  repetitions: integer("repetitions").notNull(),
  lastReviewedAt: text("last_reviewed_at"),
  sourceSessionId: text("source_session_id"),
  sourceQuestionIndex: integer("source_question_index"),
  sourceOriginalScore: integer("source_original_score"),
  title: text("title"),
  focusItem: text("focus_item"),
  studyNotes: text("study_notes"),
});

export const flashcardTags = sqliteTable(
  "flashcard_tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    flashcardId: text("flashcard_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => ({
    flashcardTagUnique: uniqueIndex("flashcard_tags_flashcard_tag_idx").on(table.flashcardId, table.tag),
  })
);

export const flashcardConcepts = sqliteTable(
  "flashcard_concepts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    flashcardId: text("flashcard_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
    concept: text("concept").notNull(),
    position: integer("position").notNull(),
  },
  (table) => ({
    flashcardPositionUnique: uniqueIndex("flashcard_concepts_flashcard_position_idx").on(table.flashcardId, table.position),
  })
);

export const graphNodes = sqliteTable("graph_nodes", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
});

export const graphNodeClusters = sqliteTable(
  "graph_node_clusters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nodeId: text("node_id").notNull().references(() => graphNodes.id, { onDelete: "cascade" }),
    cluster: text("cluster").notNull(),
  },
  (table) => ({
    nodeClusterUnique: uniqueIndex("graph_node_clusters_node_cluster_idx").on(table.nodeId, table.cluster),
  })
);

export const graphEdges = sqliteTable(
  "graph_edges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull().references(() => graphNodes.id, { onDelete: "cascade" }),
    target: text("target").notNull().references(() => graphNodes.id, { onDelete: "cascade" }),
    weight: integer("weight").notNull(),
  },
  (table) => ({
    sourceTargetUnique: uniqueIndex("graph_edges_source_target_idx").on(table.source, table.target),
  })
);

export const graphSessions = sqliteTable("graph_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull().unique().references(() => sessions.id, { onDelete: "cascade" }),
});

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  confidence: integer("confidence").notNull().default(1),
  subSkills: text("sub_skills").notNull().default("[]"),   // JSON: SkillSubSkill[]
  relatedProblems: text("related_problems").notNull().default("[]"), // JSON: string[]
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  topic: text("topic").notNull(),
  language: text("language").notNull().default("any"),
  difficulty: integer("difficulty").notNull().default(3),
  description: text("description").notNull(),
  scenario: text("scenario").notNull().default(""),
  problemMeaning: text("problem_meaning").notNull().default("[]"), // JSON: string[]
  tags: text("tags").notNull().default("[]"), // JSON: string[]
  prerequisites: text("prerequisites").notNull().default("[]"), // JSON: ExercisePrerequisite[]
  filePath: text("file_path").notNull(),
  createdAt: text("created_at").notNull(),
});

export const mistakes = sqliteTable("mistakes", {
  id: text("id").primaryKey(),
  mistake: text("mistake").notNull(),
  pattern: text("pattern").notNull(),
  fix: text("fix").notNull(),
  topic: text("topic"),
  createdAt: text("created_at").notNull(),
});

export const sessionsRelations = relations(sessions, ({ many }) => ({
  questions: many(sessionQuestions),
  messages: many(sessionMessages),
  evaluations: many(sessionEvaluations),
  concepts: many(sessionConcepts),
  flashcards: many(flashcards),
}));

export const sessionQuestionsRelations = relations(sessionQuestions, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionQuestions.sessionId],
    references: [sessions.id],
  }),
}));

export const sessionMessagesRelations = relations(sessionMessages, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionMessages.sessionId],
    references: [sessions.id],
  }),
}));

export const sessionEvaluationsRelations = relations(sessionEvaluations, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionEvaluations.sessionId],
    references: [sessions.id],
  }),
}));

export const sessionConceptsRelations = relations(sessionConcepts, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionConcepts.sessionId],
    references: [sessions.id],
  }),
}));

export const flashcardsRelations = relations(flashcards, ({ one, many }) => ({
  session: one(sessions, {
    fields: [flashcards.sourceSessionId],
    references: [sessions.id],
  }),
  tags: many(flashcardTags),
  concepts: many(flashcardConcepts),
}));

export const flashcardTagsRelations = relations(flashcardTags, ({ one }) => ({
  flashcard: one(flashcards, {
    fields: [flashcardTags.flashcardId],
    references: [flashcards.id],
  }),
}));

export const flashcardConceptsRelations = relations(flashcardConcepts, ({ one }) => ({
  flashcard: one(flashcards, {
    fields: [flashcardConcepts.flashcardId],
    references: [flashcards.id],
  }),
}));

export const graphNodesRelations = relations(graphNodes, ({ many }) => ({
  clusters: many(graphNodeClusters),
}));

export const graphNodeClustersRelations = relations(graphNodeClusters, ({ one }) => ({
  node: one(graphNodes, {
    fields: [graphNodeClusters.nodeId],
    references: [graphNodes.id],
  }),
}));
