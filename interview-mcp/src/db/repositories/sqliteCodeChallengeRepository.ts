import { eq } from "drizzle-orm";
import type { CodeChallengeLanguage } from "@mock-interview/shared";
import type { AppDb } from "../client.js";
import { codeChallenges } from "../schema.js";
import type {
  CodeChallengeRepository,
  StoredCodeChallenge,
} from "../../repositories/codeChallengeRepository.js";

export class SQLiteCodeChallengeRepository implements CodeChallengeRepository {
  constructor(private readonly db: AppDb) {}

  getBySessionId(sessionId: string): StoredCodeChallenge | null {
    const row = this.db
      .select()
      .from(codeChallenges)
      .where(eq(codeChallenges.sessionId, sessionId))
      .get();
    if (!row) return null;

    return {
      sessionId: row.sessionId,
      language: row.language as CodeChallengeLanguage,
      functionSignature: row.functionSignature,
      starterCode: row.starterCode,
      sampleTests: JSON.parse(row.sampleTests) as string[],
      hints: JSON.parse(row.hints) as string[],
      hiddenTestCount: row.hiddenTestCount,
      testHarness: row.testHarness,
      referenceSolution: row.referenceSolution,
      teacherNotes: row.teacherNotes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  upsert(challenge: StoredCodeChallenge): void {
    const values = {
      sessionId: challenge.sessionId,
      language: challenge.language,
      functionSignature: challenge.functionSignature,
      starterCode: challenge.starterCode,
      sampleTests: JSON.stringify(challenge.sampleTests),
      hints: JSON.stringify(challenge.hints),
      hiddenTestCount: challenge.hiddenTestCount,
      testHarness: challenge.testHarness,
      referenceSolution: challenge.referenceSolution,
      teacherNotes: challenge.teacherNotes,
      createdAt: challenge.createdAt,
      updatedAt: challenge.updatedAt,
    };

    this.db.insert(codeChallenges).values(values).onConflictDoUpdate({
      target: codeChallenges.sessionId,
      set: {
        language: values.language,
        functionSignature: values.functionSignature,
        starterCode: values.starterCode,
        sampleTests: values.sampleTests,
        hints: values.hints,
        hiddenTestCount: values.hiddenTestCount,
        testHarness: values.testHarness,
        referenceSolution: values.referenceSolution,
        teacherNotes: values.teacherNotes,
        updatedAt: values.updatedAt,
      },
    }).run();
  }
}
