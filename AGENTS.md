# Mock Interview MCP Server

## Project Overview

A study project to learn MCP (Model Context Protocol) server development.

The app enables mock technical interviews with an LLM. At the end of each interview session, it generates a summary and extracts key concepts/words, then visualizes them as an interactive neural/mind map.

## Core Features

- **Mock Interview**: Conduct a simulated interview with an LLM
- **Session Summary**: Auto-generated summary at interview end
- **Concept Extraction**: Pull key words/concepts from the summary
- **Neural Map Visualization**: Interactive graph where:
  - Words are nodes grouped into clusters (topics/themes)
  - Words can appear in multiple clusters (shared nodes)
  - Nodes are clickable and collapsible
- **Evolving dataset**: Each interview session adds to the knowledge graph over time

## Tech Stack

> To be decided as the project evolves.

- **MCP Server**: Core of this study project — exposes interview and graph tools to Codex
- **LLM**: Codex (via Anthropic API) for conducting interviews and generating summaries
- **Graph Visualization**: TBD (e.g., D3.js, Cytoscape.js, or React Flow)
- **Frontend**: TBD
- **Storage**: TBD (local JSON, SQLite, or similar)

## Project Structure

> Will be defined as the project evolves.

```
first-mcp/
├── AGENTS.md
├── src/
│   ├── server/        # MCP server implementation
│   ├── tools/         # MCP tools (interview, summary, graph)
│   └── graph/         # Word/concept graph logic
└── client/            # Frontend visualization
```

## MCP Server Goals (Study Focus)

This is a learning project. Key MCP concepts to explore:

- Defining and exposing MCP **tools**
- Managing **session/context** across interview turns
- Returning structured data (summaries, word graphs) from tools
- Connecting Codex Desktop or Codex to the local MCP server

## Development Notes

- Keep it simple and iterative — features will be added progressively
- Prioritize learning MCP patterns over production-grade code
- Document decisions and learnings directly in this file as the project evolves

## MCP Execution Rules

- When the user asks to run an MCP tool, first verify that the MCP server is actually connected and that the requested tool is available in the current session.
- If the MCP server is unavailable, disconnected, or the tool is not exposed, state that explicitly and stop instead of proceeding as if the tool had run.
- Prefer a preflight check before interview commands, such as `help_tools`, `list_topics`, or a dedicated health/status tool when available.
- Treat MCP connection problems as a blocking issue for tool execution, not as something to silently work around.

## Interview Guardrails

- Treat interview questions and evaluation rubrics as separate roles, even if a tool returns both in one payload.
- Candidate-facing output must include only the actual interview prompt and any neutral procedural instructions needed to continue the session.
- Do not reveal evaluator-only fields such as `evaluationCriteria`, rubric text, expected answer structure, scoring hints, model answers, or hidden grading guidance to the candidate.
- If a tool response contains both candidate-visible and evaluator-only fields, filter the response before presenting it in chat.
- Keep the interview realistic: ask the question, wait for the candidate's answer, then evaluate it. Do not leak the grading criteria while asking the question.

## No Simulation Rule

- If a user asks to run a tool, do not simulate, roleplay, or manually imitate the tool result when the actual tool call cannot be executed.
- Do not continue the workflow in chat as though the MCP call succeeded.
- If execution is blocked, report the exact reason clearly: missing MCP connection, unavailable tool, invalid topic, or runtime failure.
