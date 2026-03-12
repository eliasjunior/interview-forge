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

- **MCP Server**: Core of this study project — exposes interview and graph tools to Claude
- **LLM**: Claude (via Anthropic API) for conducting interviews and generating summaries
- **Graph Visualization**: TBD (e.g., D3.js, Cytoscape.js, or React Flow)
- **Frontend**: TBD
- **Storage**: TBD (local JSON, SQLite, or similar)

## Project Structure

> Will be defined as the project evolves.

```
first-mcp/
├── CLAUDE.md
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
- Connecting Claude Desktop or Claude Code to the local MCP server

## Development Notes

- Keep it simple and iterative — features will be added progressively
- Prioritize learning MCP patterns over production-grade code
- Document decisions and learnings directly in this file as the project evolves
