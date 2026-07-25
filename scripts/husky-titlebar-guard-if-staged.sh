#!/usr/bin/env bash
# pre-commit：暂存区若动到标题栏 / 系统菜单相关文件，跑防回归 guard 测试。
set -euo pipefail

STAGED=$(git diff --cached --name-only --diff-filter=ACMR || true)
if [ -z "$STAGED" ]; then
  exit 0
fi

if echo "$STAGED" | grep -qE \
  '(TitlebarMac\.vue|TitlebarMenuBar\.vue|titlebar-platform\.guard|titlebar-drag-contract|menu-data\.ts|commands/menu\.rs|src-tauri/src/main\.rs|titlebar-regression\.guard\.test)'; then
  pnpm --filter @photasa/photasa exec vitest run src/components/__tests__/titlebar-regression.guard.test.ts src/components/__tests__/TitlebarMac.drag.test.ts
fi
