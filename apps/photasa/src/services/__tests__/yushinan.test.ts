import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { YuShiNanService } from "../yushinan/yushinan";
import { useScanningStore } from "../fangxuanling/stores/scanning-store";
import { createScanQueueItem } from "@renderer/stores/scanning-types";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";

vi.mock("@photasa/common", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@photasa/common")>();
    return {
        ...actual,
        globalLogInterceptor: {
            getHistory: vi.fn(() => []),
            clear: vi.fn(),
        },
        loggers: {
            ...actual.loggers,
            yushinan: {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            },
        },
    };
});

function createMockFangXuanLing(): IFangXuanLingService {
    const scanningStore = useScanningStore();

    return {
        photos: {
            currentPhoto: null,
            photos: [],
            processingFile: "",
            scanProgress: 0,
            setCurrentPhoto: vi.fn(),
            updateScanProgress: vi.fn(),
            clearScanProgress: vi.fn(),
            reset: vi.fn(),
        },
        statusBar: {
            currentTask: "",
            status: "",
            progress: undefined,
            error: undefined,
            timestamp: 0,
            update: vi.fn(),
            clear: vi.fn(),
            reset: vi.fn(),
        },
        preference: {
            currentTheme: "",
            currentLanguage: "",
            thumbnailSize: 150,
            paths: [],
            reset: vi.fn(),
        },
        notification: {
            notifications: [],
            show: vi.fn(),
            hide: vi.fn(),
            clear: vi.fn(),
            reset: vi.fn(),
        },
        scanning: {
            get queue() {
                return scanningStore.queue;
            },
            get queueSize() {
                return scanningStore.queueSize;
            },
            get isProcessing() {
                return scanningStore.isProcessing;
            },
            get currentPath() {
                return scanningStore.currentPath;
            },
            get nextScanAction() {
                return scanningStore.nextScanAction;
            },
            isInQueue: vi.fn(() => false),
            reset: vi.fn(),
        },
        appState: {
            folderTree: [],
            currentFolder: "",
            lastOpenedFolder: "",
            reset: vi.fn(),
        },
        menus: {
            menus: [],
            refreshMenus: vi.fn(),
            setMenuDisabled: vi.fn(),
            reset: vi.fn(),
        },
        resetAll: vi.fn(),
        processZouzhe: vi.fn(),
    };
}

describe("YuShiNanService", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it("应该把扫描进度同步到扫描队列项", async () => {
        const scanningStore = useScanningStore();
        scanningStore.addToQueue(
            createScanQueueItem({
                path: "/album",
                action: "scan",
                operationType: "directory",
            }),
        );

        const fangXuanLing = createMockFangXuanLing();
        const service = new YuShiNanService(fangXuanLing);
        const shengzhi: Shengzhi = {
            id: "scan-progress-1",
            command: "update_scan_progress",
            content: {
                filePath: "/album/IMG_001.jpg",
                scanPath: "/album",
                progress: 3,
                total: 10,
                type: "progress",
            },
            priority: "normal",
            from: "李世民",
            timestamp: Date.now(),
        };

        await service.processShengzhi(shengzhi);

        expect(fangXuanLing.photos.updateScanProgress).toHaveBeenCalledWith(
            "/album/IMG_001.jpg",
            3,
        );
        expect(scanningStore.queue[0].progress).toEqual({
            processed: 3,
            total: 10,
            cacheEnabled: true,
        });
    });
});
