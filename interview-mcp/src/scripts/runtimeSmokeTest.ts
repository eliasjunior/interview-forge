import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface RuntimeSmokeConfig {
  topic: string;
  answer: string;
  score: number;
  feedback: string;
  needsFollowUp: boolean;
}

const DEFAULT_CONFIG: RuntimeSmokeConfig = {
  topic: "JWT — JSON Web Token",
  answer:
    "JWT is a signed token that lets services verify claims without looking up server-side session state on every request. It improves stateless scalability, but only if the server validates the signature, checks expiration, and uses a safe refresh-token and revocation strategy.",
  score: 4,
  feedback:
    "Strong answer with clear coverage of stateless auth, validation, and token lifecycle risks.",
  needsFollowUp: false,
};

function parseArgs(argv: string[]): RuntimeSmokeConfig {
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === "--topic" && value) {
      config.topic = value;
      i += 1;
      continue;
    }

    if (arg === "--answer" && value) {
      config.answer = value;
      i += 1;
      continue;
    }

    if (arg === "--score" && value) {
      config.score = Number(value);
      i += 1;
      continue;
    }

    if (arg === "--feedback" && value) {
      config.feedback = value;
      i += 1;
      continue;
    }

    if (arg === "--needs-follow-up" && value) {
      config.needsFollowUp = value === "true";
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

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const serverCwd = path.resolve(__dirname, "../..");

  const client = new Client(
    { name: "interview-runtime-smoke-test", version: "1.0.0" },
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
    const started = parseToolText(
      await client.callTool({
        name: "start_interview",
        arguments: { topic: config.topic, interviewType: "design" },
      })
    );

    const sessionId = String(started.sessionId);
    const asked = parseToolText(
      await client.callTool({ name: "ask_question", arguments: { sessionId } })
    );

    const submitted = parseToolText(
      await client.callTool({
        name: "submit_answer",
        arguments: { sessionId, answer: config.answer },
      })
    );

    const evaluated = parseToolText(
      await client.callTool({
        name: "evaluate_answer",
        arguments: {
          sessionId,
          score: config.score,
          feedback: config.feedback,
          needsFollowUp: config.needsFollowUp,
        },
      })
    );

    const ended = parseToolText(
      await client.callTool({
        name: "end_interview",
        arguments: { sessionId },
      })
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          toolCount: tools.tools.length,
          sessionId,
          topic: started.topic,
          question: asked.question,
          submittedState: submitted.state,
          evaluatedScore: evaluated.score,
          evaluatedNeedsFollowUp: evaluated.needsFollowUp,
          finalState: ended.state,
          reportFile: ended.reportFile,
          summaryPreview: String(ended.summary ?? "").slice(0, 160),
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
