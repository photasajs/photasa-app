/**
 * RFC 0099：`reloadWindow` Tauri 分支应 invoke `reload_window`
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invokeMock = vi.fn();

vi.mock("../env", () => ({
    isTauri: () => true,
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
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

describe("createLegacyApi reloadWindow (Tauri)", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('应调用 invoke("reload_window")', async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        const { createLegacyApi } = await import("../legacy-api");
        const api = createLegacyApi() as { reloadWindow: () => Promise<void> };
        await api.reloadWindow();
        expect(invokeMock).toHaveBeenCalledWith("reload_window");
    });
});
