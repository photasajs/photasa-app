import { describe, it, expect } from "vitest";
import { normalizeImportProgressPayload } from "../import.adapter";

describe("normalizeImportProgressPayload", () => {
    it("应将 Rust 扁平 JSON 转为 ImportProgress（含 startTime 为 Date）", () => {
        const raw = {
            totalFiles: 10,
            processedFiles: 3,
            successfulFiles: 2,
            skippedFiles: 1,
            errorFiles: 0,
            speed: 1.5,
            estimatedTimeRemaining: 12,
            remainingTime: 12,
            currentFile: "/a/b.jpg",
            startTime: "2025-01-01T00:00:00.000Z",
            errors: [],
            warnings: [],
            status: "processing",
        };
        const p = normalizeImportProgressPayload(raw);
        expect(p.totalFiles).toBe(10);
        expect(p.processedFiles).toBe(3);
        expect(p.startTime).toBeInstanceOf(Date);
        expect(p.startTime.toISOString()).toBe("2025-01-01T00:00:00.000Z");
        expect(p.status).toBe("processing");
    });

    it("应支持嵌套 progress 字段", () => {
        const p = normalizeImportProgressPayload({
            progress: {
                totalFiles: 1,
                processedFiles: 1,
                successfulFiles: 1,
                skippedFiles: 0,
                errorFiles: 0,
                speed: 0,
                estimatedTimeRemaining: 0,
                remainingTime: 0,
                startTime: new Date("2024-06-01T12:00:00.000Z"),
                errors: [],
                warnings: [],
                status: "completed",
            },
        });
        expect(p.totalFiles).toBe(1);
        expect(p.status).toBe("completed");
    });

    it("应在非法输入时返回安全默认值", () => {
        const p = normalizeImportProgressPayload(null);
        expect(p.totalFiles).toBe(0);
        expect(p.status).toBe("processing");
    });
});
