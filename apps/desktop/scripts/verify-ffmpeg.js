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
            path: (() => {
                try {
                    return path.dirname(require.resolve("ffmpeg-static/package.json"));
                } catch {
                    return path.join(__dirname, "../node_modules/ffmpeg-static");
                }
            })(),
            type: "dir",
        },
        {
            name: "ffmpeg binary",
            path: path.join(
                (() => {
                    try {
                        return path.dirname(require.resolve("ffmpeg-static/package.json"));
                    } catch {
                        return path.join(__dirname, "../node_modules/ffmpeg-static");
                    }
                })(),
                process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
            ),
            type: "file",
            executable: true,
        },
        {
            name: "ffprobe binary",
            path: path.join(
                (() => {
                    try {
                        return path.join(
                            path.dirname(require.resolve("ffprobe-static/package.json")),
                            "bin",
                            process.platform,
                            process.arch,
                        );
                    } catch {
                        return path.join(
                            __dirname,
                            "../node_modules/ffprobe-static/bin",
                            process.platform,
                            process.arch,
                        );
                    }
                })(),
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
                    console.log(`    Version: ${version}`);
                } catch (e) {
                    log("warning", `    Could not get version: ${e.message}`);
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
