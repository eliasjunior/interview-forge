import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";
import type { WarmUpLevel } from "@mock-interview/shared";

// ─────────────────────────────────────────────────────────────────────────────
// Level detection logic
// ─────────────────────────────────────────────────────────────────────────────

/** Score threshold (out of 5) required to advance to the next warm-up level. */
const ADVANCE_THRESHOLD = 4.0;

/** Full interview avg score below this triggers a drop back to warm-up. */
const DROP_THRESHOLD = 2.5;

function calcAvg(scores: number[]): number | null {
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Semantic status of the topic, separate from the routing `level`:
 * - 'cold'    — never attempted; no sessions exist
 * - 'warmup'  — currently working through the warm-up ladder (L0–L2)
 * - 'dropped' — fell back from interview due to a poor score
 * - 'ready'   — completed warm-up or has a good interview score
 */
export type TopicStatus = 'cold' | 'warmup' | 'dropped' | 'ready';

export function detectTopicLevel(
  topic: string,
  sessions: Record<string, import("@mock-interview/shared").Session>,
  hasWarmupContent: boolean
): {
  level: WarmUpLevel;
  status: TopicStatus;
  reason: string;
  nextLevelRequirement: string;
} {
  const normalise = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, "");
  const topicNorm = normalise(topic);

  const topicSessions = Object.values(sessions).filter(
    (s) => normalise(s.topic) === topicNorm && s.state === "ENDED"
  );

  if (!topicSessions.length) {
    // Always start at L0 for untouched topics.
    // If no warm-up content exists, start_warm_up will fail gracefully and the
    // orchestrator can fall back to start_interview directly.
    return {
      level: 0,
      status: 'cold',
      reason: "No sessions found for this topic — start from Level 0.",
      nextLevelRequirement: hasWarmupContent
        ? "Complete Level 0 warm-up with avg score ≥ 4.0 to advance."
        : "Complete Level 0 warm-up (MCQ generated from topic questions) with avg score ≥ 4.0 to advance.",
    };
  }

  // Find all ended full interview sessions for this topic
  const interviewSessions = topicSessions.filter(
    (s) => !s.sessionKind || s.sessionKind === "interview"
  );

  // Check if already interview-ready via full interview performance
  if (interviewSessions.length > 0) {
    const latestInterview = interviewSessions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const scores = latestInterview.evaluations.map((e) => e.score);
    const avg = calcAvg(scores);

    if (avg !== null && avg >= 3.0) {
      return {
        level: 3,
        status: 'ready' as TopicStatus,
        reason: `Last full interview avg score ${avg.toFixed(1)} — interview-ready. Use start_interview to continue.`,
        nextLevelRequirement: "Already at Level 3 — keep practising full interviews.",
      };
    }

    if (avg !== null && avg < DROP_THRESHOLD) {
      return {
        level: 1,
        status: 'dropped' as TopicStatus,
        reason: `Last full interview avg score ${avg.toFixed(1)} — needs reinforcement. Warm-up recommended before next interview.`,
        nextLevelRequirement: `Complete Level 1 warm-up with avg score ≥ ${ADVANCE_THRESHOLD} to return to full interview.`,
      };
    }
  }

  if (!hasWarmupContent) {
    return {
      level: 3,
      status: 'ready' as TopicStatus,
      reason: "No warm-up content authored for this topic — continue with full interviews.",
      nextLevelRequirement: "Complete a full interview session.",
    };
  }

  // Determine highest warmup level passed
  const warmupSessions = topicSessions.filter((s) => s.sessionKind === "warmup");

  // Group by questLevel, keep the best (highest avg) session per level
  const bestAvgByLevel = new Map<number, number>();
  for (const s of warmupSessions) {
    const lvl = s.questLevel ?? 0;
    const scores = s.evaluations.map((e) => e.score);
    const avg = calcAvg(scores);
    if (avg === null) continue;
    const current = bestAvgByLevel.get(lvl) ?? -1;
    if (avg > current) bestAvgByLevel.set(lvl, avg);
  }

  // Walk levels 0 → 1 → 2 and find the first one not yet passed
  for (const lvl of [0, 1, 2] as const) {
    const avg = bestAvgByLevel.get(lvl);
    if (avg === undefined || avg < ADVANCE_THRESHOLD) {
      const attempted = avg !== undefined;
      return {
        level: lvl,
        status: 'warmup' as TopicStatus,
        reason: attempted
          ? `Level ${lvl} warm-up attempted (best avg ${avg!.toFixed(1)}) — below threshold. Practice again.`
          : `Level ${lvl} warm-up not yet attempted.`,
        nextLevelRequirement: `Score avg ≥ ${ADVANCE_THRESHOLD} on Level ${lvl} warm-up to advance to Level ${lvl + 1}.`,
      };
    }
  }

  // All three warmup levels passed
  return {
    level: 3,
    status: 'ready' as TopicStatus,
    reason: "All warm-up levels completed — interview-ready. Use start_interview.",
    nextLevelRequirement: "Already at Level 3 — use start_interview for full practice.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP tool registration
// ─────────────────────────────────────────────────────────────────────────────

export function registerGetTopicLevelTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "get_topic_level",
    {
      description:
        "Returns the recommended warm-up level (0–3) for a topic based on session history. " +
        "Level 0 = cold start (MCQ recognition), Level 1 = fill-in-blank recall, " +
        "Level 2 = guided answer, Level 3 = ready for full interview. " +
        "Use before start_warm_up or start_interview to route the user correctly.",
      inputSchema: z.object({
        topic: z.string().describe("The topic to check, e.g. 'JWT authentication'"),
      }),
    },
    async ({ topic }) => {
      const sessions = deps.loadSessions();
      const knowledgeTopic = deps.knowledge.findByTopic(topic);
      const hasWarmupContent =
        knowledgeTopic != null &&
        knowledgeTopic.warmupLevels != null &&
        Object.keys(knowledgeTopic.warmupLevels).length > 0;

      const result = detectTopicLevel(topic, sessions, hasWarmupContent);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            topic,
            level: result.level,
            status: result.status,
            reason: result.reason,
            nextLevelRequirement: result.nextLevelRequirement,
            hasWarmupContent,
            instruction:
              result.level < 3
                ? `Call start_warm_up { topic: "${topic}", level: ${result.level} } to begin the warm-up.`
                : `Call start_interview { topic: "${topic}" } — candidate is interview-ready.`,
          }),
        }],
      };
    }
  );
}
