import dotenv from "dotenv";
if (!process.env.ANTHROPIC_API_KEY) dotenv.config({ override: true });
else dotenv.config();

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { createAIProvider, type AIProvider } from "./ai/index.js";
import type { KnowledgeGraph, Session } from "./types.js";
import {
  calcAvgScore,
  buildSummary,
  buildReport,
  escapeHtml,
  serializeForInlineScript,
  countLines,
  pickSessionByTopic,
  extractWeakSubjects,
  buildFullQuestionContext,
} from "./reportUtils.js";
import { registerAllTools } from "./tools/registerAllTools.js";
import type { ToolDeps } from "./tools/deps.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AI_ENABLED = process.env.AI_ENABLED !== "false";
const ai: AIProvider | null = AI_ENABLED ? createAIProvider() : null;

// ─────────────────────────────────────────────────────────────────────────────
// Data paths — report-mcp shares the interview-mcp data directory.
//
// Both services live as siblings under the same workspace:
//   <workspace>/
//   ├── interview-mcp/   ← owns the data + public dirs
//   └── report-mcp/      ← reads sessions/graph, writes reports + generated UI
//
// Override with DATA_DIR / PUBLIC_DIR env vars if the layout differs.
// ─────────────────────────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR
  ?? path.resolve(__dirname, "../../interview-mcp/data");
const PUBLIC_DIR = process.env.PUBLIC_DIR
  ?? path.resolve(__dirname, "../../interview-mcp/public");

const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const GRAPH_FILE = path.join(DATA_DIR, "graph.json");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const GENERATED_UI_DIR = path.join(PUBLIC_DIR, "generated");
const UI_PORT = process.env.PORT ?? "3001";

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function stateError(msg: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
  };
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

function saveReport(session: Session): string {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filename = path.join(REPORTS_DIR, `${session.id}.md`);
  fs.writeFileSync(filename, buildReport(session));
  return filename;
}

function ensureGeneratedUiDir() {
  if (!fs.existsSync(GENERATED_UI_DIR)) fs.mkdirSync(GENERATED_UI_DIR, { recursive: true });
}

const server = new McpServer({
  name: "report-mcp",
  version: "0.1.0",
});

const deps: ToolDeps = {
  ai,
  uiPort: UI_PORT,
  generatedUiDir: GENERATED_UI_DIR,
  stateError,
  loadSessions,
  saveSessions,
  loadGraph,
  saveReport,
  ensureGeneratedUiDir,
  writeTextFile: (filePath, content) => fs.writeFileSync(filePath, content),
  calcAvgScore,
  buildSummary,
  pickSessionByTopic,
  extractWeakSubjects,
  buildFullQuestionContext,
  countLines,
  escapeHtml,
  serializeForInlineScript,
};

registerAllTools(server, deps);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `report-mcp v0.1.0 — mode: ${AI_ENABLED ? "AI enabled" : "AI disabled"} — ` +
    `data: ${DATA_DIR} — running on stdio`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
