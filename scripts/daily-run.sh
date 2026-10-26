#!/usr/bin/env bash
# scripts/daily-run.sh — one unattended pass: scan, rank, evaluate the best offers, write the report.
#
#   scan.mjs -> rank-pipeline.mjs -> batch/select-batch.mjs -> batch-runner.sh -> batch/daily-report.mjs
#
# The report lands in data/daily-reports/YYYY-MM-DD.md, the full log in batch/logs/daily-YYYY-MM-DD.log.
# Offers paused by a rate limit are carried over and resumed on the next run.
#
# Settings (environment):
#   DAILY_COUNT       offers evaluated per run, carried-over ones included (default 10)
#   DAILY_MIN_RANK    lowest triage score worth a full evaluation (default 3.8)
#   DAILY_RANK_LIMIT  new offers triaged per run (default 60)
#   DAILY_PARALLEL    parallel workers (default 3)

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

DAILY_COUNT="${DAILY_COUNT:-10}"
DAILY_MIN_RANK="${DAILY_MIN_RANK:-3.8}"
DAILY_RANK_LIMIT="${DAILY_RANK_LIMIT:-60}"
DAILY_PARALLEL="${DAILY_PARALLEL:-3}"

DATE="$(date +%F)"
LOG="batch/logs/daily-$DATE.log"
mkdir -p batch/logs data/daily-reports

# One run at a time: a second trigger (or a manual batch) must not interleave with this one.
exec 9>"batch/.daily-run.lock"
if ! flock -n 9; then
  echo "A daily run is already in progress." >&2
  exit 0
fi

exec >>"$LOG" 2>&1
step() { printf '\n=== %s — %s\n' "$(date +%T)" "$1"; }

step "scan"
node scan.mjs || echo "scan failed, continuing with the offers already in the pipeline"

step "triage (up to $DAILY_RANK_LIMIT new offers)"
node rank-pipeline.mjs --limit "$DAILY_RANK_LIMIT" || echo "triage failed, continuing with the offers already ranked"

step "selection ($DAILY_COUNT offers, rank >= $DAILY_MIN_RANK)"
node batch/select-batch.mjs --count "$DAILY_COUNT" --min-rank "$DAILY_MIN_RANK"

step "evaluation"
# --resume-paused only touches paused offers, so the fresh ones need their own pass.
./batch/batch-runner.sh --parallel "$DAILY_PARALLEL" --resume-paused
./batch/batch-runner.sh --parallel "$DAILY_PARALLEL"

step "report"
node batch/daily-report.mjs --date "$DATE"
