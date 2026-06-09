import { describe, it, expect } from "vitest";
import {
    normalizeImportConfigDate,
    createDefaultImportFilters,
    processImportConfigForWorker,
    createSerializableWorkerError,
} from "../import-config-normalize";
import type { ImportConfigWorkerInput } from "../import-config-normalize";

describe("import-config-normalize", () => {
    it("normalizeImportConfigDate", () => {
        const d = new Date("2020-01-01T00:00:00.000Z");
        expect(normalizeImportConfigDate(d)).toBe(d);
        const s = normalizeImportConfigDate("2021-06-15T12:00:00.000Z");
        expect(s.toISOString()).toBe("2021-06-15T12:00:00.000Z");
    });

    it("createDefaultImportFilters 含日期与 includeSubfolders", () => {
        const f = createDefaultImportFilters();
        expect(f.includeSubfolders).toBe(true);
        expect(f.fileTypes).toEqual([]);
        expect(f.dateRange.start.getTime()).toBe(0);
    });

    it("processImportConfigForWorker 规范化 dateRange", () => {
        const cfg: ImportConfigWorkerInput = {
            sourcePaths: ["/a"],
            targetPath: "/t",
            duplicateStrategy: "skip",
            fileGroups: [],
            selectedFiles: [],
            allowDuplicateRename: false,
            filters: {
                fileTypes: [],
                sizeRange: { min: 0, max: 100 },
                dateRange: {
                    start: "2019-01-01T00:00:00.000Z",
                    end: "2019-12-31T00:00:00.000Z",
                },
                includeSubfolders: true,
            },
        };
        const out = processImportConfigForWorker(cfg);
        expect(out.filters?.dateRange.start).toBeInstanceOf(Date);
        expect(out.filters?.dateRange.end).toBeInstanceOf(Date);
    });

    it("processImportConfigForWorker 无 filters 时用默认", () => {
        const cfg: ImportConfigWorkerInput = {
            sourcePaths: ["/a"],
            targetPath: "/t",
            duplicateStrategy: "skip",
            fileGroups: [],
            selectedFiles: [],
            allowDuplicateRename: false,
        };
        const out = processImportConfigForWorker(cfg);
        expect(out.filters).toBeDefined();
        expect(out.filters?.includeSubfolders).toBe(true);
    });

    it("createSerializableWorkerError", () => {
        const e = createSerializableWorkerError(new Error("x"));
        expect(e.message).toBe("x");
        expect(e.name).toBe("Error");
        const s = createSerializableWorkerError("plain");
        expect(s.message).toBe("plain");
        expect(s.name).toBeUndefined();
    });
});
