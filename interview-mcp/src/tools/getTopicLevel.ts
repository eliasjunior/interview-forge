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

/** Real interview readiness requires repeated strong full-interview performance. */
const JEDI_READY_THRESHOLD = 4.0;

/** Warm-up advancement requires repeated passed sessions at the same level. */
const REQUIRED_WARMUP_PASSES = 2;

function calcAvg(scores: number[]): number | null {
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Semantic status of the topic, separate from the routing `level`:
 * - 'cold'    — never attempted; no sessions exist
 * - 'warmup'  — currently working through the warm-up ladder (L0–L2)
 * - 'dropped' — fell back from interview due to a poor score
 * - 'ready'   — completed warm-up or has strong full interview performance
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
        ? `Pass Level 0 warm-up ${REQUIRED_WARMUP_PASSES} times with avg score ≥ ${ADVANCE_THRESHOLD} to advance.`
        : `Pass Level 0 warm-up ${REQUIRED_WARMUP_PASSES} times with avg score ≥ ${ADVANCE_THRESHOLD} to advance.`,
    };
  }

  // Find all ended full interview sessions for this topic
  const interviewSessions = topicSessions.filter(
    (s) => !s.sessionKind || s.sessionKind === "interview"
  );

  // Check if already mock-ready / interview-ready via full interview performance
  if (interviewSessions.length > 0) {
    const sortedInterviews = interviewSessions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latestInterview = sortedInterviews[0];
    const scores = latestInterview.evaluations.map((e) => e.score);
    const avg = calcAvg(scores);
    const latestTwo = sortedInterviews.slice(0, 2);
    const latestTwoAverages = latestTwo.map((session) => calcAvg(session.evaluations.map((e) => e.score)));

    if (
      latestTwo.length === 2 &&
      latestTwoAverages.every((value): value is number => value !== null && value >= JEDI_READY_THRESHOLD)
    ) {
      return {
        level: 4,
        status: 'ready' as TopicStatus,
        reason: `Last 2 full interviews avg ${latestTwoAverages[0].toFixed(1)} and ${latestTwoAverages[1].toFixed(1)} — Jedi Ready.`,
        nextLevelRequirement: "Already at Level 4 — keep practising full interviews to stay sharp.",
      };
    }

    if (
      latestTwo.length === 2 &&
      latestTwoAverages.every((v): v is number => v !== null && v >= 3.0)
    ) {
      return {
        level: 3,
        status: 'ready' as TopicStatus,
        reason: `Last 2 full interviews avg ${latestTwoAverages[0]!.toFixed(1)} and ${latestTwoAverages[1]!.toFixed(1)} — Ranger unlocked.`,
        nextLevelRequirement: "Complete 2 full interviews in a row with avg score ≥ 4.0 to reach Level 4.",
      };
    }

    // 1 good interview or inconsistent — approaching L3 but not confirmed yet
    if (avg !== null && avg >= 3.0) {
      return {
        level: 2,
        status: 'warmup' as TopicStatus,
        reason: `Last interview avg ${avg.toFixed(1)} — good start. One more interview with avg ≥ 3.0 to confirm Ranger.`,
        nextLevelRequirement: "Complete one more full interview with avg score ≥ 3.0 to unlock Level 3.",
      };
    }

    if (avg !== null && avg < DROP_THRESHOLD) {
      return {
        level: 1,
        status: 'dropped' as TopicStatus,
        reason: `Last full interview avg score ${avg.toFixed(1)} — needs reinforcement. Warm-up recommended before next interview.`,
        nextLevelRequirement: `Pass Level 1 warm-up ${REQUIRED_WARMUP_PASSES} times with avg score ≥ ${ADVANCE_THRESHOLD} to return to full interview.`,
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

  // Count how many times each warm-up level has been passed.
  const passedCountByLevel = new Map<number, number>();
  const bestAvgByLevel = new Map<number, number>();
  for (const s of warmupSessions) {
    const lvl = s.questLevel ?? 0;
    const scores = s.evaluations.map((e) => e.score);
    const avg = calcAvg(scores);
    if (avg === null) continue;
    const current = bestAvgByLevel.get(lvl) ?? -1;
    if (avg > current) bestAvgByLevel.set(lvl, avg);
    if (avg >= ADVANCE_THRESHOLD) {
      passedCountByLevel.set(lvl, (passedCountByLevel.get(lvl) ?? 0) + 1);
    }
  }

  // Walk levels 0 → 1 → 2 and find the first one not yet passed
  for (const lvl of [0, 1, 2] as const) {
    const avg = bestAvgByLevel.get(lvl);
    const passCount = passedCountByLevel.get(lvl) ?? 0;
    if (passCount < REQUIRED_WARMUP_PASSES) {
      const attempted = avg !== undefined;
      return {
        level: lvl,
        status: 'warmup' as TopicStatus,
        reason: attempted
          ? `Level ${lvl} warm-up progress ${passCount}/${REQUIRED_WARMUP_PASSES} passes (best avg ${avg!.toFixed(1)}).`
          : `Level ${lvl} warm-up not yet attempted.`,
        nextLevelRequirement: `Pass Level ${lvl} warm-up ${REQUIRED_WARMUP_PASSES} times with avg score ≥ ${ADVANCE_THRESHOLD} to advance to Level ${lvl + 1}.`,
      };
    }
  }

  // All three warmup levels passed
  return {
    level: 3,
    status: 'ready' as TopicStatus,
    reason: "All warm-up levels completed — full mock unlocked. Use start_interview.",
    nextLevelRequirement: "Already at Level 3 — complete 2 full interviews in a row with avg score ≥ 4.0 to reach Level 4.",
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
        "Returns the recommended topic level (0–4) for a topic based on session history. " +
        "Level 0 = Spark, Level 1 = Padawan, Level 2 = Forge, Level 3 = Ranger (full mock unlocked), " +
        "Level 4 = Jedi Ready (2 strong full interviews in a row). " +
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
                : `Call start_interview { topic: "${topic}" } — candidate is ready for a full interview.`,
          }),
        }],
      };
    }
  );
}
