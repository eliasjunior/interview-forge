import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Session } from "@mock-interview/shared";
import type { ToolDeps } from "./deps.js";

export function registerStartInterviewTool(server: McpServer, deps: ToolDeps) {
  server.tool(
    "start_interview",
    "Start a new mock interview session. Returns a session ID and sets state to ASK_QUESTION.",
    {
      topic: z.string().describe("Technical topic for the interview (e.g. 'URL shortener', 'JWT authentication', 'REST API design')"),
      interviewType: z.enum(["design"]).optional()
        .describe("Interview type. Currently only 'design' is supported (default). 'code' is reserved for future use."),
    },
    async ({ topic, interviewType = "design" }) => {
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

      const questions = entry
        ? entry.questions
        : await deps.ai!.generateQuestions(topic);
      const knowledgeSource: "file" | "ai" = entry ? "file" : "ai";

      if (entry) {
        console.error(`[knowledge] loaded "${entry.topic}" from file — ${entry.questions.length} questions`);
      }

      const session: Session = {
        id,
        topic: entry ? entry.topic : topic,
        interviewType,
        sessionKind: "interview",
        state: "ASK_QUESTION",
        currentQuestionIndex: 0,
        questions,
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
            nextTool: "ask_question",
            instruction: "Session ready. Call ask_question to present the first question.",
          }),
        }],
      };
    }
  );
}
