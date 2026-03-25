import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import type { ToolDeps } from "./deps.js";

function buildViewerHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Interview Report Viewer</title>
  <style>
    :root {
      --bg: #0b1220;
      --bg-soft: #111a2e;
      --card: #121c31;
      --card-elev: #18243d;
      --ink: #e5ecf7;
      --muted: #9db0d0;
      --accent: #4fd1c5;
      --accent-soft: #183a44;
      --line: #2a3957;
      --danger: #fca5a5;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px 18px;
      background:
        radial-gradient(circle at top right, #1d2a44 0%, var(--bg) 45%),
        linear-gradient(180deg, var(--bg), #090f1a);
      color: var(--ink);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }
    .wrap {
      max-width: 920px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 22px;
      box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35);
    }
    h1 { margin: 0; font-size: 1.35rem; }
    .meta { margin-top: 6px; color: var(--muted); font-size: 0.95rem; }
    .chips {
      margin-top: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .chip {
      border: 1px solid var(--line);
      background: var(--bg-soft);
      color: var(--ink);
      padding: 8px 12px;
      border-radius: 999px;
      cursor: pointer;
      transition: all .2s ease;
      font-weight: 600;
    }
    .chip:hover { border-color: var(--accent); transform: translateY(-1px); }
    .chip.active {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: #d9fffb;
    }
    .panels { margin-top: 18px; }
    .panel {
      display: none;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      background: var(--card-elev);
    }
    .panel.active { display: block; }
    .panel h2 { margin: 0 0 8px; font-size: 1.05rem; }
    .panel p,
    .panel pre {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 5;
      -webkit-box-orient: vertical;
      overflow: hidden;
      white-space: pre-wrap;
      font-family: inherit;
    }
    .row { margin-top: 12px; }
    .row h3 {
      margin: 0 0 6px;
      font-size: 0.92rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #c2d3ee;
    }
    .badge {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      background: #1d3d47;
      border: 1px solid #3fbeb2;
      color: #a9fff6;
      font-size: 0.78rem;
      font-weight: 600;
    }
    .error {
      margin-top: 12px;
      color: var(--danger);
      font-size: 0.95rem;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <h1 id="title">Interview Report</h1>
    <div class="meta" id="meta">Loading report...</div>
    <div class="error" id="error"></div>
    <div class="chips" id="chips"></div>
    <div class="panels" id="panels"></div>
  </main>
  <script>
    const titleEl = document.getElementById('title');
    const metaEl = document.getElementById('meta');
    const errorEl = document.getElementById('error');
    const chipsRoot = document.getElementById('chips');
    const panelsRoot = document.getElementById('panels');

    function activate(index) {
      const chips = chipsRoot.querySelectorAll('.chip');
      const panels = panelsRoot.querySelectorAll('.panel');
      chips.forEach((chip, i) => chip.classList.toggle('active', i === index));
      panels.forEach((panel, i) => panel.classList.toggle('active', i === index));
    }

    function appendMultilineText(target, text) {
      const parts = String(text || '').split(/\\n/);
      parts.forEach((line, i) => {
        if (i > 0) target.appendChild(document.createElement('br'));
        target.appendChild(document.createTextNode(line));
      });
    }

    function renderFullQuestions(questions) {
      chipsRoot.innerHTML = '';
      panelsRoot.innerHTML = '';

      questions.forEach((item, idx) => {
        const label = item.subject || ('Q' + item.questionNumber);
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = label;
        chip.addEventListener('click', () => activate(idx));
        chipsRoot.appendChild(chip);

        const panel = document.createElement('section');
        panel.className = 'panel';

        const heading = document.createElement('h2');
        heading.textContent = 'Q' + item.questionNumber + ': ' + item.question;
        if (typeof item.score === 'number') {
          const score = document.createElement('span');
          score.className = 'badge';
          score.textContent = item.score + '/5';
          heading.appendChild(score);
        }
        panel.appendChild(heading);

        const answerRow = document.createElement('div');
        answerRow.className = 'row';
        const answerTitle = document.createElement('h3');
        answerTitle.textContent = 'Candidate answer';
        const answerText = document.createElement('pre');
        appendMultilineText(answerText, item.candidateAnswer);
        answerRow.appendChild(answerTitle);
        answerRow.appendChild(answerText);
        panel.appendChild(answerRow);

        const feedbackRow = document.createElement('div');
        feedbackRow.className = 'row';
        const feedbackTitle = document.createElement('h3');
        feedbackTitle.textContent = 'Interviewer feedback';
        const feedbackText = document.createElement('p');
        appendMultilineText(feedbackText, item.interviewerFeedback);
        feedbackRow.appendChild(feedbackTitle);
        feedbackRow.appendChild(feedbackText);
        panel.appendChild(feedbackRow);

        const strongRow = document.createElement('div');
        strongRow.className = 'row';
        const strongTitle = document.createElement('h3');
        strongTitle.textContent = 'Strong answer';
        const strongText = document.createElement('p');
        appendMultilineText(strongText, item.strongAnswer);
        strongRow.appendChild(strongTitle);
        strongRow.appendChild(strongText);
        panel.appendChild(strongRow);

        panelsRoot.appendChild(panel);
      });

      if (questions.length > 0) activate(0);
    }

    async function load() {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('sessionId');
      if (!sessionId) {
        errorEl.textContent = 'Missing sessionId in URL. Example: ?sessionId=1772743307856-xe3eld';
        metaEl.textContent = 'No report loaded';
        return;
      }

      const dataUrl = './' + encodeURIComponent(sessionId) + '-report-ui.json';
      try {
        const res = await fetch(dataUrl, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Report dataset not found for session ' + sessionId);
        }
        const payload = await res.json();
        titleEl.textContent = payload.title || 'Interview Report';
        metaEl.textContent = 'Topic: ' + (payload.topic || 'Unknown') + ' | Session: ' + sessionId;
        renderFullQuestions(Array.isArray(payload.questions) ? payload.questions : []);
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : String(err);
        metaEl.textContent = 'Failed to load report dataset';
      }
    }

    load();
  </script>
</body>
</html>`;
}

export function registerGenerateReportUiTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "generate_report_ui",
    {
      description: "Generate a JSON dataset for report UI and return a reusable viewer URL.",
      inputSchema: {
        sessionId: z.string(),
        questions: z.array(z.object({
          questionNumber: z.number().int().min(1),
          question: z.string().min(1),
          candidateAnswer: z.string().min(1),
          interviewerFeedback: z.string().min(1),
          strongAnswer: z.string().min(1).describe("Strong answer in max 3 lines"),
          subject: z.string().min(1).optional(),
          score: z.number().int().min(1).max(5).optional(),
        })).min(1).max(50),
        title: z.string().optional(),
      },
    },
    async ({ sessionId, questions, title }) => {
      const sessions = deps.loadSessions();
      const session = sessions[sessionId];
      if (!session) return deps.stateError(`Session '${sessionId}' not found.`);
      if (session.state !== "ENDED") return deps.stateError(`Session '${sessionId}' is not ended yet.`);

      const overLimit = questions.find((q) => deps.countLines(q.strongAnswer) > 3);
      if (overLimit) {
        return deps.stateError(`Strong answer for question ${overLimit.questionNumber} must be at most 3 lines.`);
      }

      deps.ensureGeneratedUiDir();
      const safeTitle = title?.trim() || `Interview Report — ${session.topic}`;

      const datasetFileName = `${session.id}-report-ui.json`;
      const datasetPath = path.join(deps.generatedUiDir, datasetFileName);
      const viewerFileName = "report-ui.html";
      const viewerPath = path.join(deps.generatedUiDir, viewerFileName);

      const payload = {
        sessionId,
        topic: session.topic,
        title: safeTitle,
        generatedAt: new Date().toISOString(),
        questions,
      };

      for (const item of questions) {
        const evaluation = session.evaluations.find((e) =>
          e.questionIndex === item.questionNumber - 1 &&
          e.question === item.question &&
          e.answer === item.candidateAnswer
        );
        if (evaluation) evaluation.strongAnswer = item.strongAnswer;
      }

      sessions[sessionId] = session;
      deps.saveSessions(sessions);
      deps.saveReport(session);

      deps.writeTextFile(datasetPath, JSON.stringify(payload, null, 2));
      if (!fs.existsSync(viewerPath)) {
        deps.writeTextFile(viewerPath, buildViewerHtml());
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            topic: session.topic,
            mode: "questions",
            entries: questions.length,
            datasetFile: datasetPath,
            datasetUrl: `http://localhost:${deps.uiPort}/generated/${datasetFileName}`,
            viewerFile: viewerPath,
            uiUrl: `http://localhost:${deps.uiPort}/generated/${viewerFileName}?sessionId=${encodeURIComponent(sessionId)}`,
          }),
        }],
      };
    }
  );
}
