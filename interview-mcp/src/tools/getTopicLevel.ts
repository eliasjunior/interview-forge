import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";
import type { Session, SessionRewardSummary, TopicLevelSnapshot, TopicStatus, WarmUpLevel } from "@mock-interview/shared";

// ─────────────────────────────────────────────────────────────────────────────
// Level detection logic
// ─────────────────────────────────────────────────────────────────────────────

/** Strong warm-up score (out of 5) that advances immediately to the next level. */
const IMMEDIATE_ADVANCE_THRESHOLD = 4.0;

/** Solid warm-up score (out of 5) that advances after two consecutive sessions. */
const STREAK_ADVANCE_THRESHOLD = 3.0;

/** Real interview readiness requires repeated strong full-interview performance. */
const JEDI_READY_THRESHOLD = 4.0;

/** Consecutive solid warm-up sessions required when the score is below immediate-advance threshold. */
const REQUIRED_WARMUP_STREAK = 2;

function calcAvg(scores: number[]): number | null {
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function getWarmupLevelProgress(sessions: Session[]) {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let currentStreak = 0;
  let bestAvg: number | null = null;
  let passed = false;

  for (const session of sortedSessions) {
    const avg = calcAvg(session.evaluations.map((e) => e.score));
    if (avg === null) continue;
    bestAvg = bestAvg === null ? avg : Math.max(bestAvg, avg);

    if (avg >= IMMEDIATE_ADVANCE_THRESHOLD) {
      passed = true;
      currentStreak = REQUIRED_WARMUP_STREAK;
      break;
    }

    if (avg >= STREAK_ADVANCE_THRESHOLD) {
      currentStreak += 1;
      if (currentStreak >= REQUIRED_WARMUP_STREAK) {
        passed = true;
        break;
      }
      continue;
    }

    currentStreak = 0;
  }

  return {
    passed,
    bestAvg,
    currentStreak: Math.min(currentStreak, REQUIRED_WARMUP_STREAK),
  };
}

/**
 * Semantic status of the topic, separate from the routing `level`:
 * - 'cold'    — never attempted; no sessions exist
 * - 'warmup'  — currently working through the warm-up ladder (L0–L2)
 * - 'dropped' — fell back from interview due to a poor score
 * - 'ready'   — completed warm-up or has strong full interview performance
 */

export interface TopicLevelProgress {
  current: number;
  required: number;
  targetLevel: WarmUpLevel;
  variant: 'warmup' | 'interview' | 'complete';
  label: string;
  attempted: boolean;
  almostThere: boolean;
}

export function detectTopicLevel(
  topic: string,
  sessions: Record<string, Session>,
  hasWarmupContent: boolean
): TopicLevelSnapshot {
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
        ? `Reach avg score ≥ ${IMMEDIATE_ADVANCE_THRESHOLD} once, or avg score ≥ ${STREAK_ADVANCE_THRESHOLD} in ${REQUIRED_WARMUP_STREAK} consecutive Level 0 warm-ups, to advance.`
        : `Reach avg score ≥ ${IMMEDIATE_ADVANCE_THRESHOLD} once, or avg score ≥ ${STREAK_ADVANCE_THRESHOLD} in ${REQUIRED_WARMUP_STREAK} consecutive Level 0 warm-ups, to advance.`,
      progress: {
        current: 0,
        required: REQUIRED_WARMUP_STREAK,
        targetLevel: 1,
        variant: 'warmup',
        label: `0 / ${REQUIRED_WARMUP_STREAK} streak`,
        attempted: false,
        almostThere: false,
      },
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
    const consecutiveStrongInterviewCount = consecutiveStrongInterviews(sortedInterviews);

    if (
      latestTwo.length === 2 &&
      latestTwoAverages.every((value): value is number => value !== null && value >= JEDI_READY_THRESHOLD)
    ) {
      return {
        level: 4,
        status: 'ready' as TopicStatus,
        reason: `Last 2 full interviews avg ${latestTwoAverages[0].toFixed(1)} and ${latestTwoAverages[1].toFixed(1)} — Jedi Ready.`,
        nextLevelRequirement: "Already at Level 4 — keep practising full interviews to stay sharp.",
        progress: {
          current: REQUIRED_WARMUP_STREAK,
          required: REQUIRED_WARMUP_STREAK,
          targetLevel: 4,
          variant: 'complete',
          label: 'Mastered',
          attempted: true,
          almostThere: false,
        },
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
        progress: {
          current: Math.min(consecutiveStrongInterviewCount, REQUIRED_WARMUP_STREAK),
          required: REQUIRED_WARMUP_STREAK,
          targetLevel: 4,
          variant: 'interview',
          label: `${Math.min(consecutiveStrongInterviewCount, REQUIRED_WARMUP_STREAK)} / ${REQUIRED_WARMUP_STREAK} strong interviews`,
          attempted: true,
          almostThere: Math.min(consecutiveStrongInterviewCount, REQUIRED_WARMUP_STREAK) === REQUIRED_WARMUP_STREAK - 1,
        },
      };
    }

    // 1 good interview or inconsistent — approaching L3 but not confirmed yet
    if (avg !== null && avg >= 3.0) {
      return {
        level: 2,
        status: 'warmup' as TopicStatus,
        reason: `Last interview avg ${avg.toFixed(1)} — good start. One more interview with avg ≥ 3.0 to confirm Ranger.`,
        nextLevelRequirement: "Complete one more full interview with avg score ≥ 3.0 to unlock Level 3.",
        progress: {
          current: 1,
          required: REQUIRED_WARMUP_STREAK,
          targetLevel: 3,
          variant: 'interview',
          label: `1 / ${REQUIRED_WARMUP_STREAK} interviews`,
          attempted: true,
          almostThere: true,
        },
      };
    }

  }

  if (!hasWarmupContent) {
    return {
      level: 3,
      status: 'ready' as TopicStatus,
      reason: "No warm-up content authored for this topic — continue with full interviews.",
      nextLevelRequirement: "Complete a full interview session.",
      progress: {
        current: 0,
        required: 1,
        targetLevel: 4,
        variant: 'interview',
        label: 'No warm-up ladder',
        attempted: false,
        almostThere: false,
      },
    };
  }

  // Determine highest warmup level passed
  const warmupSessions = topicSessions.filter((s) => s.sessionKind === "warmup");

  // Walk levels 0 → 1 → 2 and find the first one not yet passed
  for (const lvl of [0, 1, 2] as const) {
    const levelSessions = warmupSessions.filter((s) => (s.questLevel ?? 0) === lvl);
    const levelProgress = getWarmupLevelProgress(levelSessions);
    if (!levelProgress.passed) {
      const attempted = levelProgress.bestAvg !== null;
      return {
        level: lvl,
        status: 'warmup' as TopicStatus,
        reason: attempted
          ? `Level ${lvl} warm-up progress ${levelProgress.currentStreak}/${REQUIRED_WARMUP_STREAK} streak (best avg ${levelProgress.bestAvg!.toFixed(1)}).`
          : `Level ${lvl} warm-up not yet attempted.`,
        nextLevelRequirement: `Reach avg score ≥ ${IMMEDIATE_ADVANCE_THRESHOLD} once, or avg score ≥ ${STREAK_ADVANCE_THRESHOLD} in ${REQUIRED_WARMUP_STREAK} consecutive Level ${lvl} warm-ups, to advance to Level ${lvl + 1}.`,
        progress: {
          current: levelProgress.currentStreak,
          required: REQUIRED_WARMUP_STREAK,
          targetLevel: (lvl + 1) as WarmUpLevel,
          variant: 'warmup',
          label: `${levelProgress.currentStreak} / ${REQUIRED_WARMUP_STREAK} streak`,
          attempted,
          almostThere: levelProgress.currentStreak === REQUIRED_WARMUP_STREAK - 1,
        },
      };
    }
  }

  // All three warmup levels passed
  return {
    level: 3,
    status: 'ready' as TopicStatus,
    reason: "All warm-up levels completed — full mock unlocked. Use start_interview.",
    nextLevelRequirement: "Already at Level 3 — complete 2 full interviews in a row with avg score ≥ 4.0 to reach Level 4.",
    progress: {
      current: Math.min(consecutiveStrongInterviews(topicSessions), REQUIRED_WARMUP_STREAK),
      required: REQUIRED_WARMUP_STREAK,
      targetLevel: 4,
      variant: 'interview',
      label: `${Math.min(consecutiveStrongInterviews(topicSessions), REQUIRED_WARMUP_STREAK)} / ${REQUIRED_WARMUP_STREAK} strong interviews`,
      attempted: true,
      almostThere: Math.min(consecutiveStrongInterviews(topicSessions), REQUIRED_WARMUP_STREAK) === REQUIRED_WARMUP_STREAK - 1,
    },
  };
}

function consecutiveStrongInterviews(sessions: Session[]) {
  const interviewSessions = sessions
    .filter((s) => !s.sessionKind || s.sessionKind === "interview")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  let count = 0;
  for (const session of interviewSessions) {
    const avg = calcAvg(session.evaluations.map((e) => e.score));
    if (avg !== null && avg >= JEDI_READY_THRESHOLD) {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

function buildRewardCopy(
  session: Session,
  previous: TopicLevelSnapshot,
  current: TopicLevelSnapshot,
): Omit<SessionRewardSummary, "sessionId" | "topic" | "eligible" | "previous" | "current"> {
  const currentLabel = `L${current.level}`;
  const previousLabel = `L${previous.level}`;
  const progressMoved = current.progress.current > previous.progress.current;
  const leveledUp = current.level > previous.level;

  if (session.sessionKind === "study" || session.sessionKind === "drill") {
    return {
      state: "ineligible",
      title: "No ladder progress",
      message: session.sessionKind === "drill"
        ? "Drill sessions sharpen recall but do not change the topic ladder."
        : "Study sessions do not count toward topic level progression.",
      whyNoProgress: session.sessionKind === "drill"
        ? "This session helps reinforcement, but only warm-ups and full interviews move the topic ladder."
        : "The topic ladder only advances through warm-up passes and full interview performance.",
    };
  }

  if (current.progress.variant === "complete" && current.level === 4) {
    return {
      state: "complete",
      title: leveledUp ? "Level up" : "Interview ready",
      message: leveledUp
        ? `${session.topic} reached ${currentLabel}.`
        : `${session.topic} remains ${currentLabel}.`,
      nextHint: "You are at the top rung. Keep practising full interviews to stay sharp.",
    };
  }

  if (leveledUp) {
    return {
      state: "level_up",
      title: "Level up",
      message: `${session.topic} advanced from ${previousLabel} to ${currentLabel}.`,
      nextHint: current.progress.almostThere
        ? current.progress.variant === "interview"
          ? `One strong interview unlocks L${current.progress.targetLevel}.`
          : `One more solid warm-up unlocks L${current.progress.targetLevel}.`
        : current.nextLevelRequirement,
    };
  }

  if (progressMoved) {
    return {
      state: "progress",
      title: "Progress updated",
      message: current.progress.label,
      nextHint: current.progress.almostThere
        ? current.progress.variant === "interview"
          ? `One strong interview unlocks L${current.progress.targetLevel}.`
          : `One more solid warm-up unlocks L${current.progress.targetLevel}.`
        : current.nextLevelRequirement,
    };
  }

  return {
    state: "stalled",
    title: "No level progress",
    message: current.nextLevelRequirement,
    whyNoProgress: current.reason,
    nextHint: current.progress.almostThere
      ? current.progress.variant === "interview"
        ? `One strong interview unlocks L${current.progress.targetLevel}.`
        : `One more solid warm-up unlocks L${current.progress.targetLevel}.`
      : undefined,
  };
}

export function buildSessionRewardSummary(
  session: Session,
  sessions: Record<string, Session>,
  hasWarmupContent: boolean,
): SessionRewardSummary {
  const previousSessions = Object.fromEntries(
    Object.entries(sessions).filter(([id]) => id !== session.id)
  );
  const previous = detectTopicLevel(session.topic, previousSessions, hasWarmupContent);
  const current = detectTopicLevel(session.topic, sessions, hasWarmupContent);
  const eligible = session.sessionKind !== "study" && session.sessionKind !== "drill";
  const rewardCopy = buildRewardCopy(session, previous, current);

  return {
    sessionId: session.id,
    topic: session.topic,
    eligible,
    previous,
    current,
    ...rewardCopy,
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
            progress: result.progress,
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
