# report-mcp — Context

## Key Files & Paths

```
report-mcp/
├── src/
│   ├── server.ts               # MCP bootstrap, registers 7 tools
│   ├── reportUtils.ts          # Pure report-building utilities
│   ├── tools/
│   └── ai/
└── .env                        # DATA_DIR (points to interview-mcp/data), AI_ENABLED
```

## Tools

**7 MCP tools:** `server_status`, `help_tools`, `regenerate_report`, `get_report_weak_subjects`, `get_report_full_context`, `generate_report_ui`, `get_graph`

report-mcp is read-mostly — it reads from `interview-mcp/data/` (shared runtime DB and reports). It does not own any data.
