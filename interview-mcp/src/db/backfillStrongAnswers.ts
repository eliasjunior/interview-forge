import { eq, isNull, ne, or, sql } from "drizzle-orm";
import { createDb, createSqliteClient } from "./client.js";
import { createSqliteRepositories } from "./repositories/createRepositories.js";
import { sessionEvaluations, sessions } from "./schema.js";
import { createKnowledgeStore } from "../knowledge/index.js";
import { buildStrongAnswer } from "../evaluation/strongAnswer.js";

const db = createDb();
const sqlite = createSqliteClient();
const repositories = createSqliteRepositories(db);
const knowledge = createKnowledgeStore();

const liveSessions = repositories.sessions.list();
let updatedEvaluations = 0;

for (const session of liveSessions) {
  const entry = knowledge.findByTopic(session.topic);
  let changed = false;

  session.evaluations = session.evaluations.map((evaluation) => {
    if (evaluation.strongAnswer?.trim()) return evaluation;

    const criteria = entry?.evaluationCriteria[evaluation.questionIndex];
    const strongAnswer = buildStrongAnswer({
      criteria,
      feedback: evaluation.feedback,
      answer: evaluation.answer,
    });

    if (!strongAnswer) return evaluation;
    changed = true;
    updatedEvaluations += 1;
    return { ...evaluation, strongAnswer };
  });

  if (changed) repositories.sessions.save(session);
}

const orphanDelete = sqlite
  .prepare(`
    delete from session_evaluations
    where session_id not in (select id from sessions)
  `)
  .run();

const remainingMissing = db
  .select({ count: sql<number>`count(*)` })
  .from(sessionEvaluations)
  .innerJoin(sessions, eq(sessions.id, sessionEvaluations.sessionId))
  .where(or(isNull(sessionEvaluations.strongAnswer), eq(sessionEvaluations.strongAnswer, "")))
  .get()?.count ?? 0;

console.log(JSON.stringify({
  ok: true,
  sessions: liveSessions.length,
  updatedEvaluations,
  deletedOrphanEvaluations: orphanDelete.changes,
  remainingMissingStrongAnswers: remainingMissing,
}, null, 2));
