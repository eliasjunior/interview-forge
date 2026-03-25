import { createDb } from "./client.js";
import { createSqliteRepositories } from "./repositories/createRepositories.js";
import { generateFlashcards } from "../interviewUtils.js";

const db = createDb();
const repositories = createSqliteRepositories(db);

const allSessions = repositories.sessions.list();
const endedSessions = Object.values(allSessions).filter((s) => s.state === "ENDED");

let created = 0;
let skipped = 0;

for (const session of endedSessions) {
  const cards = generateFlashcards(session);
  for (const card of cards) {
    const existing = repositories.flashcards.getById(card.id);
    if (existing) {
      skipped++;
      continue;
    }
    repositories.flashcards.save(card);
    created++;
  }
}

console.log(JSON.stringify({
  ok: true,
  sessionsScanned: endedSessions.length,
  flashcardsCreated: created,
  flashcardsSkipped: skipped,
}, null, 2));
