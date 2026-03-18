import type { Express } from "express";
import path from "path";
import type { Session } from "@mock-interview/shared";

interface SessionMeta {
  topic?: string;
  createdAt?: string;
  endedAt?: string;
}

type SessionsById = Record<string, SessionMeta>;

export interface WeakReportsDeps {
  generatedUiDir: string;
  loadSessions(): Record<string, Session>;
  fsLike: {
    existsSync(path: string): boolean;
    readdirSync(path: string): string[];
    readFileSync(path: string, encoding: "utf8"): string;
  };
}

function loadSessions(deps: WeakReportsDeps): SessionsById {
  return deps.loadSessions();
}

export function registerWeakReportRoutes(app: Express, deps: WeakReportsDeps) {
  app.get("/api/weak-reports", (_req, res) => {
    if (!deps.fsLike.existsSync(deps.generatedUiDir)) {
      res.json([]);
      return;
    }

    const sessions = loadSessions(deps);
    const files = deps.fsLike.readdirSync(deps.generatedUiDir)
      .filter((f) => f.endsWith("-weak-subjects.html"))
      .sort((a, b) => b.localeCompare(a));

    const list = files.map((file) => {
      const sessionId = file.replace("-weak-subjects.html", "");
      const session = sessions[sessionId];

      return {
        sessionId,
        topic: session?.topic ?? "Unknown",
        createdAt: session?.createdAt ?? null,
        endedAt: session?.endedAt ?? null,
        file: `/generated/${file}`,
        apiFile: `/api/weak-reports/${sessionId}`,
      };
    });

    res.json(list);
  });

  app.get("/api/weak-reports/:id", (req, res) => {
    const filePath = path.join(deps.generatedUiDir, `${req.params.id}-weak-subjects.html`);
    if (!deps.fsLike.existsSync(filePath)) {
      res.status(404).json({ error: "Weak subject UI not found" });
      return;
    }
    res.type("text/html").send(deps.fsLike.readFileSync(filePath, "utf8"));
  });
}
