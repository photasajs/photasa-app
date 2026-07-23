#!/usr/bin/env bash
# RFC 0157 Acceptance 7: prod CI/release must never pick up dev channel overlay.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

DEV_MARKERS='tauri\.dev\.conf\.json|me\.photasa\.app\.dev'

if grep -rE "${DEV_MARKERS}" .github/workflows/ >/dev/null 2>&1; then
    echo "::error::Dev channel markers found under .github/workflows/ (prod CI must stay on me.photasa.app)"
    grep -rE "${DEV_MARKERS}" .github/workflows/ || true
    exit 1
fi

tauri_build_ci="$(
    node -e "const p=require('./apps/photasa/package.json'); process.stdout.write(p.scripts['build:ci']||'')"
)"

if echo "${tauri_build_ci}" | grep -qE "${DEV_MARKERS}"; then
    echo "::error::apps/photasa/package.json build:ci must not reference dev channel"
    echo "${tauri_build_ci}"
    exit 1
fi

echo "prod build channel guard passed"
