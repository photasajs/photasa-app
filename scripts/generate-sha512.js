#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * 生成文件的SHA512哈希值并保存到文件
 */
function generateSHA512(filePath, outputPath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha512");
        const stream = fs.createReadStream(filePath);

        stream.on("data", (data) => {
            hash.update(data);
        });

        stream.on("end", () => {
            const sha512 = hash.digest("hex");
            const fileName = path.basename(filePath);
            const fileSize = fs.statSync(filePath).size;

            const output = {
                file: fileName,
                path: filePath,
                sha512: sha512,
                size: fileSize,
                generated: new Date().toISOString(),
            };

            // 保存到JSON文件
            fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

            console.log(`SHA512 generated for ${fileName}:`);
            console.log(`Hash: ${sha512}`);
            console.log(`Size: ${fileSize} bytes`);
            console.log(`Saved to: ${outputPath}`);

            resolve(sha512);
        });

        stream.on("error", reject);
    });
}

/**
 * 确定当前平台的更新文件名模式
 */
function getPlatformPattern() {
    const platform = process.platform;
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"),
    );
    const productName = packageJson.productName || packageJson.name;
    const version = packageJson.version;

    switch (platform) {
        case "darwin": // macOS
            return `${productName}-${version}-mac.zip`;
        case "win32": // Windows
            return `${productName}-${version}-win.zip`;
        case "linux": // Linux
            return `${productName}-${version}-linux.zip`;
        default:
            return null;
    }
}

/**
 * 扫描dist目录并为匹配的zip文件生成SHA512
 */
async function generateAllSHA512(targetPlatform = null) {
    const distDir = path.join(__dirname, "../dist");

    if (!fs.existsSync(distDir)) {
        console.error("dist directory not found. Please run build first.");
        process.exit(1);
    }

    const files = fs.readdirSync(distDir);
    let zipFiles = files.filter((file) => file.endsWith(".zip"));

    // 如果指定了目标平台，只处理该平台的文件
    if (targetPlatform) {
        const packageJson = JSON.parse(
            fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"),
        );
        const productName = packageJson.productName || packageJson.name;
        const version = packageJson.version;

        const platformPattern = `${productName}-${version}-${targetPlatform}.zip`;
        zipFiles = zipFiles.filter((file) => file === platformPattern);

        if (zipFiles.length === 0) {
            console.log(`No zip file found for platform: ${targetPlatform}`);
            console.log(`Expected: ${platformPattern}`);
            console.log(`Available files: ${files.filter((f) => f.endsWith(".zip")).join(", ")}`);
            return;
        }
    } else {
        // 自动检测当前平台
        const currentPlatformFile = getPlatformPattern();
        if (currentPlatformFile && zipFiles.includes(currentPlatformFile)) {
            zipFiles = [currentPlatformFile];
            console.log(`Auto-detected platform file: ${currentPlatformFile}`);
        }
    }

    if (zipFiles.length === 0) {
        console.log("No zip files found in dist directory.");
        return;
    }

    console.log(`Processing ${zipFiles.length} zip file(s):`);

    for (const zipFile of zipFiles) {
        const filePath = path.join(distDir, zipFile);
        const outputPath = path.join(distDir, `${zipFile}.sha512.json`);

        try {
            await generateSHA512(filePath, outputPath);
            console.log("---");
        } catch (error) {
            console.error(`Error generating SHA512 for ${zipFile}:`, error);
        }
    }
}

// 如果作为脚本直接运行
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        // 扫描所有zip文件
        generateAllSHA512().catch(console.error);
    } else if (args.length === 2) {
        // 为特定文件生成SHA512
        const [inputFile, outputFile] = args;
        generateSHA512(inputFile, outputFile).catch(console.error);
    } else {
        console.log("Usage:");
        console.log("  node generate-sha512.js                    # Scan dist/ for all zip files");
        console.log("  node generate-sha512.js <input> <output>   # Generate for specific file");
    }
}

module.exports = { generateSHA512, generateAllSHA512 };
