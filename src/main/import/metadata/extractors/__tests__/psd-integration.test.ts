import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFile } from "fs-extra";
import path from "path";
import { isPsdFile, extractPsdMetadata } from "../psd-extractor";
import type { PhotasaLogger } from "@common/logger";

// Mock logger for integration test
const mockLogger: PhotasaLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
} as any;

describe("PSD Extractor Integration Test", () => {
    let testPsdPath: string;
    let testPsdBuffer: Buffer;

    beforeAll(async () => {
        // 初始化Canvas (ag-psd需要)
        await import("ag-psd/initialize-canvas");

        // 获取测试PSD文件路径
        testPsdPath = path.join(__dirname, "data", "test.psd");

        try {
            testPsdBuffer = await readFile(testPsdPath);
            console.log(`📁 找到测试PSD文件: ${testPsdPath}`);
            console.log(`📊 文件大小: ${testPsdBuffer.length} bytes`);
        } catch (error) {
            console.warn(`⚠️  无法读取测试PSD文件: ${error}`);
            testPsdPath = "";
        }
    });

    it("should detect PSD file correctly", () => {
        if (!testPsdPath) {
            console.log("⏭️  跳过测试 - 没有测试PSD文件");
            return;
        }

        expect(isPsdFile(testPsdPath)).toBe(true);
        expect(isPsdFile("test.jpg")).toBe(false);
        expect(isPsdFile("test.png")).toBe(false);
    });

    it("should extract metadata from real PSD file", async () => {
        if (!testPsdPath) {
            console.log("⏭️  跳过测试 - 没有测试PSD文件");
            return;
        }

        try {
            const metadata = await extractPsdMetadata(testPsdPath, mockLogger);

            console.log("📋 提取的元数据:");
            console.log(`   - 路径: ${metadata.path}`);
            console.log(`   - 名称: ${metadata.name}`);
            console.log(`   - 类型: ${metadata.type}`);
            console.log(`   - 格式: ${metadata.format}`);
            console.log(`   - 尺寸: ${metadata.width}x${metadata.height}`);
            console.log(`   - 图层数: ${metadata.layers}`);
            console.log(`   - 颜色模式: ${metadata.colorMode}`);
            console.log(`   - 版本: ${metadata.version}`);
            console.log(`   - 有透明度: ${metadata.hasTransparency ? "是" : "否"}`);
            console.log(`   - 画板数: ${metadata.artboardCount}`);

            // 验证基本属性
            expect(metadata).toBeDefined();
            expect(metadata.path).toBe(testPsdPath);
            expect(metadata.name).toBe("test.psd");
            expect(metadata.type).toBe("ai");
            expect(metadata.format).toBe("PSD");
            expect(metadata.width).toBeGreaterThan(0);
            expect(metadata.height).toBeGreaterThan(0);
            expect(typeof metadata.layers).toBe("number");
            expect(typeof metadata.colorMode).toBe("string");
            expect(typeof metadata.version).toBe("string");
            expect(typeof metadata.hasTransparency).toBe("boolean");
            expect(typeof metadata.artboardCount).toBe("number");

            // 验证日志调用
            expect(mockLogger.info).toHaveBeenCalledWith(
                `[psd-extractor] Successfully extracted PSD metadata for ${testPsdPath}`,
            );
        } catch (error) {
            console.error("❌ PSD元数据提取失败:", error);
            throw error;
        }
    });

    it("should handle PSD file with ag-psd directly", async () => {
        if (!testPsdPath) {
            console.log("⏭️  跳过测试 - 没有测试PSD文件");
            return;
        }

        try {
            // 直接使用ag-psd测试
            const { readPsd } = await import("ag-psd");
            const psd = readPsd(testPsdBuffer as any);

            console.log("🔧 ag-psd直接解析结果:");
            console.log(`   - 宽度: ${psd.width}px`);
            console.log(`   - 高度: ${psd.height}px`);
            console.log(`   - 颜色模式: ${psd.colorMode}`);
            console.log(`   - 版本: ${psd.version}`);
            console.log(`   - 图层数量: ${psd.children?.length || 0}`);
            console.log(`   - 是否有画布: ${psd.canvas ? "是" : "否"}`);

            // 验证ag-psd解析结果
            expect(psd).toBeDefined();
            expect(psd.width).toBeGreaterThan(0);
            expect(psd.height).toBeGreaterThan(0);
            expect(typeof psd.colorMode).toBe("number");
            // children可能是undefined，这是正常的
            if (psd.children) {
                expect(Array.isArray(psd.children)).toBe(true);
            }

            if (psd.children && psd.children.length > 0) {
                console.log("🎨 图层信息:");
                psd.children.forEach((layer, index) => {
                    console.log(
                        `   ${index + 1}. ${layer.name || "未命名图层"} (${(layer as any).width || "N/A"}x${(layer as any).height || "N/A"})`,
                    );
                });
            }
        } catch (error) {
            console.error("❌ ag-psd直接解析失败:", error);
            throw error;
        }
    });
});
