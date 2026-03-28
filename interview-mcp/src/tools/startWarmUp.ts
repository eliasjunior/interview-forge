import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session, WarmUpLevel, QuestionFormat } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";
import { detectTopicLevel } from "./getTopicLevel.js";
import { selectQuestions } from "./startInterview.js";

// ─────────────────────────────────────────────────────────────────────────────
// start_warm_up — Progressive entry sessions for levels 0–2.
//
// Level 0 → MCQ recognition     (questFormat: 'mcq')
// Level 1 → Fill-in-blank recall (questFormat: 'fill_blank')
// Level 2 → Guided answer        (questFormat: 'guided')
// Level 3/4 → Redirect: use start_interview instead.
// ─────────────────────────────────────────────────────────────────────────────

const FORMAT_BY_LEVEL: Record<0 | 1 | 2, QuestionFormat> = {
  0: "mcq",
  1: "fill_blank",
  2: "guided",
};

const LEVEL_LABEL: Record<WarmUpLevel, string> = {
  0: "Spark",
  1: "Padawan",
  2: "Forge",
  3: "Ranger",
  4: "Jedi Ready",
};

const LEVEL_INSTRUCTION: Record<0 | 1 | 2, string> = {
  0: "Present each MCQ question with its choices. Wait for the candidate to pick an option letter (A/B/C/D). " +
     "After they answer, call evaluate_answer — it will auto-score based on the correct answer. " +
     "Encourage the candidate; frame errors as learning moments, not failures.",
  1: "Present each fill-in-the-blank question. Wait for the candidate's answer. " +
     "Call evaluate_answer — it will auto-score based on key term matching. " +
     "Keep pressure low: partial answers that capture the concept should score well.",
  2: "Present each guided question along with its scaffolding hint. " +
     "Encourage the candidate to use the provided structure. " +
     "Call evaluate_answer with your assessment of how well they followed the structure and hit the key concepts. " +
     "Score range: 1 (blank) → 3 (partial) → 5 (structured and complete).",
};

const MAX_WARMUP_QUESTIONS = 5;

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function selectWarmupQuestions(
  items: import("../knowledge/port.js").WarmUpQuestion[],
  pastAskCounts: Map<string, number>,
  maxQuestions = MAX_WARMUP_QUESTIONS,
): import("../knowledge/port.js").WarmUpQuestion[] {
  if (items.length <= maxQuestions) return items;

  const candidates = items.map((item, index) => ({
    item,
    index,
    timesAsked: pastAskCounts.get(item.question) ?? 0,
  }));

  // Least-asked first; shuffle ties so the subset varies across sessions
  candidates.sort((a, b) => {
    if (a.timesAsked !== b.timesAsked) return a.timesAsked - b.timesAsked;
    return Math.random() - 0.5;
  });

  // Pick the freshest N, then restore authored order within the subset
  return candidates
    .slice(0, maxQuestions)
    .sort((a, b) => a.index - b.index)
    .map(({ item }) => item);
}

export function registerStartWarmUpTool(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "start_warm_up",
    {
      description:
        "Start a warm-up quest session for a topic. " +
        "Levels: 0 = Spark (MCQ), 1 = Padawan (fill-in-the-blank), 2 = Forge (guided answer), 3 = Ranger (redirects to start_interview), 4 = Jedi Ready (redirects to start_interview). " +
        "Warm-up sessions are capped at 5 questions even when more are authored. " +
        "If level is omitted, auto-detects the appropriate level from session history. " +
        "Use after get_topic_level to route candidates correctly.",
      inputSchema: z.object({
        topic: z.string().describe("Topic to warm up on, e.g. 'JWT authentication'"),
        level: z.union([
          z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4),
        ]).or(z.coerce.number().pipe(z.union([
          z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4),
        ]))).optional().describe(
          "Warm-up level to start (0–4). Omit to auto-detect from session history."
        ),
      }),
    },
    async ({ topic, level }) => {
      const sessions = deps.loadSessions();
      const knowledgeTopic = deps.knowledge.findByTopic(topic);

      const hasWarmupContent =
        knowledgeTopic != null &&
        knowledgeTopic.warmupLevels != null &&
        Object.keys(knowledgeTopic.warmupLevels).length > 0;

      // Auto-detect level if not provided
      const resolvedLevel: WarmUpLevel =
        level !== undefined
          ? level
          : detectTopicLevel(topic, sessions, hasWarmupContent).level;

      // Build cross-session ask history for the resolved warm-up level
      const normalise = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, "");
      const topicNorm = normalise(topic);
      const pastWarmupSessions = Object.values(sessions)
        .filter(
          (s) =>
            normalise(s.topic) === topicNorm &&
            s.state === "ENDED" &&
            s.sessionKind === "warmup" &&
            (s.questLevel ?? 0) === resolvedLevel,
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const pastAskCounts = new Map<string, number>();
      for (const s of pastWarmupSessions) {
        for (const q of s.questions) {
          pastAskCounts.set(q, (pastAskCounts.get(q) ?? 0) + 1);
        }
      }
      const previouslyAskedQuestions: string[] = pastWarmupSessions[0]?.questions ?? [];

      // Level 3/4 → redirect to full interview
      if (resolvedLevel >= 3) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "redirect",
              topic,
              level: resolvedLevel,
              message: `Candidate is at Level ${resolvedLevel} — no warm-up needed. Proceed with a full interview.`,
              instruction: `Call start_interview { topic: "${topic}" } to begin.`,
              nextTool: "start_interview",
            }),
          }],
        };
      }

      // TypeScript cannot narrow a union via >= comparison, so we assert after the guard.
      const narrowedLevel = resolvedLevel as 0 | 1 | 2;

      // Validate warm-up content exists for the requested level
      const levelContent = knowledgeTopic?.warmupLevels?.[narrowedLevel];

      // ── Fallback for L0: no authored MCQ content → use regular questions,
      //    instruct the orchestrator to construct A/B/C/D choices on the fly.
      if ((!levelContent || levelContent.questions.length === 0) && resolvedLevel === 0 && knowledgeTopic && knowledgeTopic.questions.length > 0) {
        const selected = selectQuestions(
          knowledgeTopic.questions,
          knowledgeTopic.evaluationCriteria,
          knowledgeTopic.questionDifficulties,
          new Map(),
          MAX_WARMUP_QUESTIONS,
        );
        const id = deps.generateId();
        const session: Session = {
          id,
          topic: knowledgeTopic.topic,
          sessionKind: "warmup",
          questLevel: 0,
          questFormat: "mcq",
          state: "ASK_QUESTION",
          currentQuestionIndex: 0,
          questions: selected.map((candidate) => candidate.question),
          messages: [],
          evaluations: [],
          createdAt: new Date().toISOString(),
          knowledgeSource: "file",
        };
        sessions[id] = session;
        deps.saveSessions(sessions);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              sessionId: id,
              topic: session.topic,
              level: 0,
              levelLabel: LEVEL_LABEL[0],
              format: "mcq",
              totalQuestions: session.questions.length,
              state: session.state,
              generatedMCQ: true,
              instruction:
                "No pre-built MCQ content exists for this topic. " +
                "For each question returned by ask_question, generate 4 plausible choices (A/B/C/D) using your knowledge — " +
                "3 distractors should be plausible but wrong. Present the question with the 4 options. " +
                "After the candidate picks a letter, call evaluate_answer — score 1–5 based on whether they identified the correct concept. " +
                "Keep pressure low; frame errors as learning moments, not failures.",
              nextTool: "ask_question",
            }),
          }],
        };
      }

      if (!levelContent || levelContent.questions.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: `No warm-up content found for topic "${topic}" at Level ${resolvedLevel}.`,
              availableLevels: knowledgeTopic?.warmupLevels
                ? Object.keys(knowledgeTopic.warmupLevels).map(Number)
                : [],
              suggestion: `Try Level 0 instead, or call start_interview { topic: "${topic}" } for the full interview.`,
            }),
          }],
        };
      }

      const id = deps.generateId();
      const format = FORMAT_BY_LEVEL[narrowedLevel];
      const qs = selectWarmupQuestions(levelContent.questions, pastAskCounts);

      const session: Session = {
        id,
        topic: knowledgeTopic!.topic,
        sessionKind: "warmup",
        questLevel: narrowedLevel,
        questFormat: format,
        // Store choices and answers on the session for auto-evaluation in L0/L1
        questChoices: format === "mcq" ? qs.map((q) => q.choices ?? []) : undefined,
        questAnswers: qs.map((q) => q.answer),
        state: "ASK_QUESTION",
        currentQuestionIndex: 0,
        questions: qs.map((q) => q.question),
        // For L2 guided: store hint as questionCriteria so ask_question can surface it
        questionCriteria: format === "guided" ? qs.map((q) => q.hint ?? "") : undefined,
        messages: [],
        evaluations: [],
        createdAt: new Date().toISOString(),
        knowledgeSource: "file",
      };

      sessions[id] = session;
      deps.saveSessions(sessions);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            sessionId: id,
            topic: session.topic,
            level: narrowedLevel,
            levelLabel: LEVEL_LABEL[narrowedLevel],
            format,
            totalQuestions: qs.length,
            state: session.state,
            previouslyAskedQuestions: previouslyAskedQuestions.length > 0 ? previouslyAskedQuestions : undefined,
            freshQuestionsSelected: qs.filter((q) => !pastAskCounts.has(q.question)).length,
            instruction: LEVEL_INSTRUCTION[narrowedLevel],
            nextTool: "ask_question",
          }),
        }],
      };
    }
  );
}
