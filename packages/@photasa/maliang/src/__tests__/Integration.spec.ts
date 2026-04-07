import { describe, test, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs-extra";
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { HeicBrush } from "../brushes/heif/HeicBrush";
import { BmpBrush } from "../brushes/image/BmpBrush";
import { FallbackBrush } from "../brushes/generic/FallbackBrush";
import { SharpBrush } from "../brushes/image/SharpBrush";
import { getLogger } from "@photasa/common";
import type { MagicBrush } from "../core/MagicBrush";

const logger = getLogger("integration-test");

describe("Maliang Integration Tests", () => {
    // ESM compatible __dirname
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const imagesDir = path.join(__dirname, "./images");
    const outputDir = path.join(__dirname, "./output");

    // Ensure output directory exists and cleanup previous runs
    beforeAll(async () => {
        await fs.emptyDir(outputDir);
        await fs.ensureDir(outputDir);
    });

    // Cleanup after tests
    afterAll(async () => {
        await fs.remove(outputDir);
    });

    // Helper to get all image files
    const getImageFiles = () => {
        if (!fs.existsSync(imagesDir)) {
            return [];
        }
        return fs
            .readdirSync(imagesDir)
            .filter((file) => !file.startsWith("."))
            .map((file) => ({
                name: file,
                path: path.join(imagesDir, file),
                ext: path.extname(file).toLowerCase(),
            }));
    };

    const testFiles = getImageFiles();

    test.each(testFiles)(
        "should process $name",
        async ({ name, path: inputPath, ext }) => {
            let brush: MagicBrush;

            // Select appropriate brush
            switch (ext) {
                case ".heic":
                case ".heif":
                    brush = new HeicBrush();
                    break;
                case ".bmp":
                    brush = new BmpBrush();
                    break;
                case ".jpg":
                case ".jpeg":
                case ".png":
                case ".webp":
                case ".gif":
                    brush = new SharpBrush();
                    break;
                default:
                    // Use FallbackBrush for unknown extensions
                    brush = new FallbackBrush();
                    break;
            }

            // Initialize if required
            if (brush.initialize) {
                await brush.initialize({}, logger);
            }

            const outputFormat = ext === ".jpg" || ext === ".jpeg" ? "jpeg" : "png";
            const outputFilename = `${name.replace(ext, "")}_thumb.${outputFormat}`;
            const outputPath = path.join(outputDir, outputFilename);

            expect(await fs.pathExists(inputPath)).toBe(true);

            const result = await brush.createMiniature(
                inputPath,
                {
                    width: 200,
                    height: 200,
                    outputPath,
                    format: outputFormat as any,
                },
                logger,
            );

            expect(result).toBe(outputPath);
            expect(await fs.pathExists(outputPath)).toBe(true);

            const stats = await fs.stat(outputPath);
            expect(stats.size).toBeGreaterThan(0);

            // Tier 1 Validation: Metadata Check
            try {
                const metadata = await sharp(outputPath).metadata();

                // Verify format
                expect(metadata.format).toBe(outputFormat === "jpeg" ? "jpeg" : "png");

                // Verify dimensions (fit: cover/contain/inside logic implies at least one dim <= 200)
                // Since we use fit 'inside' (default usually), both should be <= 200
                expect(metadata.width).toBeLessThanOrEqual(200);
                expect(metadata.height).toBeLessThanOrEqual(200);

                // Log for verification
                console.log(
                    `Verified ${name} output: ${metadata.width}x${metadata.height} ${metadata.format}`,
                );
            } catch (error) {
                throw new Error(`Failed to validate output image ${outputFilename}: ${error}`);
            }

            // Tier 2 Validation: Visual Regression (Snapshot Testing)
            try {
                const snapshotDir = path.join(__dirname, "./__snapshots__");
                // Fix: Include original extension/suffix to avoid collision since all files are named 'test'
                // e.g. test.bmp -> test_bmp_snapshot.png
                const safeName = name.replace(".", "_");
                const snapshotPath = path.join(snapshotDir, `${safeName}_snapshot.png`);

                // Ensure snapshot directory exists
                await fs.ensureDir(snapshotDir);

                // Get raw pixel data of current output
                // We convert to PNG 4-channel first to ensure consistent comparison environment
                const currentImage = sharp(outputPath);
                const { data: currentPixels, info: currentInfo } = await currentImage
                    .ensureAlpha()
                    .resize(200, 200, { fit: "inside" }) // Normalize size if needed, but output should already be this
                    .raw()
                    .toBuffer({ resolveWithObject: true });

                if (!fs.existsSync(snapshotPath)) {
                    // If snapshot doesn't exist, create it (Golden Master)
                    console.log(
                        `Snapshot missing for ${name}, creating golden master at ${snapshotPath}`,
                    );
                    await currentImage.png().toFile(snapshotPath);
                } else {
                    // Compare with snapshot
                    const snapshotImage = sharp(snapshotPath);
                    const { data: snapshotPixels, info: snapshotInfo } = await snapshotImage
                        .ensureAlpha()
                        .raw()
                        .toBuffer({ resolveWithObject: true });

                    // Verify dimensions match
                    if (
                        currentInfo.width !== snapshotInfo.width ||
                        currentInfo.height !== snapshotInfo.height
                    ) {
                        throw new Error(
                            `Snapshot dimension mismatch: expected ${snapshotInfo.width}x${snapshotInfo.height}, got ${currentInfo.width}x${currentInfo.height}`,
                        );
                    }

                    // Prepare diff buffer
                    const diffPixels = Buffer.alloc(currentPixels.length);

                    // Calculate pixel difference
                    const numDiffPixels = pixelmatch(
                        currentPixels,
                        snapshotPixels,
                        diffPixels,
                        currentInfo.width,
                        currentInfo.height,
                        { threshold: 0.1 },
                    );

                    if (numDiffPixels > 0) {
                        // Save diff image for inspection
                        const diffOutputPath = path.join(outputDir, `${name}_diff.png`);
                        await sharp(diffPixels, {
                            raw: {
                                width: currentInfo.width,
                                height: currentInfo.height,
                                channels: 4,
                            },
                        })
                            .png()
                            .toFile(diffOutputPath);

                        throw new Error(
                            `Visual regression detected! ${numDiffPixels} pixels differ. Diff saved to ${diffOutputPath}`,
                        );
                    } else {
                        console.log(`Visual regression check passed for ${name}`);
                    }
                }
            } catch (error) {
                // Warn but don't fail yet if this is experimental, or fail if "present requirement"
                // User said "present requirement", so we throw.
                throw new Error(`Visual regression failed for ${name}: ${error}`);
            }

            // Cleanup
            if (brush.cleanup) {
                await brush.cleanup(logger);
            }
            // HEIC/WASM 解码在部分机器上可能超过 Vitest 默认 5s，避免 pre-push 误杀
        },
        60_000,
    );
});
