#!/usr/bin/env bash
# Faraja Solution Loans — one-command verification gate.
# Runs backend lint + frontend build + frontend lint and prints a stage-by-stage summary.
# Usage: ./scripts/verify.sh            (full gate)
#        ./scripts/verify.sh frontend   (build + lint only)
#        ./scripts/verify.sh backend    (ruff only)
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"

PASS=0
FAIL=0
failures=""

run_stage() {
  local name="$1"
  shift
  echo ""
  echo "── $name ───────────────────────────────────────────────"
  if "$@"; then
    echo "✓ $name passed"
    PASS=$((PASS + 1))
  else
    echo "✗ $name FAILED"
    FAIL=$((FAIL + 1))
    failures="$failures $name"
  fi
}

scope="${1:-all}"

if [ "$scope" = "backend" ] || [ "$scope" = "all" ]; then
  run_stage "backend: ruff check" bash -c "cd '$BACKEND_DIR' && uv run ruff check ."
fi

if [ "$scope" = "frontend" ] || [ "$scope" = "all" ]; then
  run_stage "frontend: pnpm build" bash -c "cd '$FRONTEND_DIR' && pnpm build"
  run_stage "frontend: pnpm lint" bash -c "cd '$FRONTEND_DIR' && pnpm lint"
fi

echo ""
echo "════════════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "ALL STAGES PASSED ($PASS)"
  exit 0
else
  echo "FAILED ($FAIL of $((PASS + FAIL))) — failing stages:$failures"
  echo "Note: the repo has pre-existing lint debt (ruff B008/UP045/E501, 84 eslint issues)."
  echo "Check that only pre-existing items remain in the failing output."
  exit 1
fi
