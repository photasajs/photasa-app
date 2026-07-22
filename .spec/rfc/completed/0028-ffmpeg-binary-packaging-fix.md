# RFC 0028: FFmpeg Binary Packaging Fix

- **Start Date**: 2025-09-23
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)
- **Status**: ✅ Completed

## Summary

修复 桌面应用打包后 ffmpeg 和 ffprobe 二进制文件无法访问的问题，确保视频处理功能在生产环境正常工作。

## Motivation

当前问题：

- 应用打包后出现错误：`spawn ffmpeg.exe ENOENT`
- ffmpeg-static 和 ffprobe-static 的二进制文件被打包进 app.asar，无法作为独立进程执行
- 影响所有视频相关功能：缩略图生成、视频元数据提取等

用户影响：

- Windows 和 macOS 用户无法使用视频功能
- 应用核心功能受损，影响用户体验

## Detailed Design

### 问题分析

经过深入调查，发现问题的根本原因：

1. **ffmpeg-static 二进制文件缺失**：`node_modules/ffmpeg-static/ffmpeg.exe` 文件不存在
2. **npm 包机制**：ffmpeg-static 包本身不包含二进制文件，需要在安装时下载
3. **打包问题**：即使文件存在，也需要正确配置 asarUnpack 才能在生产环境使用

### 解决方案

#### 1. 确保二进制文件安装

##### 1.1 修复 ffmpeg-static 安装

创建 `scripts/install-ffmpeg.js`：

```javascript
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

const FFMPEG_VERSION = "5.1.2";
const PLATFORMS = {
    win32: {
        url: `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2022-07-17-12-37/ffmpeg-n5.1-latest-win64-gpl-5.1.zip`,
        binaries: ["ffmpeg.exe", "ffprobe.exe"],
    },
    darwin: {
        url: `https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip`,
        binaries: ["ffmpeg", "ffprobe"],
    },
    linux: {
        x64: {
            url: `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2022-07-17-12-37/ffmpeg-n5.1-latest-linux64-gpl-5.1.tar.xz`,
            binaries: ["ffmpeg", "ffprobe"],
        },
        arm64: {
            url: `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2022-07-17-12-37/ffmpeg-n5.1-latest-linuxarm64-gpl-5.1.tar.xz`,
            binaries: ["ffmpeg", "ffprobe"],
        },
    },
};

async function installFFmpeg() {
    const platform = process.platform;
    const arch = process.arch;
    const ffmpegStaticPath = path.join(__dirname, "../node_modules/ffmpeg-static");

    // 检查是否已存在
    const ffmpegBinary = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const ffmpegPath = path.join(ffmpegStaticPath, ffmpegBinary);

    if (fs.existsSync(ffmpegPath)) {
        console.log("✓ FFmpeg already installed");
        return;
    }

    console.log(`Installing FFmpeg for ${platform}...`);

    // 方案1：尝试通过 npm 包的 install 脚本
    try {
        execSync("node node_modules/ffmpeg-static/install.js", { stdio: "inherit" });
        if (fs.existsSync(ffmpegPath)) {
            console.log("✓ FFmpeg installed via npm package");
            return;
        }
    } catch (e) {
        console.log("Failed to install via npm package, trying alternative...");
    }

    // 方案2：手动下载
    // 实现下载和解压逻辑...
}

installFFmpeg().catch(console.error);
```

##### 1.2 更新 package.json

```json
{
    "scripts": {
        "postinstall": "legacy packager install-app-deps && node scripts/install-ffmpeg.js",
        "verify:ffmpeg": "node scripts/verify-ffmpeg.js"
    }
}
```

#### 2. 配置 asarUnpack

##### 2.1 更新 legacy packager.yml

```yaml
asarUnpack:
    - resources/*
    - node_modules/ffmpeg-static/**/*
    - node_modules/ffprobe-static/**/*
    - node_modules/@ffmpeg-installer/**/*
    - node_modules/@ffprobe-installer/**/*
    # 确保包含实际的二进制文件
    - "**/*.exe" # Windows
    - "**/ffmpeg" # macOS/Linux
    - "**/ffprobe" # macOS/Linux
    - "**/*.so" # Linux shared libraries
    - "**/*.so.*" # Linux versioned libraries
```

#### 3. 增强路径查找逻辑

##### 3.1 改进 ffmpeg-config.ts

```typescript
import * as path from "path";
import * as fs from "fs-extra";
import { app } from "desktop-shell";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import { getLogger } from "@common/logger";
import { execSync } from "child_process";

const logger = getLogger("ffmpeg-config");

/**
 * 获取 FFmpeg 路径的多策略实现
 */
function getFfmpegPath(): string {
    const platform = process.platform;
    const execName = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

    // 策略列表，按优先级排序
    const strategies = [
        {
            name: "npm-package-path",
            path: () => ffmpegStatic as string,
            check: true,
        },
        {
            name: "unpacked-asar",
            path: () => {
                const original = ffmpegStatic as string;
                return original.includes("app.asar")
                    ? original.replace("app.asar", "app.asar.unpacked")
                    : null;
            },
            check: true,
        },
        {
            name: "resources-unpacked",
            path: () => {
                if (!app.isPackaged) return null;
                return path.join(
                    process.resourcesPath,
                    "app.asar.unpacked",
                    "node_modules",
                    "ffmpeg-static",
                    execName,
                );
            },
            check: true,
        },
        {
            name: "app-path",
            path: () => {
                const appPath = app.getAppPath();
                return path.join(appPath, "node_modules", "ffmpeg-static", execName);
            },
            check: true,
        },
        {
            name: "relative-to-exe",
            path: () => {
                return path.join(path.dirname(process.execPath), "resources", execName);
            },
            check: true,
        },
        {
            name: "system-path",
            path: () => "ffmpeg",
            check: false, // 不检查文件存在性，直接尝试执行
        },
    ];

    // 尝试每个策略
    for (const strategy of strategies) {
        try {
            const candidatePath = strategy.path();
            if (!candidatePath) continue;

            logger.debug(`Trying ${strategy.name}: ${candidatePath}`);

            if (strategy.check) {
                if (fs.existsSync(candidatePath)) {
                    // 验证是否可执行
                    if (platform !== "win32") {
                        try {
                            fs.accessSync(candidatePath, fs.constants.X_OK);
                        } catch {
                            logger.warn(`Found but not executable: ${candidatePath}`);
                            continue;
                        }
                    }
                    logger.info(`✓ Found FFmpeg via ${strategy.name}: ${candidatePath}`);
                    return candidatePath;
                }
            } else {
                // 尝试执行命令验证
                try {
                    execSync(`${candidatePath} -version`, {
                        stdio: "pipe",
                        timeout: 3000,
                    });
                    logger.info(`✓ Found FFmpeg in system PATH`);
                    return candidatePath;
                } catch {
                    logger.debug(`System FFmpeg not available`);
                }
            }
        } catch (error) {
            logger.debug(`Strategy ${strategy.name} failed: ${error.message}`);
        }
    }

    // 所有策略失败，记录详细信息帮助调试
    logger.error("FFmpeg binary not found. Tried locations:");
    strategies.forEach((s) => {
        const p = s.path();
        if (p) logger.error(` - ${s.name}: ${p}`);
    });

    throw new Error("FFmpeg binary not found in any expected location");
}
```

#### 4. 构建验证脚本

##### 4.1 创建 scripts/verify-ffmpeg.js

```javascript
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
};

function log(status, message) {
    const symbol = status === "success" ? "✓" : status === "error" ? "✗" : "⚠";
    const color =
        status === "success" ? colors.green : status === "error" ? colors.red : colors.yellow;
    console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function verifyDevelopment() {
    console.log("\n=== Development Environment Check ===");
    const checks = [
        {
            name: "ffmpeg-static module",
            path: path.join(__dirname, "../node_modules/ffmpeg-static"),
            type: "dir",
        },
        {
            name: "ffmpeg binary",
            path: path.join(
                __dirname,
                "../node_modules/ffmpeg-static",
                process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
            ),
            type: "file",
            executable: true,
        },
        {
            name: "ffprobe binary",
            path: path.join(
                __dirname,
                "../node_modules/ffprobe-static",
                process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
            ),
            type: "file",
            executable: true,
        },
    ];

    return performChecks(checks);
}

function verifyProduction(distPath) {
    console.log("\n=== Production Build Check ===");

    // 根据平台确定输出目录
    const platform = process.platform;
    let unpackedDir;
    if (platform === "win32") {
        unpackedDir = "win-unpacked";
    } else if (platform === "darwin") {
        unpackedDir = "mac";
    } else if (platform === "linux") {
        unpackedDir = "linux-unpacked";
    }

    const base = path.join(distPath, unpackedDir, "resources");

    const checks = [
        {
            name: "app.asar",
            path: path.join(base, "app.asar"),
            type: "file",
        },
        {
            name: "app.asar.unpacked directory",
            path: path.join(base, "app.asar.unpacked"),
            type: "dir",
        },
        {
            name: "Unpacked ffmpeg-static",
            path: path.join(base, "app.asar.unpacked", "node_modules", "ffmpeg-static"),
            type: "dir",
        },
        {
            name: "Unpacked ffmpeg binary",
            path: path.join(
                base,
                "app.asar.unpacked",
                "node_modules",
                "ffmpeg-static",
                process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
            ),
            type: "file",
            executable: true,
        },
    ];

    return performChecks(checks);
}

function performChecks(checks) {
    let allPassed = true;

    for (const check of checks) {
        try {
            const exists = fs.existsSync(check.path);
            if (!exists) {
                log("error", `${check.name}: Not found at ${check.path}`);
                allPassed = false;
                continue;
            }

            const stat = fs.statSync(check.path);
            if (check.type === "dir" && !stat.isDirectory()) {
                log("error", `${check.name}: Expected directory but found file`);
                allPassed = false;
                continue;
            }

            if (check.type === "file" && !stat.isFile()) {
                log("error", `${check.name}: Expected file but found directory`);
                allPassed = false;
                continue;
            }

            if (check.executable && process.platform !== "win32") {
                try {
                    fs.accessSync(check.path, fs.constants.X_OK);
                    log("success", `${check.name}: Found and executable`);
                } catch {
                    log("warning", `${check.name}: Found but not executable`);
                    allPassed = false;
                }
            } else {
                log("success", `${check.name}: Found`);
            }

            // 如果是二进制文件，尝试获取版本
            if (check.executable && check.path.includes("ffmpeg")) {
                try {
                    const version = execSync(`"${check.path}" -version`, {
                        stdio: "pipe",
                        timeout: 5000,
                    })
                        .toString()
                        .split("\n")[0];
                    console.log(` Version: ${version}`);
                } catch (e) {
                    log("warning", ` Could not get version: ${e.message}`);
                }
            }
        } catch (error) {
            log("error", `${check.name}: ${error.message}`);
            allPassed = false;
        }
    }

    return allPassed;
}

function main() {
    const args = process.argv.slice(2);
    const isDist = args.includes("--dist");

    console.log("FFmpeg Binary Verification Tool");
    console.log("================================");

    let success = true;

    // 总是检查开发环境
    success = verifyDevelopment() && success;

    // 如果指定了 --dist，也检查构建输出
    if (isDist) {
        const distPath = args[args.indexOf("--dist") + 1] || "dist";
        if (fs.existsSync(distPath)) {
            success = verifyProduction(distPath) && success;
        } else {
            log("warning", `Distribution path not found: ${distPath}`);
        }
    }

    console.log("\n=== Summary ===");
    if (success) {
        log("success", "All checks passed!");
        process.exit(0);
    } else {
        log("error", "Some checks failed. Please run: npm run postinstall");
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { verifyDevelopment, verifyProduction };
```

### 实施步骤

1. **Phase 1: 配置更新**

- 更新 legacy packager.yml
- 测试开发环境兼容性

2. **Phase 2: 路径逻辑增强**

- 改进 ffmpeg-config.ts
- 添加详细日志和错误处理

3. **Phase 3: 验证和测试**

- 实现构建验证脚本
- Windows 和 macOS 打包测试
- 集成到 CI/CD 流程

### 平台特定处理

#### Windows

- 二进制文件：`ffmpeg.exe`, `ffprobe.exe`
- 路径分隔符：反斜杠处理
- 权限：通常无需特殊处理

#### macOS

- 二进制文件：`ffmpeg`, `ffprobe`
- 架构：需要同时支持 x64 和 arm64
- 权限：可能需要执行权限设置
- 签名：需要处理 Gatekeeper 问题

#### Linux

- 二进制文件：`ffmpeg`, `ffprobe`
- 架构：支持 x64 和 arm64
- 权限：需要设置执行权限 (chmod +x)
- 依赖：可能需要系统库支持
- 发行版差异：需要考虑不同发行版的兼容性

## Drawbacks

1. **安装包大小增加**

- ffmpeg 二进制文件会同时存在于 asar 和 unpacked 中
- 每个平台约增加 70-100MB

2. **构建时间延长**

- 解包过程增加构建时间
- 需要额外的验证步骤

3. **复杂性增加**

- 需要维护平台特定的配置
- 增加了故障点

## Alternatives

### Alternative 1: 动态下载

- 首次运行时下载 ffmpeg
- 优点：减小安装包
- 缺点：需要网络，增加复杂性

### Alternative 2: 系统依赖

- 要求用户预装 ffmpeg
- 优点：无需打包
- 缺点：用户体验差

### Alternative 3: WebAssembly

- 使用 ffmpeg.wasm
- 优点：无需二进制文件
- 缺点：性能差，功能受限

#### 5. Linux 特定配置

##### 5.1 处理 Linux 权限

```javascript
// 在 install-ffmpeg.js 中添加
function setExecutablePermissions(filePath) {
    if (process.platform !== "win32") {
        try {
            fs.chmodSync(filePath, 0o755);
            console.log(`✓ Set executable permissions for ${filePath}`);
        } catch (error) {
            console.error(`Failed to set permissions: ${error.message}`);
        }
    }
}

// Linux 平台特定处理
if (platform === "linux") {
    const platformConfig = PLATFORMS.linux[arch] || PLATFORMS.linux.x64;

    // 下载并解压 tar.xz 文件
    // ...

    // 设置执行权限
    setExecutablePermissions(path.join(ffmpegStaticPath, "ffmpeg"));
    setExecutablePermissions(path.join(ffmpegStaticPath, "ffprobe"));

    // 检查依赖库
    try {
        execSync("ldd --version", { stdio: "pipe" });
        const deps = execSync(`ldd ${ffmpegPath}`, { encoding: "utf8" });
        if (deps.includes("not found")) {
            console.warn(
                "⚠ Some dependencies are missing. You may need to install additional libraries.",
            );
        }
    } catch (e) {
        // ldd not available or check failed
    }
}
```

##### 5.2 Linux 构建脚本

在 `package.json` 中添加：

```json
{
    "scripts": {
        "build:linux": "npm run build && npm run sharp:linux && legacy packager --linux --config && node scripts/generate-sha512.js",
        "sharp:linux": "del-cli ./node_modules/sharp && npm install --platform=linux --arch=x64 sharp --legacy-peer-deps",
        "verify:linux-deps": "node scripts/check-linux-deps.js"
    }
}
```

##### 5.3 Linux 依赖检查脚本

创建 `scripts/check-linux-deps.js`：

```javascript
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function checkLinuxDependencies() {
    if (process.platform !== "linux") {
        console.log("This script is for Linux only");
        return;
    }

    const requiredLibs = ["libavcodec.so", "libavformat.so", "libavutil.so", "libswscale.so"];

    console.log("Checking Linux dependencies for FFmpeg...");

    const ffmpegPath = path.join(__dirname, "../node_modules/ffmpeg-static/ffmpeg");

    if (!fs.existsSync(ffmpegPath)) {
        console.error("✗ FFmpeg not found. Run: npm run postinstall");
        process.exit(1);
    }

    try {
        const lddOutput = execSync(`ldd ${ffmpegPath}`, { encoding: "utf8" });
        const missingLibs = [];

        requiredLibs.forEach((lib) => {
            if (!lddOutput.includes(lib) || lddOutput.includes(`${lib} => not found`)) {
                missingLibs.push(lib);
            }
        });

        if (missingLibs.length > 0) {
            console.error("✗ Missing libraries:", missingLibs.join(", "));
            console.log("\nTo install on Ubuntu/Debian:");
            console.log(" sudo apt-get update");
            console.log(
                " sudo apt-get install libavcodec-extra libavformat-dev libavutil-dev libswscale-dev",
            );
            console.log("\nTo install on Fedora/RHEL:");
            console.log(" sudo dnf install ffmpeg-libs");
            console.log("\nTo install on Arch:");
            console.log(" sudo pacman -S ffmpeg");
            process.exit(1);
        } else {
            console.log("✓ All required libraries are present");
        }
    } catch (error) {
        console.error("Failed to check dependencies:", error.message);
        process.exit(1);
    }
}

checkLinuxDependencies();
```

## Testing Plan

### 单元测试

```typescript
describe("FFmpeg Config", () => {
    it("should find ffmpeg in development", () => {
        // 测试开发环境路径
    });

    it("should find ffmpeg in production", () => {
        // 模拟生产环境路径
    });

    it("should fallback gracefully", () => {
        // 测试回退机制
    });
});
```

### 集成测试

1. 构建应用
2. 运行验证脚本
3. 测试视频处理功能
4. 验证日志输出

### 端到端测试

- Windows 10/11 安装测试
- macOS (Intel/M1) 安装测试
- Linux (Ubuntu/Fedora/Arch) 安装测试
- 跨平台视频导入和处理测试

## Success Criteria

1. **功能恢复**

- 视频缩略图生成正常
- 视频元数据提取正常
- 无 ENOENT 错误

2. **性能指标**

- 启动时间增加 < 100ms
- 安装包增加 < 150MB

3. **兼容性**

- Windows 10/11 支持
- macOS 11+ (Intel & Apple Silicon) 支持
- Linux (主流发行版) 支持
- 开发环境无影响

## Implementation Checklist

- [ ] 更新 legacy packager.yml 配置
- [ ] 增强 ffmpeg-config.ts 路径逻辑
- [ ] 创建构建验证脚本
- [ ] Windows 平台测试
- [ ] macOS 平台测试
- [ ] Linux 平台测试 (Ubuntu/Debian)
- [ ] Linux 平台测试 (Fedora/RHEL)
- [ ] Linux 平台测试 (Arch)
- [ ] 更新文档
- [ ] CI/CD 集成

## References

- [contract reference ASAR Unpacking](https://www.legacy.build/configuration/configuration#configuration-asarUnpack)
- [ffmpeg-static npm package](https://www.npmjs.com/package/ffmpeg-static)
- [contract reference Builder Configuration](https://www.legacy.build/configuration/configuration)

## 路径传递架构实现

### 主进程配置 FFmpeg 路径

在主进程启动时配置 FFmpeg 路径，并将路径传递给 Worker：

```typescript
// src/main/index.ts 或相关服务
import { configureFFmpeg } from "./utils/ffmpeg-config";

// 在应用启动时配置
const ffmpegConfig = configureFFmpeg();

// 将路径传递给 Worker
worker.postMessage({
    type: "ffmpeg-config",
    ffmpegPath: ffmpegConfig.ffmpegPath,
    ffprobePath: ffmpegConfig.ffprobePath,
});
```

### Worker 进程接收路径

Worker 进程接收路径并配置 FFmpeg：

```typescript
// Worker 进程中的处理
let ffmpegPath: string;
let ffprobePath: string;

parentPort?.on("message", (message) => {
    if (message.type === "ffmpeg-config") {
        ffmpegPath = message.ffmpegPath;
        ffprobePath = message.ffprobePath;

        // 配置 FFmpeg
        ffmpeg.setFfmpegPath(ffmpegPath);
        ffmpeg.setFfprobePath(ffprobePath);
    }
});
```

### 函数参数传递

修改需要 FFmpeg 的函数，添加路径参数：

```typescript
// 修改前
function getVideoDimension(video: string): Promise<VideoSize> {
    configureFFmpeg(); // 这会导致 Worker 错误
    // ...
}

// 修改后
function getVideoDimension(
    video: string,
    ffmpegPath?: string,
    ffprobePath?: string,
): Promise<VideoSize> {
    if (ffmpegPath && ffprobePath) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        ffmpeg.setFfprobePath(ffprobePath);
    }
    // ...
}
```

## Unresolved Questions

1. ~~是否需要支持 Linux 平台？~~ (已添加支持)
2. 如何处理 ffmpeg 版本更新？
3. 是否需要提供降级到系统 ffmpeg 的选项？
4. macOS 代码签名的具体处理方式？
