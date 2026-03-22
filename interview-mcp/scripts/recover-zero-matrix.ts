/**
 * Recovery script — creates and finalizes a Zero Matrix session from the
 * conversation that was completed outside of MCP tooling.
 *
 * Run: npx tsx scripts/recover-zero-matrix.ts
 */

import dotenv from "dotenv";
dotenv.config();

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createDb } from "../src/db/client.js";
import { createSqliteRepositories } from "../src/db/repositories/createRepositories.js";
import {
  generateId,
  calcAvgScore,
  buildSummary,
  buildReport,
  generateFlashcards,
  mergeConceptsIntoGraph,
} from "../src/interviewUtils.js";
import type { Session, Evaluation } from "@mock-interview/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.resolve(__dirname, "../data");
const REPORTS_DIR = path.join(DATA_DIR, "reports");

const db   = createDb();
const repo = createSqliteRepositories(db);

// ── Session data ──────────────────────────────────────────────────────────────

const sessionId = generateId();
const now       = new Date().toISOString();

const QUESTION =
  "What algorithmic technique does Zero Matrix use to achieve O(1) extra space? " +
  "Walk through the step-by-step approach: how you set up the initial state, " +
  "what invariants you maintain, and every edge case you must handle " +
  "(especially the first row and first column).";

const ANSWER =
  "Used the first row and column as in-place markers instead of a separate boolean matrix. " +
  "Tracked firstRowHasZero separately before the marker scan because matrix[0][j] gets " +
  "overwritten and you'd lose that info. " +
  "Step 1: scan row 0 for zeros → set firstRowHasZero. " +
  "Step 2: marker scan — for any matrix[i][j]==0 set matrix[i][0]=0 (row marker) and " +
  "matrix[0][j]=0 (col marker). " +
  "Step 3: zero inner cells (i>=1, j>=1) — if matrix[i][0]==0 || matrix[0][j]==0. " +
  "Step 4: if matrix[0][0]==0, zero the entire first column (moved the if-check outside " +
  "the loop — cleaner and equivalent). " +
  "Step 5: if firstRowHasZero, zero the entire first row. " +
  "Key insight: matrix[0][0] is shared; without tracking firstRowHasZero you'd incorrectly " +
  "zero column 0 whenever row 0 had a zero.";

const FEEDBACK =
  "Excellent answer. Correctly identified the in-place marker pattern and the O(1) space " +
  "optimisation. Demonstrated the critical subtlety: matrix[0][0] is shared between the " +
  "row-0 and col-0 marker roles, requiring firstRowHasZero to be captured before mutation. " +
  "Steps executed in the correct order (Step 4 before Step 5 intentionally). " +
  "Optimisation of hoisting if(matrix[0][0]==0) outside the loop is valid and cleaner. " +
  "Also correctly debugged the original incomplete implementation and identified the " +
  "exact matrix that exposed the Step 4 bug: [[1,1,1],[1,1,1],[0,1,1]].";

const STRONG_ANSWER =
  "Track firstRowHasZero before touching the matrix. Use first row/col as O(1) markers. " +
  "Second pass zeroes inner cells. Third pass (Step 4) zeroes column 0 if matrix[0][0]==0. " +
  "Final pass (Step 5) zeroes row 0 if firstRowHasZero. Order matters: Step 4 before Step 5.";

const evaluation: Evaluation = {
  questionIndex:   0,
  question:        QUESTION,
  answer:          ANSWER,
  score:           5,
  feedback:        FEEDBACK,
  strongAnswer:    STRONG_ANSWER,
  needsFollowUp:   false,
};

const session: Session = {
  id:                   sessionId,
  topic:                "Zero Matrix",
  interviewType:        "design",
  sessionKind:          "interview",
  state:                "ENDED",
  currentQuestionIndex: 1,
  questions:            [QUESTION],
  messages: [
    {
      role:      "interviewer",
      content:   QUESTION,
      timestamp: now,
    },
    {
      role:      "candidate",
      content:   ANSWER,
      timestamp: now,
    },
  ],
  evaluations:    [evaluation],
  customContent:  "Zero Matrix — in-place marker technique, O(1) space.",
  focusArea:      "in-place marker technique, O(1) space optimization, edge cases, first row/column handling",
  knowledgeSource: "file",
  createdAt:      now,
  endedAt:        now,
};

// ── Summary ───────────────────────────────────────────────────────────────────

session.summary = buildSummary(session);
const avgScore  = calcAvgScore(session.evaluations);

// ── Concepts (hardcoded — AI disabled) ───────────────────────────────────────

session.concepts = [
  { word: "in-place algorithm",       cluster: "core concepts" },
  { word: "marker technique",         cluster: "core concepts" },
  { word: "O(1) space",               cluster: "core concepts" },
  { word: "two-pass scan",            cluster: "practical usage" },
  { word: "first row/column marker",  cluster: "practical usage" },
  { word: "shared marker cell",       cluster: "tradeoffs" },
  { word: "firstRowHasZero flag",     cluster: "best practices" },
  { word: "step ordering",            cluster: "best practices" },
];

// ── Persist session ───────────────────────────────────────────────────────────

const sessions = Object.fromEntries(
  repo.sessions.list().map((s) => [s.id, s])
);
sessions[session.id] = session;
repo.sessions.replaceAll(sessions);

console.log(`✅ Session saved: ${sessionId}`);

// ── Report ────────────────────────────────────────────────────────────────────

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
const reportPath = path.join(REPORTS_DIR, `${sessionId}.md`);
fs.writeFileSync(reportPath, buildReport(session));
console.log(`📄 Report written: ${reportPath}`);

// ── Graph ─────────────────────────────────────────────────────────────────────

const graph = repo.graph.get();
repo.graph.save(mergeConceptsIntoGraph(graph, session.concepts, sessionId));
console.log(`🔗 Graph updated with ${session.concepts.length} concepts`);

// ── Flashcards ────────────────────────────────────────────────────────────────

const newCards = generateFlashcards(session);
if (newCards.length > 0) {
  const existing    = repo.flashcards.list();
  const existingIds = new Set(existing.map((c) => c.id));
  repo.flashcards.replaceAll([
    ...existing,
    ...newCards.filter((c) => !existingIds.has(c.id)),
  ]);
  console.log(`🃏 ${newCards.length} flashcard(s) generated`);
} else {
  console.log(`🃏 No flashcards generated (score ${avgScore}/5 — all above threshold)`);
}

console.log(`\n🎉 Zero Matrix session recovered!`);
console.log(`   Session ID : ${sessionId}`);
console.log(`   Avg score  : ${avgScore}/5`);
console.log(`   UI         : http://localhost:5173/sessions`);
