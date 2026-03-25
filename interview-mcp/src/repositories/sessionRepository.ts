import type { Session } from "@mock-interview/shared";

export interface SessionRepository {
  list(): Session[];
  getById(id: string): Session | null;
  save(session: Session): void;
  saveMany(sessions: Session[]): void;
  replaceAll(sessions: Record<string, Session>): void;
  deleteById(id: string): boolean;
}
