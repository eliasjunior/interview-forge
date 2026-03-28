# Getting Started

[← Back to README](../README.md)

This guide is for a first successful run: install the monorepo, start the API and UI, then optionally connect the MCP servers to Claude Desktop or Claude Code.

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/eliasjunior/interview-forge.git
cd interview-forge
npm install

# 2. Configure interview-mcp
cp interview-mcp/.env.example interview-mcp/.env
# AI_ENABLED=false runs entirely from knowledge files — no API key needed

# 3. Start the HTTP API (required for the UI)
npm run dev:http

# 4. Start the React dashboard — new terminal
npm run dev:ui
```

Open **http://localhost:5173** to browse sessions and reports.
Open **http://localhost:5173/graph** to explore the knowledge graph.
Open **http://localhost:5173/flashcards** for flashcard review.

## First run

The fastest way to understand the project is:

1. Start the API and UI.
2. Open the dashboard in the browser.
3. In Claude Desktop or Claude Code, ask for a topic such as:

```text
I want to study JWT authentication
```

From there, Claude can route you into the warm-up ladder, a full interview, or a targeted drill depending on your history for that topic.

## Connecting the MCP servers to Claude

Add both servers to your `.mcp.json` (Claude Desktop) or project `.mcp.json` (Claude Code). See `interview-mcp/README.md` and `report-mcp/README.md` for the exact config blocks.

Prefer compiled entrypoints instead of `tsx` or `npm run build && ...` in the MCP config. Running a TypeScript build during the MCP handshake makes the host connection fragile: a test-only type error can make the server appear disconnected even when the runtime code itself is fine.

```json
{
  "mcpServers": {
    "interview-mcp": {
      "command": "/usr/bin/env",
      "args": [
        "node",
        "/Users/eliasjunior/Projects/ai-projects/interview-forge/interview-mcp/dist/server.js"
      ],
      "cwd": "/Users/eliasjunior/Projects/ai-projects/interview-forge/interview-mcp"
    },
    "report-mcp": {
      "command": "/usr/bin/env",
      "args": [
        "node",
        "/Users/eliasjunior/Projects/ai-projects/interview-forge/report-mcp/dist/server.js"
      ],
      "cwd": "/Users/eliasjunior/Projects/ai-projects/interview-forge/report-mcp",
      "env": {
        "AI_ENABLED": "false"
      }
    }
  }
}
```

Build the packages before reloading the host app:

```bash
npm run build:interview
npm run build:report
```

Set `AI_ENABLED=false` for `report-mcp` unless you explicitly want Anthropic-backed deeper dives and have `ANTHROPIC_API_KEY` available in that host environment. Otherwise the server can fail during startup and make the overall MCP setup look broken.

## MCP troubleshooting

If Claude Desktop can use the tools but Codex Desktop or an agent thread cannot, treat that as a host-context issue first, not a server-runtime issue.

- Symptom: Claude Desktop sees `interview-mcp`, but another app or thread reports no MCP resources or tools.
- Likely cause: the other host context did not load or inherit the workspace `.mcp.json`, even though the server itself starts cleanly.
- Verify the server directly: `cd interview-mcp && node dist/server.js`
- Verify the sibling server directly: `cd report-mcp && AI_ENABLED=false node dist/server.js`
- If those commands start and log `running on stdio`, the repo-side config is probably fine.
- Then reconnect or restart the host app so it reloads [`.mcp.json`](../.mcp.json).

After the host reconnects, always run `server_status` first. Only start an interview after that preflight succeeds.
