# Development

[← Back to README](../README.md)

## Monorepo scripts

Run these from the repo root.

| Script | Description |
|---|---|
| `npm run dev:interview` | Start `interview-mcp` MCP server (stdio) |
| `npm run dev:http` | Start `interview-mcp` HTTP API on port 3001 |
| `npm run dev:report` | Start `report-mcp` MCP server (stdio) |
| `npm run dev:ui` | Start `ui` Vite dev server on port 5173 |
| `npm run build` | Build all packages |
| `npm run build:interview` | Build `interview-mcp` only |
| `npm run build:report` | Build `report-mcp` only |
| `npm run build:ui` | Build `ui` only |

## Tests

Run these from the repo root unless noted otherwise.

### Monorepo root commands

| Command | Description |
|---|---|
| `npm run test -w interview-mcp` | Run the `interview-mcp` test suite |
| `npm run test -w report-mcp` | Run the `report-mcp` test suite |
| `npm run test:coverage -w interview-mcp` | Run `interview-mcp` tests with `c8` coverage |
| `npm run test:coverage -w report-mcp` | Run `report-mcp` tests with `c8` coverage |
| `npm run test:coverage -w interview-mcp && npm run test:coverage -w report-mcp` | Run both MCP coverage suites sequentially |

### Package-level view

#### `interview-mcp/`

```bash
npm test
npm run test:coverage
```

#### `report-mcp/`

```bash
npm test
npm run test:coverage
```

### Coverage notes

- Coverage is currently wired with `c8`.
- Initial coverage gate is `50%` for lines, branches, functions, and statements in both MCP packages.
- Coverage reports emit terminal output and `lcov`.

## Bug list

### MCP tools not available when Claude Code runs as a sub-agent inside Claude Desktop

**Observed:** When Claude Desktop launches Claude Code as a sub-agent, the MCP tools defined in `.mcp.json` (`start_interview`, `end_interview`, and others) are not available in the Claude Code context. Claude Code fell back to conducting the interview manually as a conversation, then inserted the session data directly into SQLite via a one-off Node.js script.

**Root cause (to investigate):** Claude Desktop loads `.mcp.json` and has the MCP tools available in its own context, but when it spawns Claude Code as a sub-agent, those tools are not passed through or re-initialised in the sub-agent's tool context. Claude Code runs with its own isolated tool set and does not inherit the parent session's MCP servers.

**Impact:** The full interview flow was bypassed. Session data was reconstructed manually.

**To investigate:**
- Confirm whether Claude Desktop is expected to forward MCP tools to Claude Code sub-agents, or if this is a known architectural boundary.
- Check if there is a way to configure Claude Code to load the same MCP servers independently.
- Test calling interview tools directly from the Claude Desktop conversation to confirm they work there.

## Database backups

The live runtime database is the SQLite file `interview-mcp/data/app.db`.

This file is intentionally local-only:

- `interview-mcp/data/*.db`
- `interview-mcp/data/*.db-shm`
- `interview-mcp/data/*.db-wal`

are ignored by git, so a normal daily `git push` does **not** back up the current database state.

### Manual backup command

Use the following command to create a timestamped local snapshot:

```bash
npm run db:backup -w interview-mcp
```

This writes backups to:

```text
interview-mcp/data/backups/
```

with filenames like:

```text
app.2026-03-28T11-53-28-779Z.backup.db
```

### Why this command exists

The project runs SQLite in WAL mode, so copying only `app.db` naively can miss recent committed data that still lives in `app.db-wal`. The backup script uses SQLite's backup mechanism through `better-sqlite3`, which is safer than a plain file copy.

### Retention

By default, the script keeps the latest `10` backups and deletes older ones.

You can change that with:

```bash
DB_BACKUP_KEEP=20 npm run db:backup -w interview-mcp
```

### When to run it

Run a backup before:

- schema migrations
- graph rebuilds
- cleanup scripts
- manual SQL updates or deletes
- any one-off data repair work

### Daily cron backup

If you want the operating system to create one backup per day automatically, use the repo wrapper script:

```bash
/Users/eliasjunior/Projects/ai-projects/interview-forge/scripts/daily-db-backup.sh
```

It changes into the repo root, ensures the backup directory exists, and runs:

```bash
npm run db:backup -w interview-mcp
```

Install it with `crontab -e` and add one line like this:

```bash
0 2 * * * /Users/eliasjunior/Projects/ai-projects/interview-forge/scripts/daily-db-backup.sh >> /Users/eliasjunior/Projects/ai-projects/interview-forge/tmp/daily-db-backup.log 2>&1
```

That example runs every day at `02:00` and appends output to:

```text
tmp/daily-db-backup.log
```

Cron notes:

- use the absolute script path
- keep the repo dependencies installed (`npm install`)
- prefer logging stdout/stderr so backup failures are visible
- if you want more retained backups, set `DB_BACKUP_KEEP` inside the cron line, for example:

```bash
0 2 * * * DB_BACKUP_KEEP=20 /Users/eliasjunior/Projects/ai-projects/interview-forge/scripts/daily-db-backup.sh >> /Users/eliasjunior/Projects/ai-projects/interview-forge/tmp/daily-db-backup.log 2>&1
```

### Daily macOS `launchd` backup

For a personal Mac, `launchd` is usually a better fit than `cron`.

This repo includes a ready-to-install LaunchAgent plist:

```text
scripts/com.eliasjunior.interview-forge.db-backup.plist
```

It runs the same backup wrapper every day at `18:00` and also runs once when the agent is loaded:

```text
/Users/eliasjunior/Projects/ai-projects/interview-forge/scripts/daily-db-backup.sh
```

Install it with:

```bash
mkdir -p ~/Library/LaunchAgents
cp /Users/eliasjunior/Projects/ai-projects/interview-forge/scripts/com.eliasjunior.interview-forge.db-backup.plist ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.eliasjunior.interview-forge.db-backup.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.eliasjunior.interview-forge.db-backup.plist
```

Useful checks:

```bash
launchctl list | grep interview-forge
cat /Users/eliasjunior/Projects/ai-projects/interview-forge/tmp/daily-db-backup.log
```

Notes:

- `RunAtLoad` means a backup runs once when you load the agent or log in
- if the Mac is fully powered off, nothing runs until it is on again
- `launchd` is still local-machine scheduling, not cloud scheduling
