#!/usr/bin/env bash
# pre-commit：暂存区若动到版本相关文件，校验全仓版本与根 package.json 一致。
set -euo pipefail

STAGED=$(git diff --cached --name-only --diff-filter=ACMR || true)
if [ -z "$STAGED" ]; then
  exit 0
fi

if echo "$STAGED" | grep -qE '(^|/)(package\.json|Cargo\.toml|tauri\.conf\.json|\.release-please-manifest\.json)$'; then
  pnpm run check-version
fi
