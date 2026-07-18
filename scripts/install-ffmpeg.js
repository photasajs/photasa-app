const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const FFMPEG_VERSION = "5.1.2";
const PLATFORMS = {
    win32: {
        url: `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2022-07-17-12-37/ffmpeg-n${FFMPEG_VERSION}-latest-win64-gpl-${FFMPEG_VERSION}.zip`,
        binaries: ["ffmpeg.exe", "ffprobe.exe"],
    },
    darwin: {
        url: `https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip`,
        binaries: ["ffmpeg", "ffprobe"],
    },
    linux: {
        x64: {
            url: `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2022-07-17-12-37/ffmpeg-n${FFMPEG_VERSION}-latest-linux64-gpl-${FFMPEG_VERSION}.tar.xz`,
            binaries: ["ffmpeg", "ffprobe"],
        },
        arm64: {
            url: `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2022-07-17-12-37/ffmpeg-n${FFMPEG_VERSION}-latest-linuxarm64-gpl-${FFMPEG_VERSION}.tar.xz`,
            binaries: ["ffmpeg", "ffprobe"],
        },
    },
};

/**
 * 根据平台和架构获取配置
 */
function getPlatformConfig(platform, arch) {
    if (platform === "linux") {
        return PLATFORMS.linux[arch] || PLATFORMS.linux.x64;
    }
    return PLATFORMS[platform];
}

async function installFFmpeg() {
    const platform = process.platform;
    const arch = process.arch;
    let ffmpegStaticPath;
    try {
        ffmpegStaticPath = path.dirname(require.resolve("ffmpeg-static/package.json"));
    } catch (e) {
        ffmpegStaticPath = path.join(__dirname, "../node_modules/ffmpeg-static");
    }

    // 检查是否已存在
    const ffmpegBinary = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const ffmpegPath = path.join(ffmpegStaticPath, ffmpegBinary);

    if (fs.existsSync(ffmpegPath)) {
        console.log("✓ FFmpeg already installed");
        return;
    }

    console.log(`Installing FFmpeg ${FFMPEG_VERSION} for ${platform} ${arch}...`);

    // 方案1：尝试通过 npm 包的 install 脚本
    try {
        const installScript = path.join(ffmpegStaticPath, "install.js");
        execSync(`node "${installScript}"`, { stdio: "inherit" });
        if (fs.existsSync(ffmpegPath)) {
            console.log("✓ FFmpeg installed via npm package");
            return;
        }
    } catch (e) {
        console.log("Failed to install via npm package, trying alternative...");
    }

    // 方案2：手动下载
    // 根据平台和架构选择不同的处理方式
    if (platform === "linux") {
        handleLinuxInstallation();
    } else {
        const platformConfig = getPlatformConfig(platform, arch);
        console.log(
            `Manual download not implemented yet for ${platform} ${arch}. Please run: npm install ffmpeg-static --force`,
        );
        console.log(`Download URL would be: ${platformConfig.url}`);
    }
}

/**
 * 设置文件执行权限
 */
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

/**
 * Linux 平台特定处理
 */
function handleLinuxInstallation() {
    const arch = process.arch;
    const platformConfig = PLATFORMS.linux[arch] || PLATFORMS.linux.x64;

    console.log(`Installing FFmpeg ${FFMPEG_VERSION} for Linux ${arch}...`);
    console.log(`Download URL: ${platformConfig.url}`);
    console.log(`Binaries: ${platformConfig.binaries.join(", ")}`);

    // 下载并解压 tar.xz 文件
    // 这里需要实现下载和解压逻辑

    // 设置执行权限
    const ffmpegStaticPath = path.join(__dirname, "../node_modules/ffmpeg-static");
    setExecutablePermissions(path.join(ffmpegStaticPath, "ffmpeg"));
    setExecutablePermissions(path.join(ffmpegStaticPath, "ffprobe"));

    // 检查依赖库
    try {
        execSync("ldd --version", { stdio: "pipe" });
        const ffmpegPath = path.join(ffmpegStaticPath, "ffmpeg");
        if (fs.existsSync(ffmpegPath)) {
            const deps = execSync(`ldd ${ffmpegPath}`, { encoding: "utf8" });
            if (deps.includes("not found")) {
                console.warn(
                    "⚠ Some dependencies are missing. You may need to install additional libraries.",
                );
            }
        }
    } catch (e) {
        // ldd not available or check failed
    }
}

if (require.main === module) {
    installFFmpeg().catch(console.error);
}

module.exports = { installFFmpeg, setExecutablePermissions };
