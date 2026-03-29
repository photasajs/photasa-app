import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFile } from "fs-extra";
import path from "path";
import { isPsdFile, extractPsdMetadata } from "../psd-extractor";
import type { PhotasaLogger } from "@photasa/common";

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await import("ag-psd/initialize-canvas" as any);

        // 获取测试PSD文件路径
        testPsdPath = path.join(__dirname, "data", "test.psd");

        try {
            testPsdBuffer = await readFile(testPsdPath);
            // PSD test file found and loaded successfully
        } catch (error) {
            testPsdPath = "";
        }
    });

    it("should detect PSD file correctly", () => {
        if (!testPsdPath) {
            expect.assertions(0); // Skip test if no PSD file found
            return;
        }

        expect(isPsdFile(testPsdPath)).toBe(true);
        expect(isPsdFile("test.jpg")).toBe(false);
        expect(isPsdFile("test.png")).toBe(false);
    });

    it("should extract metadata from real PSD file", async () => {
        if (!testPsdPath) {
            expect.assertions(0); // Skip test if no PSD file found
            return;
        }

        const metadata = await extractPsdMetadata(testPsdPath, mockLogger);

        // Verify extracted metadata properties are valid

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
    });

    it("should handle PSD file with ag-psd directly", async () => {
        if (!testPsdPath) {
            expect.assertions(0); // Skip test if no PSD file found
            return;
        }

        // 直接使用ag-psd测试
        const { readPsd } = await import("ag-psd");
        const psd = readPsd(testPsdBuffer as any);

        // Verify ag-psd parsing results

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
            // Verify layer information is accessible
            psd.children.forEach((layer) => {
                expect(layer).toBeDefined();
            });
        }
    });
});
