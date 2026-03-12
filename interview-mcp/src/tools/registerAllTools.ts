import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";
import { registerServerStatusTool } from "./serverStatus.js";
import { registerHelpTools } from "./helpTools.js";
import { registerStartInterviewTool } from "./startInterview.js";
import { registerAskQuestionTool } from "./askQuestion.js";
import { registerSubmitAnswerTool } from "./submitAnswer.js";
import { registerEvaluateAnswerTool } from "./evaluateAnswer.js";
import { registerAskFollowupTool } from "./askFollowup.js";
import { registerNextQuestionTool } from "./nextQuestion.js";
import { registerEndInterviewTool } from "./endInterview.js";
import { registerGetSessionTool } from "./getSession.js";
import { registerListSessionsTool } from "./listSessions.js";
import { registerListTopicsTool } from "./listTopics.js";

export function registerAllTools(server: McpServer, deps: ToolDeps) {
  registerServerStatusTool(server, deps);
  registerHelpTools(server, deps);
  registerStartInterviewTool(server, deps);
  registerAskQuestionTool(server, deps);
  registerSubmitAnswerTool(server, deps);
  registerEvaluateAnswerTool(server, deps);
  registerAskFollowupTool(server, deps);
  registerNextQuestionTool(server, deps);
  registerEndInterviewTool(server, deps);
  registerGetSessionTool(server, deps);
  registerListSessionsTool(server, deps);
  registerListTopicsTool(server, deps);
}
