import { asc, eq } from "drizzle-orm";
import type { AppDb } from "../client.js";
import {
  sessionConcepts,
  sessionEvaluations,
  sessionMessages,
  sessionQuestions,
  sessions,
} from "../schema.js";
import type { Session } from "@mock-interview/shared";
import type { SessionRepository } from "../../repositories/sessionRepository.js";
import {
  mapSessionAggregateToDomain,
  mapSessionToNormalizedRecord,
} from "../../repositories/mappers.js";

export class SQLiteSessionRepository implements SessionRepository {
  constructor(private readonly db: AppDb) {}

  list(): Session[] {
    const sessionRows = this.db.select().from(sessions).orderBy(asc(sessions.createdAt)).all();
    return sessionRows.map((row) => this.hydrate(row.id));
  }

  getById(id: string): Session | null {
    const row = this.db.select().from(sessions).where(eq(sessions.id, id)).get();
    return row ? this.hydrate(row.id) : null;
  }

  save(session: Session): void {
    const record = mapSessionToNormalizedRecord(session);

    this.db.transaction((tx) => {
      tx.insert(sessions).values(record.session).onConflictDoUpdate({
        target: sessions.id,
        set: {
          topic: record.session.topic,
          problemTitle: record.session.problemTitle,
          interviewType: record.session.interviewType,
          sessionKind: record.session.sessionKind,
          studyCategory: record.session.studyCategory,
          sourcePath: record.session.sourcePath,
          sourceType: record.session.sourceType,
          seeded: record.session.seeded,
          customContent: record.session.customContent,
          focusArea: record.session.focusArea,
          pendingAnswerMode: record.session.pendingAnswerMode,
          activeAdaptiveChallenge: record.session.activeAdaptiveChallenge,
          state: record.session.state,
          currentQuestionIndex: record.session.currentQuestionIndex,
          summary: record.session.summary,
          knowledgeSource: record.session.knowledgeSource,
          createdAt: record.session.createdAt,
          endedAt: record.session.endedAt,
        },
      }).run();

      tx.delete(sessionQuestions).where(eq(sessionQuestions.sessionId, session.id)).run();
      tx.delete(sessionMessages).where(eq(sessionMessages.sessionId, session.id)).run();
      tx.delete(sessionEvaluations).where(eq(sessionEvaluations.sessionId, session.id)).run();
      tx.delete(sessionConcepts).where(eq(sessionConcepts.sessionId, session.id)).run();

      if (record.questions.length) tx.insert(sessionQuestions).values(record.questions).run();
      if (record.messages.length) tx.insert(sessionMessages).values(record.messages).run();
      if (record.evaluations.length) tx.insert(sessionEvaluations).values(record.evaluations).run();
      if (record.concepts.length) tx.insert(sessionConcepts).values(record.concepts).run();
    });
  }

  saveMany(allSessions: Session[]): void {
    this.db.transaction((tx) => {
      for (const session of allSessions) {
        const record = mapSessionToNormalizedRecord(session);
        tx.insert(sessions).values(record.session).onConflictDoUpdate({
          target: sessions.id,
          set: {
            topic: record.session.topic,
            problemTitle: record.session.problemTitle,
            interviewType: record.session.interviewType,
            sessionKind: record.session.sessionKind,
            studyCategory: record.session.studyCategory,
            sourcePath: record.session.sourcePath,
            sourceType: record.session.sourceType,
            seeded: record.session.seeded,
            customContent: record.session.customContent,
            focusArea: record.session.focusArea,
            pendingAnswerMode: record.session.pendingAnswerMode,
            activeAdaptiveChallenge: record.session.activeAdaptiveChallenge,
            state: record.session.state,
            currentQuestionIndex: record.session.currentQuestionIndex,
            summary: record.session.summary,
            knowledgeSource: record.session.knowledgeSource,
            createdAt: record.session.createdAt,
            endedAt: record.session.endedAt,
          },
        }).run();

        tx.delete(sessionQuestions).where(eq(sessionQuestions.sessionId, session.id)).run();
        tx.delete(sessionMessages).where(eq(sessionMessages.sessionId, session.id)).run();
        tx.delete(sessionEvaluations).where(eq(sessionEvaluations.sessionId, session.id)).run();
        tx.delete(sessionConcepts).where(eq(sessionConcepts.sessionId, session.id)).run();

        if (record.questions.length) tx.insert(sessionQuestions).values(record.questions).run();
        if (record.messages.length) tx.insert(sessionMessages).values(record.messages).run();
        if (record.evaluations.length) tx.insert(sessionEvaluations).values(record.evaluations).run();
        if (record.concepts.length) tx.insert(sessionConcepts).values(record.concepts).run();
      }
    });
  }

  replaceAll(sessionsById: Record<string, Session>): void {
    this.db.transaction((tx) => {
      tx.delete(sessionQuestions).run();
      tx.delete(sessionMessages).run();
      tx.delete(sessionEvaluations).run();
      tx.delete(sessionConcepts).run();
      tx.delete(sessions).run();

      for (const session of Object.values(sessionsById)) {
        const record = mapSessionToNormalizedRecord(session);
        tx.insert(sessions).values(record.session).run();
        if (record.questions.length) tx.insert(sessionQuestions).values(record.questions).run();
        if (record.messages.length) tx.insert(sessionMessages).values(record.messages).run();
        if (record.evaluations.length) tx.insert(sessionEvaluations).values(record.evaluations).run();
        if (record.concepts.length) tx.insert(sessionConcepts).values(record.concepts).run();
      }
    });
  }

  deleteById(id: string): boolean {
    const result = this.db.transaction((tx) => {
      tx.delete(sessionQuestions).where(eq(sessionQuestions.sessionId, id)).run();
      tx.delete(sessionMessages).where(eq(sessionMessages.sessionId, id)).run();
      tx.delete(sessionEvaluations).where(eq(sessionEvaluations.sessionId, id)).run();
      tx.delete(sessionConcepts).where(eq(sessionConcepts.sessionId, id)).run();
      return tx.delete(sessions).where(eq(sessions.id, id)).run();
    });

    return result.changes > 0;
  }

  private hydrate(id: string): Session {
    const sessionRow = this.db.select().from(sessions).where(eq(sessions.id, id)).get();
    if (!sessionRow) throw new Error(`Session not found: ${id}`);

    return mapSessionAggregateToDomain({
      session: sessionRow,
      questions: this.db
        .select()
        .from(sessionQuestions)
        .where(eq(sessionQuestions.sessionId, id))
        .orderBy(asc(sessionQuestions.position))
        .all(),
      messages: this.db
        .select()
        .from(sessionMessages)
        .where(eq(sessionMessages.sessionId, id))
        .orderBy(asc(sessionMessages.position))
        .all(),
      evaluations: this.db
        .select()
        .from(sessionEvaluations)
        .where(eq(sessionEvaluations.sessionId, id))
        .orderBy(asc(sessionEvaluations.position))
        .all(),
      concepts: this.db
        .select()
        .from(sessionConcepts)
        .where(eq(sessionConcepts.sessionId, id))
        .all(),
    });
  }
}
