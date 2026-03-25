import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Session } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";

// ─────────────────────────────────────────────────────────────────────────────
// Question selection — difficulty-progressive, past-session-aware
//
// Given a pool of questions tagged with difficulties, we select up to
// maxQuestions ordered foundation → intermediate → advanced.
//
// Within each tier we deprioritise questions that have already been asked in
// previous sessions for the same topic (least-asked first, shuffle ties),
// so repeated sessions always surface fresh questions.
// ─────────────────────────────────────────────────────────────────────────────

const TIER_ORDER = ["foundation", "intermediate", "advanced"] as const;

/** Target count per tier when maxQuestions === 5. Scales proportionally. */
const TIER_TARGETS: Record<string, number> = {
  foundation:   2,
  intermediate: 2,
  advanced:     1,
};

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Candidate {
  index: number;        // original index in knowledge file
  question: string;
  criteria: string;
  difficulty: string;
  timesAsked: number;   // across all past sessions for this topic
}

export function selectQuestions(
  questions: string[],
  evaluationCriteria: string[],
  questionDifficulties: string[],
  pastAskCounts: Map<number, number>,  // originalIndex → times asked
  maxQuestions: number,
): Candidate[] {
  // Build candidate pool
  const pool: Candidate[] = questions.map((q, i) => ({
    index: i,
    question: q,
    criteria: evaluationCriteria[i] ?? "",
    difficulty: questionDifficulties[i] ?? "intermediate",
    timesAsked: pastAskCounts.get(i) ?? 0,
  }));

  // Group by tier
  const byTier = new Map<string, Candidate[]>();
  for (const tier of TIER_ORDER) byTier.set(tier, []);
  for (const c of pool) {
    const tier = TIER_ORDER.includes(c.difficulty as any) ? c.difficulty : "intermediate";
    byTier.get(tier)!.push(c);
  }

  // Sort within each tier: least-asked first, shuffle ties
  for (const [tier, candidates] of byTier) {
    byTier.set(
      tier,
      candidates.sort((a, b) => {
        if (a.timesAsked !== b.timesAsked) return a.timesAsked - b.timesAsked;
        return Math.random() - 0.5;
      })
    );
  }

  // Allocate slots per tier proportionally to maxQuestions
  const scale = maxQuestions / 5;
  const tierSlots: Record<string, number> = {};
  let allocated = 0;
  for (const tier of TIER_ORDER) {
    tierSlots[tier] = Math.round((TIER_TARGETS[tier] ?? 1) * scale);
    allocated += tierSlots[tier];
  }
  // Fill any rounding gap from intermediate tier (largest pool)
  const gap = maxQuestions - allocated;
  if (gap !== 0) tierSlots["intermediate"] = Math.max(0, tierSlots["intermediate"] + gap);

  // Pick from each tier in order
  const selected: Candidate[] = [];
  for (const tier of TIER_ORDER) {
    const slots = tierSlots[tier];
    const picks = byTier.get(tier)!.slice(0, slots);
    selected.push(...picks);
  }

  return selected;
}

export function registerStartInterviewTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "start_interview",
    {
      description: "Start a new mock interview session. Selects up to maxQuestions questions " +
        "ordered foundation → intermediate → advanced. Within each tier, least-recently-asked " +
        "questions are prioritised so repeated sessions surface fresh material.",
      inputSchema: {
        topic: z.string().describe(
          "Technical topic for the interview (e.g. 'URL shortener', 'JWT authentication', 'REST API design')"
        ),
        interviewType: z.enum(["design"]).optional()
          .describe("Interview type. Currently only 'design' is supported (default)."),
        maxQuestions: z.number().int().min(1).max(10).optional()
          .describe("Max questions to ask. Defaults to 5. Ignored when AI generates questions."),
      },
    },
    async ({ topic, interviewType = "design", maxQuestions = 5 }) => {
      const sessions = deps.loadSessions();
      const id = deps.generateId();

      const entry = deps.knowledge.findByTopic(topic);

      if (!entry && !deps.ai) {
        const available = deps.knowledge.listTopics();
        return deps.stateError(
          `Topic "${topic}" not found in knowledge base and AI is disabled (AI_ENABLED=false). ` +
          `Available topics: ${available.length > 0 ? available.join(", ") : "(none loaded)"}`
        );
      }

      let questions: string[];
      let questionCriteria: string[] | undefined;
      let selectionRationale: object[] | undefined;
      const knowledgeSource: "file" | "ai" = entry ? "file" : "ai";

      if (entry) {
        // Count how many times each question has been asked in past sessions for this topic
        const pastAskCounts = new Map<number, number>();
        for (const s of Object.values(sessions)) {
          if (s.topic !== entry.topic || s.state !== "ENDED") continue;
          for (let qi = 0; qi < s.questions.length; qi++) {
            // Match past question text back to the current knowledge file
            const originalIdx = entry.questions.indexOf(s.questions[qi]);
            if (originalIdx !== -1) {
              pastAskCounts.set(originalIdx, (pastAskCounts.get(originalIdx) ?? 0) + 1);
            }
          }
        }

        const selected = selectQuestions(
          entry.questions,
          entry.evaluationCriteria,
          entry.questionDifficulties,
          pastAskCounts,
          maxQuestions,
        );

        questions = selected.map((c) => c.question);
        questionCriteria = selected.map((c) => c.criteria);
        selectionRationale = selected.map((c) => ({
          difficulty: c.difficulty,
          timesAskedBefore: c.timesAsked,
          fresh: c.timesAsked === 0,
        }));

        console.error(
          `[knowledge] loaded "${entry.topic}" — selected ${selected.length}/${entry.questions.length} questions`
        );
      } else {
        questions = await deps.ai!.generateQuestions(topic);
      }

      const session: Session = {
        id,
        topic: entry ? entry.topic : topic,
        interviewType,
        sessionKind: "interview",
        state: "ASK_QUESTION",
        currentQuestionIndex: 0,
        questions,
        questionCriteria,
        messages: [],
        evaluations: [],
        createdAt: new Date().toISOString(),
        knowledgeSource,
      };

      sessions[id] = session;
      deps.saveSessions(sessions);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId: id,
            state: session.state,
            topic: session.topic,
            interviewType,
            knowledgeSource,
            ...(entry && { topicSummary: entry.summary }),
            totalQuestions: session.questions.length,
            ...(selectionRationale && { selectionRationale }),
            instruction: [
              "Session ready. Call ask_question to present the first question.",
              selectionRationale
                ? `Questions are ordered foundation → intermediate → advanced. ` +
                  `Vary your delivery — do not read the question verbatim if the candidate has seen it before. ` +
                  `Use the 'timesAskedBefore' field to gauge familiarity: if > 0, probe deeper or reframe the scenario.`
                : "",
            ].filter(Boolean).join(" "),
            nextTool: "ask_question",
          }, null, 2),
        }],
      };
    }
  );
}
