/**
 * BMP + MaLiang 集成测试 (Jest)
 * 验证修复后的 BMP 文件通过 MaLiang 引擎处理缩略图
 */

import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createThumbnail } from "../thumbnail-handler";
import type { ThumbnailRequest } from "@photasa/common";
import type { Logger } from "log4js";
import sharp from "sharp";
import { describe, it, beforeEach, afterEach, expect } from "@jest/globals";

// 使用真实的 lena.bmp 文件
const REAL_BMP_PATH = join(__dirname, "data", "lena.bmp");

describe("BMP + MaLiang Integration (修复后)", () => {
    let tempDir: string;
    let logger: Logger;

    beforeEach(async () => {
        // 创建临时目录（用于存放输出的缩略图）
        tempDir = await fs.mkdtemp(join(tmpdir(), "maliang-fixed-test-"));

        // 验证真实的 lena.bmp 文件存在
        const bmpExists = await fs
            .access(REAL_BMP_PATH)
            .then(() => true)
            .catch(() => false);

        if (!bmpExists) {
            throw new Error(`Real BMP file not found: ${REAL_BMP_PATH}`);
        }

        // 初始化模拟日志记录器
        logger = {
            info: console.log,
            warn: console.warn,
            error: console.error,
            debug: console.debug,
        } as Logger;
    });

    afterEach(async () => {
        // 清理临时文件
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn("Failed to cleanup temp directory:", error);
        }
    });

    it("应该成功处理真实 BMP 文件（修复后的 BmpBrush）", async () => {
        const thumbnailPath = join(tempDir, "bmp-thumbnail.png");
        const request: ThumbnailRequest = {
            path: REAL_BMP_PATH,
            thumbnail: thumbnailPath,
            width: 150,
            height: 150,
            always: true,
            withoutEnlargement: false,
            preview: "",
        };

        const result = await createThumbnail(request, logger);

        expect(result).toBeDefined();
        expect(result.path).toBe(REAL_BMP_PATH);
        expect(result.thumbnail).toBe(thumbnailPath);

        // 验证缩略图文件是否存在且有内容
        const thumbnailExists = await fs
            .access(thumbnailPath)
            .then(() => true)
            .catch(() => false);
        expect(thumbnailExists).toBe(true);

        // 验证缩略图实际有内容（不是0字节）
        const stats = await fs.stat(thumbnailPath);
        expect(stats.size).toBeGreaterThan(0);

        // 验证缩略图格式和尺寸
        const metadata = await sharp(thumbnailPath).metadata();
        expect(metadata.format).toBe("png");
        expect(metadata.width).toBeLessThanOrEqual(150);
        expect(metadata.height).toBeLessThanOrEqual(150);
    });
});
