import { describe, it, expect, vi, beforeEach } from "vitest";
import mitt from "mitt";
import { YuanTianGangService } from "../yuantiangang";
import { QizouMatters } from "../../../constants/qizou-shengzhi-commands";

const mockTauriInvoke = vi.hoisted(() => vi.fn());
const mockListen = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => mockTauriInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
    listen: (...args: unknown[]) => mockListen(...args),
}));

vi.mock("@renderer/api/env", () => ({
    isTauri: () => true,
}));

function getFindPhotoHandler(): ((event: { payload: unknown }) => void) | null {
    const listenCall = mockListen.mock.calls.find((call) => call[0] === "picasa:find-photo");
    return listenCall ? (listenCall[1] as (event: { payload: unknown }) => void) : null;
}

describe("YuanTianGangService - Scan Events & Status Bar Progress", () => {
    let yuanTianGang: YuanTianGangService;
    let qizouBus: ReturnType<typeof mitt>;
    let emittedEvents: Array<{ matter: string; content: Record<string, unknown> }>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockListen.mockResolvedValue(() => {});
        emittedEvents = [];
        qizouBus = mitt();
        qizouBus.on(
            "qizou" as never,
            (event: { matter: string; content: Record<string, unknown> }) => {
                emittedEvents.push(event);
            },
        );

        yuanTianGang = new YuanTianGangService();
        yuanTianGang.setQizouBus(qizouBus as never);
    });

    it("RFC 0136: 接收 ScanFileReport 并将完整文件路径与根路径解析给 qizou SCAN_PROGRESS", () => {
        const handler = getFindPhotoHandler();
        expect(handler).not.toBeNull();

        handler!({
            payload: {
                type: "file",
                requestId: "req-1",
                rootPath: "/Volumes/SUCAI/Test",
                file: {
                    path: "/Volumes/SUCAI/Test/sub/photo.jpg",
                    isDirectory: false,
                },
                progress: {
                    processed: 3,
                    total: 10,
                },
            },
        });

        expect(emittedEvents).toHaveLength(1);
        const qizou = emittedEvents[0];
        expect(qizou.matter).toBe(QizouMatters.SCAN_PROGRESS);
        expect(qizou.content.filePath).toBe("/Volumes/SUCAI/Test/sub/photo.jpg");
        expect(qizou.content.scanPath).toBe("/Volumes/SUCAI/Test");
        expect(qizou.content.progress).toBe(3);
        expect(qizou.content.total).toBe(10);
    });

    it("RFC 0136: 接收 ScanDirectoryReport 并发送 scan_directory_discovered 启奏", () => {
        const handler = getFindPhotoHandler();
        expect(handler).not.toBeNull();

        handler!({
            payload: {
                type: "directory",
                requestId: "req-2",
                rootPath: "/Volumes/SUCAI/Test",
                directory: {
                    path: "/Volumes/SUCAI/Test/SubFolder",
                    isDirectory: true,
                },
            },
        });

        expect(emittedEvents).toHaveLength(1);
        const qizou = emittedEvents[0];
        expect(qizou.matter).toBe(QizouMatters.SCAN_DIRECTORY_DISCOVERED);
        expect(qizou.content.directoryPath).toBe("/Volumes/SUCAI/Test/SubFolder");
        expect(qizou.content.rootPath).toBe("/Volumes/SUCAI/Test");
    });

    it("兼容旧版 ScanActionEvent 包含 action.path 与 currentFile", () => {
        const handler = getFindPhotoHandler();
        expect(handler).not.toBeNull();

        handler!({
            payload: {
                type: "progress",
                requestId: "req-legacy",
                action: {
                    path: "/Volumes/SUCAI/Test",
                    isDirectory: true,
                },
                currentFile: "vacation.jpg",
                progress: {
                    processed: 2,
                    total: 5,
                },
            },
        });

        expect(emittedEvents).toHaveLength(1);
        const qizou = emittedEvents[0];
        expect(qizou.matter).toBe(QizouMatters.SCAN_PROGRESS);
        expect(qizou.content.filePath).toBe("/Volumes/SUCAI/Test/vacation.jpg");
        expect(qizou.content.scanPath).toBe("/Volumes/SUCAI/Test");
        expect(qizou.content.progress).toBe(2);
        expect(qizou.content.total).toBe(5);
    });

    it("Complete 标志清空进度并发出完成事件", () => {
        const handler = getFindPhotoHandler();
        expect(handler).not.toBeNull();

        handler!({
            payload: {
                type: "complete",
                requestId: "req-3",
                rootPath: "/Volumes/SUCAI/Test",
            },
        });

        expect(emittedEvents.length).toBeGreaterThanOrEqual(1);
        const progressQizou = emittedEvents.find((e) => e.matter === QizouMatters.SCAN_PROGRESS);
        expect(progressQizou).toBeDefined();
        expect(progressQizou!.content.filePath).toBe("");
        expect(progressQizou!.content.type).toBe("complete");
    });
});
