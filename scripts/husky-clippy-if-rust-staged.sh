#!/usr/bin/env bash
# pre-commit：仅当暂存区含 Rust 源码或 Cargo 清单时跑 workspace clippy（与 CI 一致）。
set -euo pipefail

STAGED=$(git diff --cached --name-only --diff-filter=ACMR || true)
if [ -z "$STAGED" ]; then
  exit 0
fi

if echo "$STAGED" | grep -qE '(^|/)(Cargo\.(toml|lock)|.*\.rs)$'; then
  pnpm run clippy
fi
