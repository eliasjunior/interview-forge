import dotenv from "dotenv";
if (!process.env.ANTHROPIC_API_KEY) dotenv.config({ override: true });
else dotenv.config();

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { createAIProvider, type AIProvider } from "./ai/index.js";
import { createKnowledgeStore, type KnowledgeStore } from "./knowledge/index.js";
import type { Session, Concept, KnowledgeGraph } from "./types.js";
import {
  assertState,
  generateId,
  findLast,
  calcAvgScore,
  buildSummary,
  buildReport,
  buildTranscript,
  mergeConceptsIntoGraph,
} from "./interviewUtils.js";
import { registerAllTools } from "./tools/registerAllTools.js";
import type { ToolDeps } from "./tools/deps.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AI_ENABLED = process.env.AI_ENABLED !== "false";
const ai: AIProvider | null = AI_ENABLED ? createAIProvider() : null;
const knowledge: KnowledgeStore = createKnowledgeStore();

function stateError(msg: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
  };
}

const DATA_DIR = path.resolve(__dirname, "../data");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const GRAPH_FILE = path.join(DATA_DIR, "graph.json");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const UI_PORT = process.env.PORT ?? "3001";

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSessions(): Record<string, Session> {
  ensureDataDir();
  if (!fs.existsSync(SESSIONS_FILE)) return {};
  return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8"));
}

function saveSessions(sessions: Record<string, Session>) {
  ensureDataDir();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function loadGraph(): KnowledgeGraph {
  ensureDataDir();
  if (!fs.existsSync(GRAPH_FILE)) return { nodes: [], edges: [], sessions: [] };
  return JSON.parse(fs.readFileSync(GRAPH_FILE, "utf-8"));
}

function saveGraph(graph: KnowledgeGraph) {
  ensureDataDir();
  fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2));
}

function saveReport(session: Session) {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filename = path.join(REPORTS_DIR, `${session.id}.md`);
  fs.writeFileSync(filename, buildReport(session));
  return filename;
}

async function extractConcepts(session: Session): Promise<Concept[]> {
  const entry = knowledge.findByTopic(session.topic);
  if (entry && entry.concepts.length > 0) {
    console.error(`[knowledge] using pre-defined concepts for "${session.topic}"`);
    return entry.concepts;
  }
  if (ai) {
    return ai.extractConcepts(session.topic, buildTranscript(session));
  }
  console.error(`[knowledge] no concepts found for "${session.topic}" and AI is disabled — returning empty`);
  return [];
}

async function finalizeSession(session: Session, sessions: Record<string, Session>) {
  const concepts = await extractConcepts(session);

  const summary = buildSummary(session);
  const avgScore = calcAvgScore(session.evaluations);

  session.state = "ENDED";
  session.summary = summary;
  session.concepts = concepts;
  session.endedAt = new Date().toISOString();
  saveSessions(sessions);

  const graph = loadGraph();
  saveGraph(mergeConceptsIntoGraph(graph, concepts, session.id));
  const reportFile = saveReport(session);

  return { summary, avgScore, concepts, reportFile };
}

const server = new McpServer({
  name: "interview-mcp",
  version: "0.2.0",
});

const deps: ToolDeps = {
  ai,
  knowledge,
  uiPort: UI_PORT,
  stateError,
  loadSessions,
  saveSessions,
  loadGraph,
  saveGraph,
  saveReport,
  generateId,
  assertState,
  findLast,
  calcAvgScore,
  buildSummary,
  finalizeSession,
};

registerAllTools(server, deps);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`interview-mcp v0.2.0 — mode: ${AI_ENABLED ? "AI + knowledge files" : "knowledge files only"} — running on stdio`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
