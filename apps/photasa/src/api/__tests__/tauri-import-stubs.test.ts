import { describe, expect, it } from "vitest";
import {
    EMPTY_IMPORT_PREVIEW,
    emptyUndoPreview,
    noopUndoResult,
    placeholderMetadataFromRequest,
} from "../tauri-import-stubs";

describe("tauri-import-stubs", () => {
    it("EMPTY_IMPORT_PREVIEW 使用空 Map 与零统计", () => {
        expect(EMPTY_IMPORT_PREVIEW.fileGroups).toEqual([]);
        expect(EMPTY_IMPORT_PREVIEW.duplicates).toEqual([]);
        expect(EMPTY_IMPORT_PREVIEW.targetStructure.size).toBe(0);
        expect(EMPTY_IMPORT_PREVIEW.estimatedDuration).toBe(0);
    });

    it("emptyUndoPreview 标记不可撤销", () => {
        const p = emptyUndoPreview("hid-1");
        expect(p.historyId).toBe("hid-1");
        expect(p.canUndo).toBe(false);
        expect(p.potentialIssues).toEqual([]);
    });

    it("noopUndoResult 为无文件删除的成功占位", () => {
        const r = noopUndoResult();
        expect(r.success).toBe(true);
        expect(r.deletedFiles).toEqual([]);
        expect(r.errors).toEqual([]);
    });

    it("placeholderMetadataFromRequest 从请求取出路径", () => {
        const m = placeholderMetadataFromRequest({ filePath: "/tmp/a.jpg" });
        expect(m.path).toBe("/tmp/a.jpg");
        expect(m.name).toBe("a.jpg");
        expect(m.size).toBe(0);
    });
});
