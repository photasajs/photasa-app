/**
 * RFC 0093：`importPhotos` Tauri 分支 — invoke + 事件桥接与 `FileAction.created` 规范化
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invokeMock = vi.fn();
let listenHandler: ((event: { payload: Record<string, unknown> }) => void) | undefined;
const unlistenMock = vi.fn();

vi.mock("../env", () => ({
    isTauri: () => true,
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
    listen: vi.fn(
        async (_name: string, handler: (e: { payload: Record<string, unknown> }) => void) => {
            listenHandler = handler;
            return unlistenMock;
        },
    ),
}));

vi.mock("../adapter", () => ({
    api: {
        scan: { scanPhotos: vi.fn(), onScanResult: vi.fn() },
        thumbnail: { create: vi.fn(), remove: vi.fn() },
        window: {
            minimize: vi.fn(),
            maximize: vi.fn(),
            close: vi.fn(),
            isMaximized: vi.fn(),
        },
        import: {
            scanDirectories: vi.fn(),
            execute: vi.fn(),
            onProgress: vi.fn(),
            cancel: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            chooseDirectories: vi.fn(),
        },
        shell: {},
        tianshu: {},
        config: {},
    },
}));

/** 等待动态 import + async IIFE 跑完（仅若干 microtask 不够） */
async function waitForImportPhotosSetup(): Promise<void> {
    await vi.waitFor(
        () => {
            expect(invokeMock.mock.calls.length).toBeGreaterThan(0);
        },
        { timeout: 3000 },
    );
}

describe("createLegacyApi importPhotos (Tauri)", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        unlistenMock.mockReset();
        listenHandler = undefined;
        const g = globalThis as unknown as { __photasaImportUnsubs?: Array<() => void> };
        g.__photasaImportUnsubs = [];
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("invoke 失败时应回调 type error", async () => {
        const { createLegacyApi } = await import("../legacy-api");
        invokeMock.mockRejectedValueOnce(new Error("ipc down"));
        const cb = vi.fn();
        createLegacyApi().importPhotos(["/src"], "/tgt", cb);
        await vi.waitFor(() => expect(cb).toHaveBeenCalled(), { timeout: 3000 });
        expect(cb).toHaveBeenCalledWith({
            type: "error",
            error: "ipc down",
            action: {},
        });
    });

    it("next 事件应将 action.created 从 ISO 字符串转为 Date", async () => {
        const { createLegacyApi } = await import("../legacy-api");
        invokeMock.mockResolvedValueOnce("sid-1");
        const cb = vi.fn();
        createLegacyApi().importPhotos(["/folder"], "/target", cb);
        await waitForImportPhotosSetup();
        expect(invokeMock).toHaveBeenCalledWith("import_photos_legacy", {
            folders: ["/folder"],
            target: "/target",
        });
        expect(listenHandler).toBeTypeOf("function");

        listenHandler!({
            payload: {
                sessionId: "sid-1",
                type: "next",
                action: {
                    file: "/folder/a.jpg",
                    name: "a.jpg",
                    created: "2019-06-15T12:30:00.000Z",
                    isImage: true,
                    isVideo: false,
                    target: "/target",
                    targetDir: "/target/2019/20190615",
                    targetFileName: "a.jpg",
                    targetFullPath: "/target/2019/20190615/a.jpg",
                },
            },
        });

        expect(cb).toHaveBeenCalledTimes(1);
        const arg = cb.mock.calls[0][0] as { type: string; action: { created: Date } };
        expect(arg.type).toBe("next");
        expect(arg.action.created).toBeInstanceOf(Date);
        expect(arg.action.created.toISOString()).toBe("2019-06-15T12:30:00.000Z");
    });

    it("complete 时应调用 unlisten", async () => {
        const { createLegacyApi } = await import("../legacy-api");
        invokeMock.mockResolvedValueOnce("sid-2");
        const cb = vi.fn();
        createLegacyApi().importPhotos(["/f"], "/t", cb);
        await waitForImportPhotosSetup();

        listenHandler!({
            payload: { sessionId: "sid-2", type: "complete", error: null, action: {} },
        });

        expect(cb).toHaveBeenCalledWith({ type: "complete", error: null, action: {} });
        expect(unlistenMock).toHaveBeenCalledTimes(1);
    });

    it("removeImportListeners 应取消尚未 complete 的 importPhotos 监听", async () => {
        type LegacyImportApi = {
            importPhotos: (paths: string[], target: string, cb: (arg: unknown) => void) => void;
            removeImportListeners: () => void;
        };
        const { createLegacyApi } = await import("../legacy-api");
        invokeMock.mockResolvedValueOnce("sid-keep");
        const cb = vi.fn();
        const legacyApi = createLegacyApi() as unknown as LegacyImportApi;
        legacyApi.importPhotos(["/f"], "/t", cb);
        await waitForImportPhotosSetup();
        const g = globalThis as unknown as { __photasaImportUnsubs?: Array<() => void> };
        expect(g.__photasaImportUnsubs?.length).toBeGreaterThan(0);
        legacyApi.removeImportListeners();
        expect(unlistenMock).toHaveBeenCalled();
        expect(g.__photasaImportUnsubs?.length).toBe(0);
    });
});
