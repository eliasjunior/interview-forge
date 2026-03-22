import Database from "better-sqlite3";
import path from "path";
import type { KnowledgeGraph, Session } from "@mock-interview/shared";
import type { ReportDataStore } from "./port.js";
import { mapGraphRowsToDomain, mapSessionRowsToDomain, mapSessionToSqliteRows } from "./mappers.js";

export interface SQLiteReportDataStoreOptions {
  dataDir: string;
  databasePath?: string;
}

export class SQLiteReportDataStore implements ReportDataStore {
  private readonly sqlite: Database.Database;

  constructor(options: SQLiteReportDataStoreOptions) {
    const databasePath = options.databasePath ?? path.join(options.dataDir, "app.db");
    this.sqlite = new Database(databasePath);
    this.sqlite.pragma("foreign_keys = ON");
    this.sqlite.pragma("journal_mode = WAL");
  }

  loadSessions(): Record<string, Session> {
    const sessionRows = this.sqlite
      .prepare("select * from sessions order by created_at asc")
      .all() as any[];

    return Object.fromEntries(
      sessionRows.map((row) => [row.id, this.hydrateSession(row.id, row)])
    );
  }

  saveSessions(sessions: Record<string, Session>): void {
    const replaceAll = this.sqlite.transaction((allSessions: Record<string, Session>) => {
      const upsertSession = this.sqlite.prepare(`
        insert into sessions (
          id, topic, interview_type, session_kind, study_category, source_path, source_type,
          seeded, custom_content, focus_area, state, current_question_index, summary,
          knowledge_source, created_at, ended_at
        ) values (
          @id, @topic, @interview_type, @session_kind, @study_category, @source_path, @source_type,
          @seeded, @custom_content, @focus_area, @state, @current_question_index, @summary,
          @knowledge_source, @created_at, @ended_at
        )
        on conflict(id) do update set
          topic = excluded.topic,
          interview_type = excluded.interview_type,
          session_kind = excluded.session_kind,
          study_category = excluded.study_category,
          source_path = excluded.source_path,
          source_type = excluded.source_type,
          seeded = excluded.seeded,
          custom_content = excluded.custom_content,
          focus_area = excluded.focus_area,
          state = excluded.state,
          current_question_index = excluded.current_question_index,
          summary = excluded.summary,
          knowledge_source = excluded.knowledge_source,
          created_at = excluded.created_at,
          ended_at = excluded.ended_at
      `);
      const insertQuestion = this.sqlite.prepare(
        "insert into session_questions (session_id, position, question) values (@session_id, @position, @question)"
      );
      const insertMessage = this.sqlite.prepare(
        "insert into session_messages (session_id, position, role, content, timestamp) values (@session_id, @position, @role, @content, @timestamp)"
      );
      const insertEvaluation = this.sqlite.prepare(`
        insert into session_evaluations (
          session_id, position, question_index, question, answer, strong_answer, score,
          feedback, needs_follow_up, follow_up_question, deeper_dive
        ) values (
          @session_id, @position, @question_index, @question, @answer, @strong_answer, @score,
          @feedback, @needs_follow_up, @follow_up_question, @deeper_dive
        )
      `);
      const insertConcept = this.sqlite.prepare(
        "insert into session_concepts (session_id, word, cluster) values (@session_id, @word, @cluster)"
      );

      for (const session of Object.values(allSessions)) {
        const record = mapSessionToSqliteRows(session);
        upsertSession.run(record.session);
        this.sqlite.prepare("delete from session_questions where session_id = ?").run(session.id);
        this.sqlite.prepare("delete from session_messages where session_id = ?").run(session.id);
        this.sqlite.prepare("delete from session_evaluations where session_id = ?").run(session.id);
        this.sqlite.prepare("delete from session_concepts where session_id = ?").run(session.id);
        for (const row of record.questions) insertQuestion.run(row);
        for (const row of record.messages) insertMessage.run(row);
        for (const row of record.evaluations) insertEvaluation.run(row);
        for (const row of record.concepts) insertConcept.run(row);
      }
    });

    replaceAll(sessions);
  }

  loadGraph(): KnowledgeGraph {
    return mapGraphRowsToDomain({
      nodes: this.sqlite.prepare("select id, label from graph_nodes").all() as any[],
      nodeClusters: this.sqlite.prepare("select node_id, cluster from graph_node_clusters").all() as any[],
      edges: this.sqlite.prepare("select source, target, weight, kind, relation from graph_edges").all() as any[],
      sessions: this.sqlite.prepare("select session_id from graph_sessions").all() as any[],
    });
  }

  close() {
    this.sqlite.close();
  }

  private hydrateSession(id: string, row?: any): Session {
    const sessionRow = row ?? this.sqlite.prepare("select * from sessions where id = ?").get(id);
    if (!sessionRow) throw new Error(`Session not found: ${id}`);

    return mapSessionRowsToDomain({
      session: sessionRow,
      questions: this.sqlite
        .prepare("select session_id, position, question from session_questions where session_id = ? order by position asc")
        .all(id) as any[],
      messages: this.sqlite
        .prepare("select session_id, position, role, content, timestamp from session_messages where session_id = ? order by position asc")
        .all(id) as any[],
      evaluations: this.sqlite
        .prepare("select session_id, position, question_index, question, answer, strong_answer, score, feedback, needs_follow_up, follow_up_question, deeper_dive from session_evaluations where session_id = ? order by position asc")
        .all(id) as any[],
      concepts: this.sqlite
        .prepare("select session_id, word, cluster from session_concepts where session_id = ?")
        .all(id) as any[],
    });
  }
}

export function createSQLiteReportDataStore(options: SQLiteReportDataStoreOptions): ReportDataStore {
  return new SQLiteReportDataStore(options);
}
