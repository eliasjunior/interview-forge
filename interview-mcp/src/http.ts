import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { registerWeakReportRoutes } from "./http/weakReports.js";
import { applySM2 } from "./srsUtils.js";
import type {
  ReviewRating,
  Flashcard,
  Session,
  GraphInspectionResult,
  GraphInspectionSession,
} from "@mock-interview/shared";
import { createDb } from "./db/client.js";
import { createSqliteRepositories } from "./db/repositories/createRepositories.js";
import { canonicalizeConceptWord } from "./graph/concepts.js";
import { deleteSessionWithArtifacts, inspectSessionDeletionImpact } from "./sessions/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const GENERATED_UI_DIR = path.join(PUBLIC_DIR, "generated");

const PORT = process.env.PORT ?? 3001;
const db = createDb();
const repositories = createSqliteRepositories(db);

const app = express();
app.use(cors());
app.use(express.json());

// Serve the neural map frontend
app.use(express.static(PUBLIC_DIR));

function loadSessions(): Record<string, Session> {
  return Object.fromEntries(
    repositories.sessions.list().map((session) => [session.id, session])
  );
}

function loadFlashcards(): Flashcard[] {
  return repositories.flashcards.list();
}

function saveFlashcards(cards: Flashcard[]) {
  repositories.flashcards.replaceAll(cards);
}

function buildGraphInspection(selectedNodeIds: string[]): GraphInspectionResult {
  const graph = repositories.graph.get();
  const sessions = repositories.sessions.list();
  const selectedSet = new Set(selectedNodeIds);
  const selectedNodes = graph.nodes.filter((node) => selectedSet.has(node.id));
  const directEdges = graph.edges.filter(
    (edge) => selectedSet.has(edge.source) && selectedSet.has(edge.target)
  );

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  const toInspectionSession = (session: Session): GraphInspectionSession => {
    const selectedConcepts = [...new Map(
      (session.concepts ?? [])
        .map((concept) => canonicalizeConceptWord(concept.word).id)
        .filter((id) => selectedSet.has(id))
        .map((id) => {
          const node = nodeById.get(id);
          return [id, {
            id,
            label: node?.label ?? id,
            clusters: node?.clusters ?? [],
          }];
        })
    ).values()];

    const prioritizedEvaluations = [...session.evaluations].sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const strongA = a.strongAnswer?.trim() ? 0 : 1;
      const strongB = b.strongAnswer?.trim() ? 0 : 1;
      if (strongA !== strongB) return strongA - strongB;
      return a.questionIndex - b.questionIndex;
    });

    const questionEvidence = session.evaluations.length > 0
      ? prioritizedEvaluations.slice(0, 3).map((evaluation) => ({
          questionIndex: evaluation.questionIndex,
          question: evaluation.question,
          answer: evaluation.answer,
          score: evaluation.score,
          feedback: evaluation.feedback,
          strongAnswer: evaluation.strongAnswer,
        }))
      : session.questions.slice(0, 3).map((question, index) => ({
          questionIndex: index,
          question,
        }));

    return {
      sessionId: session.id,
      topic: session.topic,
      createdAt: session.createdAt,
      selectedConcepts,
      questions: questionEvidence,
      summary: session.summary,
    };
  };

  const matchingSessions = sessions
    .map((session) => {
      const conceptIds = new Set((session.concepts ?? []).map((concept) => canonicalizeConceptWord(concept.word).id));
      const matchedIds = selectedNodeIds.filter((id) => conceptIds.has(id));
      return { session, matchedIds };
    })
    .filter(({ matchedIds }) => matchedIds.length > 0);

  const sessionsMatchingAll = matchingSessions
    .filter(({ matchedIds }) => matchedIds.length === selectedNodeIds.length)
    .map(({ session }) => toInspectionSession(session))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const sessionsMatchingAny = matchingSessions
    .filter(({ matchedIds }) => matchedIds.length < selectedNodeIds.length)
    .sort((a, b) => b.matchedIds.length - a.matchedIds.length || b.session.createdAt.localeCompare(a.session.createdAt))
    .map(({ session }) => toInspectionSession(session));

  return {
    selectedNodes,
    directEdges,
    sessionsMatchingAll,
    sessionsMatchingAny,
  };
}

// API: Get the full knowledge graph
app.get("/api/graph", (_req, res) => {
  res.json(repositories.graph.get());
});

app.post("/api/graph/inspect", (req, res) => {
  const selectedNodeIds = Array.isArray(req.body?.nodeIds)
    ? req.body.nodeIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (selectedNodeIds.length === 0) {
    res.status(400).json({ error: "nodeIds must contain at least one node id" });
    return;
  }

  res.json(buildGraphInspection(Array.from(new Set(selectedNodeIds))));
});

// API: List all sessions
app.get("/api/sessions", (_req, res) => {
  res.json(repositories.sessions.list());
});

app.get("/api/sessions/:id/delete-preview", (req, res) => {
  const preview = inspectSessionDeletionImpact(repositories, req.params.id, {
    reportsDir: REPORTS_DIR,
    generatedUiDir: GENERATED_UI_DIR,
  });

  if (!preview) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(preview);
});

app.delete("/api/sessions/:id", (req, res) => {
  const result = deleteSessionWithArtifacts(repositories, req.params.id, {
    reportsDir: REPORTS_DIR,
    generatedUiDir: GENERATED_UI_DIR,
  });

  if (!result) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({
    deleted: true,
    sessionId: req.params.id,
    ...result,
  });
});

// API: List all reports (id + topic + date)
app.get("/api/reports", (_req, res) => {
  if (!fs.existsSync(REPORTS_DIR)) {
    res.json([]);
    return;
  }
  const sessions = loadSessions();

  const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith(".md"));
  const list = files.map(f => {
    const id = f.replace(".md", "");
    const session = sessions[id];
    return {
      id,
      topic: session?.topic ?? "Unknown",
      avgScore: session?.evaluations?.length
        ? (session.evaluations.reduce((s: number, e: { score: number }) => s + e.score, 0) / session.evaluations.length).toFixed(1)
        : "N/A",
      date: session?.createdAt ?? null,
      file: `/api/reports/${id}`,
    };
  });
  res.json(list);
});

// AI-backed deeper dives are intentionally disabled in this package.
app.get("/api/debug/deeper-dives/:id", (_req, res) => {
  res.status(410).json({
    ok: false,
    error: "Deeper-dive generation is no longer available because AI calls are disabled.",
  });
});

// API: Get a single report as Markdown
app.get("/api/reports/:id", (req, res) => {
  const reportPath = path.join(REPORTS_DIR, `${req.params.id}.md`);
  if (!fs.existsSync(reportPath)) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.type("text/markdown").send(fs.readFileSync(reportPath, "utf8"));
});

app.get("/api/mistakes", (req, res) => {
  const topic = typeof req.query.topic === "string" ? req.query.topic : undefined;
  res.json(repositories.mistakes.list(topic));
});

app.get("/api/flashcards", (_req, res) => {
  res.json(loadFlashcards());
});

app.post("/api/flashcards/:id/review", (req, res) => {
  const cards = loadFlashcards();
  const idx = cards.findIndex(c => c.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Card not found" }); return; }

  const rating = Number(req.body.rating) as ReviewRating;
  if (![1, 2, 3, 4].includes(rating)) { res.status(400).json({ error: "rating must be 1–4" }); return; }

  const srs = applySM2(cards[idx], rating);
  cards[idx] = { ...cards[idx], ...srs, lastReviewedAt: new Date().toISOString() };
  saveFlashcards(cards);
  res.json(cards[idx]);
});

registerWeakReportRoutes(app, {
  generatedUiDir: GENERATED_UI_DIR,
  loadSessions,
  fsLike: fs,
});

app.listen(PORT, () => {
  console.log(`Neural map server running at http://localhost:${PORT}`);
});
