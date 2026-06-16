# shared — Context

TypeScript types only. Single source of truth for all domain types — imported at compile time, never at runtime.

**Convention:** never add a local `types.ts` to any package. All types live here and are imported via `@mock-interview/shared`.

## Key Types (`shared/src/types.ts`)

| Type | Description |
|---|---|
| `Session` | Full interview session record including state, evaluations, graph |
| `KnowledgeGraph` | Nodes and edges for the D3 visualisation |
| `ReportMeta` | Lightweight report metadata (id, topic, date, score) |
| `Flashcard` | Full flashcard with SRS fields |
| `FlashcardDifficulty` | `'easy' \| 'medium' \| 'hard'` |
| `ReviewRating` | `1 \| 2 \| 3 \| 4` |
| `FlashcardReviewResult` | Return shape of a review operation |
| `Mistake` | Mistake log entry: `mistake`, `pattern`, `fix`, optional `topic`, `createdAt` |
| `Exercise` | Exercise metadata: id, name, slug, topic, language, difficulty (1–5), prerequisites, filePath, createdAt |
| `ExercisePrerequisite` | `{ name: string; reason: string }` |
| `InterviewType` | `'design' \| 'code'` — currently only `'design'` is active |
