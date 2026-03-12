import dotenv from "dotenv";
if (!process.env.ANTHROPIC_API_KEY) dotenv.config({ override: true });
else dotenv.config();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { createAIProvider, type AIProvider } from "./ai/index.js";
import { registerWeakReportRoutes } from "./http/weakReports.js";

const ai: AIProvider = createAIProvider();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const GENERATED_UI_DIR = path.join(PUBLIC_DIR, "generated");

const PORT = process.env.PORT ?? 3001;

const app = express();
app.use(cors());
app.use(express.json());

// Serve the neural map frontend
app.use(express.static(PUBLIC_DIR));

// API: Get the full knowledge graph
app.get("/api/graph", (_req, res) => {
  const graphPath = path.join(DATA_DIR, "graph.json");
  if (!fs.existsSync(graphPath)) {
    res.json({ nodes: [], edges: [], sessions: [] });
    return;
  }
  res.json(JSON.parse(fs.readFileSync(graphPath, "utf8")));
});

// API: List all sessions
app.get("/api/sessions", (_req, res) => {
  const sessionsPath = path.join(DATA_DIR, "sessions.json");
  if (!fs.existsSync(sessionsPath)) {
    res.json([]);
    return;
  }
  const sessions = JSON.parse(fs.readFileSync(sessionsPath, "utf8"));
  res.json(Object.values(sessions));
});

// API: List all reports (id + topic + date)
app.get("/api/reports", (_req, res) => {
  if (!fs.existsSync(REPORTS_DIR)) {
    res.json([]);
    return;
  }
  const sessionsPath = path.join(DATA_DIR, "sessions.json");
  const sessions = fs.existsSync(sessionsPath)
    ? JSON.parse(fs.readFileSync(sessionsPath, "utf8"))
    : {};

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

// DEBUG: Test deeper dive generation for a session
app.get("/api/debug/deeper-dives/:id", async (req, res) => {
  const sessionsPath = path.join(DATA_DIR, "sessions.json");
  if (!fs.existsSync(sessionsPath)) { res.status(404).json({ error: "No sessions" }); return; }
  const sessions = JSON.parse(fs.readFileSync(sessionsPath, "utf8"));
  const session = sessions[req.params.id];
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  try {
    const dives = await ai.generateDeeperDives(session.topic, session.evaluations);
    res.json({ ok: true, count: dives.filter(Boolean).length, dives });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ ok: false, error: msg });
  }
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

registerWeakReportRoutes(app, {
  generatedUiDir: GENERATED_UI_DIR,
  sessionsFile: path.join(DATA_DIR, "sessions.json"),
  fsLike: fs,
});

app.listen(PORT, () => {
  console.log(`Neural map server running at http://localhost:${PORT}`);
});
