#!/bin/zsh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p "$REPO_ROOT/interview-mcp/data/backups"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting daily DB backup"
npm run db:backup -w interview-mcp
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Daily DB backup completed"
