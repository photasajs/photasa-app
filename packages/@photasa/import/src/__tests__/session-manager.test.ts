import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    ImportSessionManager,
    generateImportSessionId,
    createInitialImportProgress,
} from "../session-manager";
import type { ImportConfig } from "@photasa/common";

const minimalConfig = (): ImportConfig => ({
    sourcePaths: ["/src"],
    targetPath: "/dst",
    duplicateStrategy: "skip",
    fileGroups: [],
    selectedFiles: [],
    allowDuplicateRename: false,
    filters: {
        fileTypes: [],
        sizeRange: { min: 0, max: 1e12 },
        dateRange: { start: new Date(0), end: new Date() },
        includeSubfolders: true,
    },
});

describe("ImportSessionManager", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("generateImportSessionId 以 import_ 开头", () => {
        expect(generateImportSessionId()).toMatch(/^import_\d+_[a-z0-9]+$/);
    });

    it("createInitialImportProgress status preparing", () => {
        const p = createInitialImportProgress();
        expect(p.status).toBe("preparing");
        expect(p.processedFiles).toBe(0);
    });

    it("applyProgressFromWorker 更新会话进度", () => {
        const m = new ImportSessionManager();
        m.createPreparingSession("id1", minimalConfig());
        const session = m.applyProgressFromWorker("id1", {
            processedFiles: 2,
            totalFiles: 10,
            successfulFiles: 2,
            skippedFiles: 0,
            errorFiles: 0,
            currentFile: "a.jpg",
            speed: 1,
            estimatedTimeRemaining: 5,
        });
        expect(session?.progress.processedFiles).toBe(2);
        expect(session?.progress.totalFiles).toBe(10);
    });

    it("requestCancel 在处理中时会切为 cancelled", () => {
        const m = new ImportSessionManager();
        m.createPreparingSession("id1", minimalConfig());
        const s = m.getSession("id1")!;
        s.status = "processing";
        m.requestCancel("id1");
        expect(s.status).toBe("cancelled");
        expect(s.cancelRequested).toBe(true);
    });

    it("scheduleSessionRemoval 到期后移除会话", () => {
        const m = new ImportSessionManager();
        m.createPreparingSession("id1", minimalConfig());
        m.scheduleSessionRemoval("id1", 1000);
        expect(m.getActiveSessionsCount()).toBe(1);
        vi.advanceTimersByTime(1000);
        expect(m.getSession("id1")).toBeUndefined();
    });

    it("clearAllTimersAndSessions 清空", () => {
        const m = new ImportSessionManager();
        m.createPreparingSession("id1", minimalConfig());
        m.clearAllTimersAndSessions();
        expect(m.getActiveSessionsCount()).toBe(0);
    });
});
