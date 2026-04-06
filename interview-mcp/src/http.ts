import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { registerWeakReportRoutes } from "./http/weakReports.js";
import { applySM2 } from "./srsUtils.js";
import { FileKnowledgeStore } from "./knowledge/file.js";
import { buildSessionRewardSummary, detectTopicLevel } from "./tools/getTopicLevel.js";
import type {
  ReviewRating,
  Flashcard,
  FlashcardAnswer,
  Session,
  GraphInspectionResult,
  GraphInspectionSession,
  ProgressSessionKind,
  TopicPlanPriority,
} from "@mock-interview/shared";
import { randomUUID } from "crypto";
import { createDb } from "./db/client.js";
import { createSqliteRepositories } from "./db/repositories/createRepositories.js";
import { canonicalizeConceptWord } from "./graph/concepts.js";
import { deleteSessionWithArtifacts, inspectSessionDeletionImpact } from "./sessions/admin.js";
import { buildSessionLaunchPrompt } from "./sessions/launchPrompt.js";
import { buildProgressOverview } from "./progress.js";
import { createScopedInterviewSession, DEFAULT_FOCUS } from "./scopedInterview/session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const GENERATED_UI_DIR = path.join(PUBLIC_DIR, "generated");
const KNOWLEDGE_DIR = path.join(DATA_DIR, "knowledge");

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "127.0.0.1";
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

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseProgressSessionKind(value: unknown): ProgressSessionKind {
  if (value === "interview" || value === "study" || value === "drill" || value === "warmup" || value === "all") {
    return value;
  }
  return "interview";
}

function listKnowledgeTopics() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return [] as Array<{ file: string; displayName: string }>;
  return fs.readdirSync(KNOWLEDGE_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf8");
      const match = content.match(/^#\s+(.+)/m);
      return {
        file: file.replace(".md", ""),
        displayName: match ? match[1].trim() : file.replace(".md", ""),
      };
    });
}

function normalizeTopicPlanKey(topic: string) {
  const normalizedTopic = topic.trim().toLowerCase();
  const match = listKnowledgeTopics().find((entry) =>
    entry.file.toLowerCase() === normalizedTopic || entry.displayName.toLowerCase() === normalizedTopic
  );
  return match?.file ?? topic;
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

// API: List available interview topics from knowledge files
app.get("/api/topics", (_req, res) => {
  res.json(listKnowledgeTopics());
});

// API: Get the recommended warm-up level for a topic
app.get("/api/topics/:topic/level", (req, res) => {
  const topic = decodeURIComponent(req.params.topic);
  const store = new FileKnowledgeStore(KNOWLEDGE_DIR);
  const knowledgeTopic = store.findByTopic(topic);
  const hasWarmupContent =
    knowledgeTopic != null &&
    knowledgeTopic.warmupLevels != null &&
    Object.keys(knowledgeTopic.warmupLevels).length > 0;

  const sessions = loadSessions();
  const { level, status, reason, nextLevelRequirement, progress } = detectTopicLevel(topic, sessions, hasWarmupContent);
  res.json({ topic, level, status, reason, nextLevelRequirement, hasWarmupContent, progress });
});

app.get("/api/topic-plans", (_req, res) => {
  res.json(
    repositories.topicPlans.list().map((plan) => ({
      ...plan,
      topic: normalizeTopicPlanKey(plan.topic),
    }))
  );
});

app.put("/api/topic-plans/:topic", (req, res) => {
  const topic = normalizeTopicPlanKey(decodeURIComponent(req.params.topic));
  const focused = typeof req.body?.focused === "boolean" ? req.body.focused : false;
  const priority = req.body?.priority;
  const existingPlan = repositories.topicPlans.list().find((plan) => normalizeTopicPlanKey(plan.topic) === topic);

  if (priority !== "core" && priority !== "secondary" && priority !== "optional") {
    res.status(400).json({ error: "priority must be one of: core, secondary, optional" });
    return;
  }

  res.json(repositories.topicPlans.upsert({
    topic,
    focused,
    priority: priority as TopicPlanPriority,
    updatedAt: new Date().toISOString(),
    lastLevelUpAt: existingPlan?.lastLevelUpAt,
    lastUnlockedLevel: existingPlan?.lastUnlockedLevel,
  }));
});

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

app.get("/api/progress", (req, res) => {
  const progress = buildProgressOverview(loadSessions(), {
    sessionKind: parseProgressSessionKind(req.query.sessionKind),
    weakScoreThreshold: parseBoundedInt(req.query.weakScoreThreshold, 3, 1, 5),
    recentSessionsLimit: parseBoundedInt(req.query.recentSessionsLimit, 6, 1, 20),
    topicLimit: parseBoundedInt(req.query.topicLimit, 10, 1, 20),
  });

  res.json(progress);
});

// API: List all sessions
app.get("/api/sessions", (_req, res) => {
  res.json(repositories.sessions.list());
});

app.post("/api/scoped-interviews", (req, res) => {
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  const focus = typeof req.body?.focus === "string" && req.body.focus.trim().length > 0
    ? req.body.focus.trim()
    : DEFAULT_FOCUS;

  if (!topic) {
    res.status(400).json({ error: "topic is required" });
    return;
  }

  if (content.length < 20) {
    res.status(400).json({ error: "content must be at least 20 characters" });
    return;
  }

  const result = createScopedInterviewSession({
    topic,
    rawContent: content,
    focus,
    generateId: () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

  repositories.sessions.save(result.session);

  res.status(201).json({
    sessionId: result.session.id,
    state: result.session.state,
    topic: result.session.topic,
    interviewType: result.session.interviewType,
    focusArea: result.focusArea,
    source: result.source,
    parsed: result.parsed,
    totalQuestions: result.totalQuestions,
    previewQuestions: result.previewQuestions,
    normalizedContent: result.normalizedContent,
    detectedContentType: result.detectedContentType,
    nextTool: "ask_question",
  });
});

app.get("/api/sessions/:id/reward-summary", (req, res) => {
  const session = repositories.sessions.list().find((candidate) => candidate.id === req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.state !== "ENDED") {
    res.status(409).json({ error: "Session is not finalized yet" });
    return;
  }

  const store = new FileKnowledgeStore(KNOWLEDGE_DIR);
  const knowledgeTopic = store.findByTopic(session.topic);
  const hasWarmupContent =
    knowledgeTopic != null &&
    knowledgeTopic.warmupLevels != null &&
    Object.keys(knowledgeTopic.warmupLevels).length > 0;

  res.json(buildSessionRewardSummary(session, loadSessions(), hasWarmupContent));
});

app.get("/api/sessions/:id/launch-prompt", (req, res) => {
  const session = repositories.sessions.getById(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(buildSessionLaunchPrompt(session));
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

app.get("/api/sessions/:id/report-ui", (req, res) => {
  const session = repositories.sessions.getById(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const datasetPath = path.join(GENERATED_UI_DIR, `${req.params.id}-report-ui.json`);
  if (!fs.existsSync(datasetPath)) {
    res.json({
      ready: false,
      sessionId: session.id,
      state: session.state,
      message: session.state === "ENDED"
        ? "Report UI dataset has not been generated yet."
        : "Interview is still in progress. Report UI will be available after the interview is finished.",
    });
    return;
  }

  res.json({
    ready: true,
    sessionId: session.id,
    state: session.state,
    dataset: JSON.parse(fs.readFileSync(datasetPath, "utf8")),
  });
});

app.get("/api/mistakes", (req, res) => {
  const topic = typeof req.query.topic === "string" ? req.query.topic : undefined;
  res.json(repositories.mistakes.list(topic));
});

app.get("/api/flashcards", (req, res) => {
  const includeArchived = req.query.includeArchived === "true";
  const cards = loadFlashcards();
  res.json(includeArchived ? cards : cards.filter((card) => !card.archivedAt));
});

app.post("/api/flashcards/:id/review", (req, res) => {
  const cards = loadFlashcards();
  const idx = cards.findIndex(c => c.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Card not found" }); return; }
  if (cards[idx]?.archivedAt) { res.status(409).json({ error: "Card is archived" }); return; }

  const rating = Number(req.body.rating) as ReviewRating;
  if (![1, 2, 3, 4].includes(rating)) { res.status(400).json({ error: "rating must be 1–4" }); return; }

  const srs = applySM2(cards[idx], rating);
  cards[idx] = { ...cards[idx], ...srs, lastReviewedAt: new Date().toISOString() };
  saveFlashcards(cards);
  res.json(cards[idx]);
});

app.post("/api/flashcards/:id/archive", (req, res) => {
  const cards = loadFlashcards();
  const idx = cards.findIndex(c => c.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Card not found" }); return; }

  const archivedAt = cards[idx]?.archivedAt ?? new Date().toISOString();
  cards[idx] = { ...cards[idx], archivedAt };
  saveFlashcards(cards);
  res.json(cards[idx]);
});

app.post("/api/flashcards/:id/answers", (req, res) => {
  const flashcardId = req.params.id;
  const cards = loadFlashcards();
  const card = cards.find(c => c.id === flashcardId);
  if (!card) { res.status(404).json({ error: "Card not found" }); return; }
  if (card.archivedAt) { res.status(409).json({ error: "Card is archived" }); return; }

  const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
  if (!content) { res.status(400).json({ error: "content is required and must not be empty" }); return; }

  const smRating = req.body.smRating != null ? Number(req.body.smRating) : undefined;
  if (smRating !== undefined && ![1, 2, 3, 4].includes(smRating)) {
    res.status(400).json({ error: "smRating must be 1–4" }); return;
  }

  const answer: FlashcardAnswer = {
    id: randomUUID(),
    flashcardId,
    content,
    state: "Pending",
    smRating: smRating as FlashcardAnswer["smRating"],
    createdAt: new Date().toISOString(),
  };

  repositories.flashcardAnswers.insert(answer);
  res.status(201).json(answer);
});

app.post("/api/flashcards/:id/unarchive", (req, res) => {
  const cards = loadFlashcards();
  const idx = cards.findIndex(c => c.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Card not found" }); return; }

  cards[idx] = { ...cards[idx], archivedAt: undefined };
  saveFlashcards(cards);
  res.json(cards[idx]);
});

registerWeakReportRoutes(app, {
  generatedUiDir: GENERATED_UI_DIR,
  loadSessions,
  fsLike: fs,
});

app.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Neural map server running at http://${displayHost}:${PORT} (bound to ${HOST})`);
});
