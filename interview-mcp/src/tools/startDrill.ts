import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Session } from "@mock-interview/shared";
import { buildDrillCustomContent, buildRecallContext } from "../drills/contentBuilder.js";
import type { ToolDeps } from "./deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// start_drill
//
// Starts a targeted drill on weak spots from a past interview session.
//
// Flow:
//   1. Find completed sessions for the topic
//   2. Extract evaluations where score < WEAK_THRESHOLD
//   3. Load logged mistakes for the topic
//   4. Build recallContext (past mistakes + weak areas) — returned to Claude
//      so it can run the recall step before asking the first question
//   5. Build customContent (rubric context for evaluate_answer)
//   6. Create a new session tagged sessionKind: "drill"
//
// If no completed sessions exist for the topic → error, full interview required.
// ─────────────────────────────────────────────────────────────────────────────

const WEAK_THRESHOLD = 4;

export function registerStartDrillTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "start_drill",
    {
      description: "Start a targeted drill on weak spots from a past interview. " +
      "Pulls questions where score < 4 and logged mistakes for the topic, " +
      "builds a focused session, and surfaces a recall prompt before drilling. " +
      "Requires at least one completed interview on the topic. " +
      "If no past sessions exist, returns an error pointing to start_interview.",
      inputSchema: {
        topic: z.string().describe("Topic to drill on, e.g. 'Java OS & JVM Internals'"),
        sessionId: z.string().optional().describe(
          "Optional: target a specific past session. If omitted, uses the most recent completed session for the topic."
        ),
      },
    },
    async ({ topic, sessionId }) => {
      const sessions = deps.loadSessions();

      // ── 1. Find completed sessions for this topic ────────────────────────────
      const topicSessions = Object.values(sessions).filter(s =>
        s.topic.toLowerCase() === topic.toLowerCase() &&
        s.state === "ENDED" &&
        s.evaluations.length > 0
      );

      if (topicSessions.length === 0) {
        return deps.stateError(
          `No completed sessions found for "${topic}". ` +
          `Complete a full interview first: start_interview { topic: "${topic}" }.`
        );
      }

      // ── 2. Pick target session ───────────────────────────────────────────────
      let targetSession: Session;
      if (sessionId) {
        const found = sessions[sessionId];
        if (!found) return deps.stateError(`Session "${sessionId}" not found.`);
        if (found.state !== "ENDED") return deps.stateError(`Session "${sessionId}" is not completed yet.`);
        targetSession = found;
      } else {
        targetSession = topicSessions.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
      }

      // ── 3. Extract weak evaluations ──────────────────────────────────────────
      const weakEvals = targetSession.evaluations.filter(e => e.score < WEAK_THRESHOLD);

      // ── 4. Load mistakes for this topic ─────────────────────────────────────
      const mistakes = deps.loadMistakes(topic);

      if (weakEvals.length === 0 && mistakes.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "no_weak_spots",
              topic,
              message:
                `No weak spots found for "${topic}" — all questions scored ≥ ${WEAK_THRESHOLD}. ` +
                `Consider a new full interview to find fresh gaps.`,
              avgScore: deps.calcAvgScore(targetSession.evaluations),
              sourceSessionId: targetSession.id,
            }),
          }],
        };
      }

      // ── 5. Build customContent + recall context ─────────────────────────────
      const avgScore = deps.calcAvgScore(targetSession.evaluations);
      const customContent = buildDrillCustomContent(
        topic,
        targetSession.id,
        targetSession.createdAt,
        avgScore,
        weakEvals,
        mistakes
      );
      const recallContext = buildRecallContext(weakEvals, mistakes);

      // ── 7. Create drill session ──────────────────────────────────────────────
      const drillQuestions = weakEvals.map(e => e.question);
      const newId = deps.generateId();

      const drillSession: Session = {
        id: newId,
        topic,
        interviewType: "design",
        sessionKind: "drill",
        state: "ASK_QUESTION",
        currentQuestionIndex: 0,
        questions: drillQuestions,
        messages: [],
        evaluations: [],
        customContent,
        focusArea: `Targeted drill — improve weak answers from session ${targetSession.id}`,
        createdAt: new Date().toISOString(),
        knowledgeSource: "file",
      };

      sessions[newId] = drillSession;
      deps.saveSessions(sessions);

      console.error(
        `[start_drill] topic="${topic}" sourceSession=${targetSession.id} ` +
        `weakQuestions=${weakEvals.length} mistakes=${mistakes.length}`
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId: newId,
            state: drillSession.state,
            topic,
            sessionKind: "drill",
            sourceSessionId: targetSession.id,
            totalDrillQuestions: drillQuestions.length,
            recallContext,
            nextTool: "ask_question",
            instruction:
              "IMPORTANT — run the recall step before asking the first question: " +
              "(1) Show the candidate their known mistakes and weak areas from recallContext. " +
              "(2) Ask: 'What do you remember about these areas? Where do you think you will struggle?' " +
              "(3) Wait for their response. " +
              "(4) Then call ask_question to begin the drill.",
          }, null, 2),
        }],
      };
    }
  );
}
