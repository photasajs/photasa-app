#!/usr/bin/env node
/**
 * RFC 0157 — 从 icon.dev.svg 生成 dev 通道专用图标集（icons-dev/）。
 * 产物提交进仓库；改 SVG 后运行：pnpm run generate:dev-icons
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcTauriDir = join(packageRoot, "src-tauri");
const sourceIcon = join(srcTauriDir, "icons", "icon.dev.svg");
const outputDir = join(srcTauriDir, "icons-dev");

const tauriCli = join(packageRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");

const result = spawnSync(
    process.execPath,
    [tauriCli, "icon", sourceIcon, "-o", outputDir],
    { cwd: srcTauriDir, stdio: "inherit" },
);

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

console.log(`Dev icons written to ${outputDir}`);
