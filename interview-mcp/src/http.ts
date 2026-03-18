import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { registerWeakReportRoutes } from "./http/weakReports.js";
import { applySM2 } from "./srsUtils.js";
import type { ReviewRating, Flashcard, Session } from "@mock-interview/shared";
import { createDb } from "./db/client.js";
import { createSqliteRepositories } from "./db/repositories/createRepositories.js";

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

// API: Get the full knowledge graph
app.get("/api/graph", (_req, res) => {
  res.json(repositories.graph.get());
});

// API: List all sessions
app.get("/api/sessions", (_req, res) => {
  res.json(repositories.sessions.list());
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
