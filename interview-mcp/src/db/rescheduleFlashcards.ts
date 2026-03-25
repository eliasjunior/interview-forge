/**
 * Reschedules all flashcards that are currently due (dueDate <= now).
 * Groups cards by topic and staggers topics 3 days apart, with cards
 * within a topic spread 1 day apart. Existing SRS state (easeFactor,
 * repetitions) is preserved — only dueDate is updated.
 */
import { createDb } from "./client.js";
import { createSqliteRepositories } from "./repositories/createRepositories.js";

const db = createDb();
const repositories = createSqliteRepositories(db);

const now = new Date();
const all = repositories.flashcards.list();
const due = all.filter((c) => new Date(c.dueDate) <= now);

// Group due cards by topic
const byTopic = new Map<string, typeof due>();
for (const card of due) {
  const group = byTopic.get(card.topic) ?? [];
  group.push(card);
  byTopic.set(card.topic, group);
}

const topics = [...byTopic.keys()].sort();
let rescheduled = 0;

topics.forEach((topic, topicIndex) => {
  const cards = byTopic.get(topic)!;
  cards.forEach((card, cardIndex) => {
    // Each topic starts 3 days after the previous one; cards within a topic are 1 day apart
    const daysOut = topicIndex * 3 + cardIndex;
    const jitter = Math.round((Math.random() - 0.5) * 2); // ±1
    const dueDate = new Date(
      now.getTime() + (daysOut + jitter) * 24 * 60 * 60 * 1000
    ).toISOString();

    repositories.flashcards.save({ ...card, dueDate });
    rescheduled++;
  });
});

console.log(JSON.stringify({
  ok: true,
  totalCards: all.length,
  rescheduled,
  topics: topics.length,
  topicList: topics,
}, null, 2));
