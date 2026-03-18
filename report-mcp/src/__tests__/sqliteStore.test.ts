import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { SQLiteReportDataStore } from "../data/sqlite.js";

const tempDirs: string[] = [];
const __dirname = path.dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDbCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-mcp-db-test-"));
  tempDirs.push(dir);

  const sourceDb = path.resolve(__dirname, "../../../interview-mcp/data/app.db");
  const targetDb = path.join(dir, "app.db");
  fs.copyFileSync(sourceDb, targetDb);

  return dir;
}

describe("SQLiteReportDataStore", () => {
  test("loads sessions and graph from the shared app.db", () => {
    const dataDir = makeTempDbCopy();
    const store = new SQLiteReportDataStore({ dataDir });

    try {
      const sessions = store.loadSessions();
      const graph = store.loadGraph();

      assert.ok(Object.keys(sessions).length > 0);
      assert.ok(graph.nodes.length > 0);
    } finally {
      store.close();
    }
  });

  test("saveSessions persists changes back to the copied database", () => {
    const dataDir = makeTempDbCopy();
    const store = new SQLiteReportDataStore({ dataDir });

    try {
      const sessions = store.loadSessions();
      const firstId = Object.keys(sessions)[0];
      assert.ok(firstId);

      sessions[firstId] = {
        ...sessions[firstId],
        summary: "updated by report-mcp sqlite store test",
      };

      store.saveSessions(sessions);

      const reloaded = store.loadSessions();
      assert.equal(reloaded[firstId].summary, "updated by report-mcp sqlite store test");
    } finally {
      store.close();
    }
  });

  test("saveSessions does not wipe graph data", () => {
    const dataDir = makeTempDbCopy();
    const store = new SQLiteReportDataStore({ dataDir });

    try {
      const before = store.loadGraph();
      const sessions = store.loadSessions();
      const firstId = Object.keys(sessions)[0];
      assert.ok(firstId);

      sessions[firstId] = {
        ...sessions[firstId],
        summary: "graph-preserving update",
      };

      store.saveSessions(sessions);

      const after = store.loadGraph();
      assert.deepEqual(after, before);
    } finally {
      store.close();
    }
  });
});
