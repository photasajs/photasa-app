/**
 * RFC 0118 — import-session store（T1.4–T1.7）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import {
    IMPORT_ALREADY_RUNNING,
    useImportSessionStore,
} from "../import-session";
import type { ImportProgress, ImportResult } from "@photasa/common";

vi.mock("@renderer/api/env", () => ({
    isTauri: () => false,
}));

vi.mock("@renderer/services/notification-manager", () => ({
    notification: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock("@photasa/common", async () => {
    const actual = await vi.importActual<typeof import("@photasa/common")>("@photasa/common");
    return {
        ...actual,
        loggers: {
            ...actual.loggers,
            importProgress: {
                debug: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
            },
        },
    };
});

function sampleProgress(partial: Partial<ImportProgress> = {}): ImportProgress {
    return {
        totalFiles: 10,
        processedFiles: 3,
        successfulFiles: 2,
        skippedFiles: 1,
        errorFiles: 0,
        speed: 1,
        estimatedTimeRemaining: 7,
        remainingTime: 7,
        startTime: new Date(),
        errors: [],
        warnings: [],
        status: "processing",
        currentFile: "a.jpg",
        ...partial,
    };
}

describe("useImportSessionStore (RFC 0118)", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it("T1.6 canStart false while running", async () => {
        const store = useImportSessionStore();
        await store.begin("id-1");
        expect(store.canStart).toBe(false);
        expect(store.isActive).toBe(true);
        expect(() => store.assertCanStart()).toThrow(IMPORT_ALREADY_RUNNING);
    });

    it("T1.4 applyProgress while dismissed updates session", async () => {
        const store = useImportSessionStore();
        await store.begin("id-2", { totalFiles: 10 });
        store.setModalVisible(false);
        store.applyProgress(sampleProgress({ processedFiles: 5, totalFiles: 10 }));
        expect(store.progress?.processedFiles).toBe(5);
        expect(store.phase).toBe("running");
        expect(store.importId).toBe("id-2");
    });

    it("T1.5 complete while dismissed notifies", async () => {
        const { notification } = await import("@renderer/services/notification-manager");
        const store = useImportSessionStore();
        await store.begin("id-3");
        store.setModalVisible(false);
        const result: ImportResult = {
            success: true,
            totalFiles: 2,
            successfulFiles: 2,
            skippedFiles: 0,
            errorFiles: 0,
            totalSize: 0,
            processedSize: 0,
            errors: [],
            warnings: [],
            duration: 1,
            importedFiles: [],
            importId: "id-3",
            sourcePaths: [],
            targetPath: "",
        };
        store.complete(result);
        expect(store.phase).toBe("completed");
        expect(notification.success).toHaveBeenCalled();
    });

    it("T1.5 no toast when modal visible", async () => {
        const { notification } = await import("@renderer/services/notification-manager");
        const store = useImportSessionStore();
        await store.begin("id-4");
        store.setModalVisible(true);
        store.complete({
            success: true,
            totalFiles: 1,
            successfulFiles: 1,
            skippedFiles: 0,
            errorFiles: 0,
            totalSize: 0,
            processedSize: 0,
            errors: [],
            warnings: [],
            duration: 1,
            importedFiles: [],
            importId: "id-4",
            sourcePaths: [],
            targetPath: "",
        });
        expect(notification.success).not.toHaveBeenCalled();
    });

    it("T1.8 hydrateFromSession returns snapshot", async () => {
        const store = useImportSessionStore();
        await store.begin("id-5", { totalFiles: 4, processedFiles: 1 });
        store.applyProgress(sampleProgress({ totalFiles: 4, processedFiles: 2 }));
        const snap = store.hydrateFromSession();
        expect(snap?.processedFiles).toBe(2);
        expect(snap?.totalFiles).toBe(4);
    });

    it("T1.7 stopListeners does not clear importId / phase", async () => {
        const store = useImportSessionStore();
        await store.begin("id-6");
        store.stopListeners();
        expect(store.importId).toBe("id-6");
        expect(store.phase).toBe("running");
        store.applyProgress(sampleProgress({ processedFiles: 4 }));
        expect(store.progress?.processedFiles).toBe(4);
    });

    it("markCancelled keeps importId until clear", async () => {
        const store = useImportSessionStore();
        await store.begin("id-7");
        store.markCancelled();
        expect(store.phase).toBe("cancelled");
        expect(store.importId).toBe("id-7");
        expect(store.canStart).toBe(true);
        store.clear();
        expect(store.phase).toBe("idle");
        expect(store.importId).toBeNull();
    });

    it("setPaused toggles phase", async () => {
        const store = useImportSessionStore();
        await store.begin("id-8");
        store.setPaused(true);
        expect(store.phase).toBe("paused");
        store.setPaused(false);
        expect(store.phase).toBe("running");
    });

    it("requestOpenModal increments counter", () => {
        const store = useImportSessionStore();
        const before = store.openModalRequest;
        store.requestOpenModal();
        expect(store.openModalRequest).toBe(before + 1);
    });
});
