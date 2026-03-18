import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface SmokeConfig {
  sessionId?: string;
  topic?: string;
}

function parseArgs(argv: string[]): SmokeConfig {
  const config: SmokeConfig = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === "--session-id" && value) {
      config.sessionId = value;
      i += 1;
      continue;
    }

    if (arg === "--topic" && value) {
      config.topic = value;
      i += 1;
    }
  }

  return config;
}

function parseToolText(result: unknown) {
  const content = typeof result === "object" && result !== null && "content" in result
    ? (result as { content?: Array<{ type?: string; text?: string }> }).content
    : undefined;
  const text = content?.find((item) => item.type === "text")?.text ?? "{}";
  return JSON.parse(text) as Record<string, unknown>;
}

function buildStrongAnswer(question: Record<string, unknown>) {
  const subject = String(question.subject ?? "Topic");
  return `${subject}: concise stronger answer.\nHighlight the core mechanism and one tradeoff.\nTie it back to the original question directly.`;
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const serverCwd = path.resolve(__dirname, "../..");

  const client = new Client(
    { name: "report-runtime-smoke-test", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/server.js"],
    cwd: serverCwd,
    env: { ...process.env, AI_ENABLED: "false" },
    stderr: "pipe",
  });

  transport.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk.toString());
  });

  await client.connect(transport);

  try {
    const tools = await client.listTools();
    const status = parseToolText(
      await client.callTool({ name: "server_status", arguments: {} })
    );

    const contextArgs = config.sessionId
      ? { sessionId: config.sessionId, weakScoreThreshold: 3 }
      : config.topic
        ? { topic: config.topic, weakScoreThreshold: 3 }
        : { topic: "JWT — JSON Web Token", weakScoreThreshold: 3 };

    const fullContext = parseToolText(
      await client.callTool({
        name: "get_report_full_context",
        arguments: contextArgs,
      })
    );

    const questions = Array.isArray(fullContext.questions)
      ? fullContext.questions.map((question) => ({
          ...question,
          strongAnswer: buildStrongAnswer(question as Record<string, unknown>),
        }))
      : [];

    const generated = parseToolText(
      await client.callTool({
        name: "generate_report_ui",
        arguments: {
          sessionId: fullContext.sessionId,
          title: `Runtime Smoke Report — ${fullContext.topic}`,
          questions,
        },
      })
    );

    const graph = parseToolText(
      await client.callTool({ name: "get_graph", arguments: {} })
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          toolCount: tools.tools.length,
          status,
          sessionId: fullContext.sessionId,
          topic: fullContext.topic,
          questionCount: questions.length,
          datasetFile: generated.datasetFile,
          uiUrl: generated.uiUrl,
          graphNodes: Array.isArray(graph.nodes) ? graph.nodes.length : null,
          graphEdges: Array.isArray(graph.edges) ? graph.edges.length : null,
        },
        null,
        2
      )
    );
  } finally {
    await transport.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
