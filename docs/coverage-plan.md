# Coverage Plan

- Add lightweight coverage reporting with `c8` while keeping the existing Node `--test` runner.
- Add `test:coverage` scripts in `interview-mcp/package.json` and `report-mcp/package.json`.
- Configure terminal summary and `lcov` output.
- Scope coverage to `src/tools/**`, core logic modules, and repository/data access code.
- Exclude `dist`, smoke/runtime scripts, and generated artifacts from coverage.
- Run a baseline coverage pass for `interview-mcp` and `report-mcp` before adding new tests.

## Priorities

- MCP tool validation and error paths
- Interview state-machine transitions and session flow branches
- Repository-backed logic: flashcards, mistakes, exercises, reports, and graph access

## Shortcuts (add after package scripts are stable)

- `test:coverage:interview` — runs coverage for `interview-mcp`
- `test:coverage:report` — runs coverage for `report-mcp`
