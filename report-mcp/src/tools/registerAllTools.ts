import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./deps.js";
import { registerServerStatusTool } from "./serverStatus.js";
import { registerHelpTools } from "./helpTools.js";
import { registerRegenerateReportTool } from "./regenerateReport.js";
import { registerGetReportWeakSubjectsTool } from "./getReportWeakSubjects.js";
import { registerGetReportFullContextTool } from "./getReportFullContext.js";
import { registerGenerateReportUiTool } from "./generateReportUi.js";
import { registerGetGraphTool } from "./getGraph.js";
import { registerGetProgressOverviewTool } from "./getProgressOverview.js";

export function registerAllTools(server: McpServer, deps: ToolDeps) {
  registerServerStatusTool(server, deps);
  registerHelpTools(server, deps);
  registerRegenerateReportTool(server, deps);
  registerGetReportWeakSubjectsTool(server, deps);
  registerGetReportFullContextTool(server, deps);
  registerGenerateReportUiTool(server, deps);
  registerGetGraphTool(server, deps);
  registerGetProgressOverviewTool(server, deps);
}
