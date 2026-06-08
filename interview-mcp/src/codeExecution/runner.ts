import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import type { CodeRunResult } from "@mock-interview/shared";
import type { StoredCodeChallenge } from "../repositories/codeChallengeRepository.js";

const RUN_TIMEOUT_MS = 4_000;
const COMPILE_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 128 * 1024;
const MAX_SOURCE_CHARS = 100_000;

interface CommandResult {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

function execute(
  command: string,
  args: string[],
  cwd: string,
  timeout = RUN_TIMEOUT_MS,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd,
        timeout,
        maxBuffer: MAX_OUTPUT_BYTES,
        env: {
          PATH: process.env.PATH,
          JAVA_HOME: process.env.JAVA_HOME,
          HOME: cwd,
          TMPDIR: cwd,
          LANG: "C",
        },
      },
      (error, stdout, stderr) => {
        const execError = error as NodeJS.ErrnoException & {
          code?: string | number;
          killed?: boolean;
          signal?: NodeJS.Signals;
        } | null;
        resolve({
          exitCode: typeof execError?.code === "number" ? execError.code : error ? 1 : 0,
          timedOut: Boolean(execError?.killed && execError.signal === "SIGTERM"),
          stdout: String(stdout),
          stderr: String(stderr || (error && typeof execError?.code === "string" ? error.message : "")),
        });
      },
    );
  });
}

function result(
  phase: CodeRunResult["phase"],
  command: CommandResult,
  startedAt: number,
): CodeRunResult {
  return {
    ok: command.exitCode === 0 && !command.timedOut,
    phase,
    exitCode: command.exitCode,
    timedOut: command.timedOut,
    durationMs: Date.now() - startedAt,
    stdout: command.stdout,
    stderr: command.stderr,
  };
}

export async function runCodeChallenge(
  challenge: StoredCodeChallenge,
  source: string,
): Promise<CodeRunResult> {
  if (!source.trim()) {
    return {
      ok: false,
      phase: "compile",
      exitCode: null,
      timedOut: false,
      durationMs: 0,
      stdout: "",
      stderr: "Code is required.",
    };
  }
  if (source.length > MAX_SOURCE_CHARS) {
    return {
      ok: false,
      phase: "compile",
      exitCode: null,
      timedOut: false,
      durationMs: 0,
      stdout: "",
      stderr: `Code exceeds the ${MAX_SOURCE_CHARS}-character limit.`,
    };
  }

  const startedAt = Date.now();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "interview-forge-run-"));

  try {
    if (challenge.language === "javascript") {
      const sourcePath = path.join(workDir, "candidate.cjs");
      await fs.writeFile(
        sourcePath,
        `${source.trim()}\n\n// Hidden test harness\n${challenge.testHarness.trim()}\n`,
        "utf8",
      );
      return result("test", await execute(process.execPath, [sourcePath], workDir), startedAt);
    }

    const sourcePath = path.join(workDir, "Solution.java");
    const harnessPath = path.join(workDir, "TestRunner.java");
    await fs.writeFile(sourcePath, `${source.trim()}\n`, "utf8");
    await fs.writeFile(harnessPath, `${challenge.testHarness.trim()}\n`, "utf8");
    const compiled = await execute(
      "javac",
      ["Solution.java", "TestRunner.java"],
      workDir,
      COMPILE_TIMEOUT_MS,
    );
    if (compiled.exitCode !== 0 || compiled.timedOut) {
      return result("compile", compiled, startedAt);
    }
    return result("test", await execute("java", ["-cp", workDir, "TestRunner"], workDir), startedAt);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
