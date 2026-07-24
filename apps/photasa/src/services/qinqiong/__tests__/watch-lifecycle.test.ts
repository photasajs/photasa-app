import { describe, expect, it, vi } from "vitest";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import {
    GUANYUAN_NAMES,
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
} from "@renderer/interfaces/fang-xuan-ling.interface";
import { QinQiongService } from "../qinqiong";

function createService(approved = true) {
    const replaceCurrentFolderConfig = vi.fn();
    const processZouzhe = vi.fn().mockResolvedValue({
        approved,
        matter: "",
        data: {
            folder: "/photos",
            config: { photoList: [] },
        },
        instruction: approved ? "ok" : "watch rejected",
        timestamp: Date.now(),
    });
    const fangXuanLing = {
        processZouzhe,
        preference: { replaceCurrentFolderConfig },
    } as unknown as IFangXuanLingService;
    return {
        service: new QinQiongService(fangXuanLing),
        processZouzhe,
        replaceCurrentFolderConfig,
    };
}

describe("QinQiongService watch lifecycle", () => {
    it("submits start watch config through FangXuanLing", async () => {
        const { service, processZouzhe } = createService();

        await service.startWatching(["/photos", "/archive"], 240);

        expect(processZouzhe).toHaveBeenCalledWith({
            department: GUANYUAN_NAMES.QIN_QIONG,
            matter: ZOUZHE_MATTERS.START_FILE_WATCH,
            content: {
                paths: ["/photos", "/archive"],
                recursive: true,
                thumbnailSize: 240,
            },
            timestamp: expect.any(Number),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        });
    });

    it("submits stop watch through FangXuanLing", async () => {
        const { service, processZouzhe } = createService();

        await service.stopWatching();

        expect(processZouzhe).toHaveBeenCalledWith({
            department: GUANYUAN_NAMES.QIN_QIONG,
            matter: ZOUZHE_MATTERS.STOP_FILE_WATCH,
            content: {},
            timestamp: expect.any(Number),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        });
    });

    it("surfaces rejected watch start", async () => {
        const { service } = createService(false);

        await expect(service.startWatching(["/photos"], 150)).rejects.toThrow("watch rejected");
    });

    it("routes removed file cleanup through FangXuanLing and updates current config", async () => {
        const { service, processZouzhe, replaceCurrentFolderConfig } = createService();

        await service.handleWatchPathRemoved("/photos/a.jpg", true);

        expect(processZouzhe).toHaveBeenCalledWith(
            expect.objectContaining({
                department: GUANYUAN_NAMES.QIN_QIONG,
                matter: ZOUZHE_MATTERS.REMOVE_WATCH_FILE,
                content: { path: "/photos/a.jpg" },
            }),
        );
        expect(replaceCurrentFolderConfig).toHaveBeenCalledWith("/photos", { photoList: [] });
    });

    it("reports removed directory through QinQiong folder route", async () => {
        const { service, processZouzhe } = createService();
        const emit = vi.fn();
        service.setQizouBus({ emit } as never);

        await service.handleWatchPathRemoved("/photos/old", false);

        expect(processZouzhe).not.toHaveBeenCalled();
        expect(emit).toHaveBeenCalledWith(
            "qizou",
            expect.objectContaining({
                matter: "folder_removed",
                content: { folderPath: "/photos/old" },
                from: "秦琼",
            }),
        );
    });

    it("serializes restart as stop then start", async () => {
        let releaseStop!: () => void;
        const stopPending = new Promise<void>((resolve) => {
            releaseStop = resolve;
        });
        const matters: string[] = [];
        const processZouzhe = vi.fn().mockImplementation(async (zouzhe) => {
            matters.push(zouzhe.matter);
            if (zouzhe.matter === ZOUZHE_MATTERS.STOP_FILE_WATCH) {
                await stopPending;
            }
            return {
                approved: true,
                matter: zouzhe.matter,
                data: null,
                instruction: "ok",
                timestamp: Date.now(),
            };
        });
        const service = new QinQiongService({
            processZouzhe,
        } as unknown as IFangXuanLingService);

        const restart = service.restartWatching(["/new"], 200);
        await Promise.resolve();
        expect(matters).toEqual([ZOUZHE_MATTERS.STOP_FILE_WATCH]);

        releaseStop();
        await restart;
        expect(matters).toEqual([ZOUZHE_MATTERS.STOP_FILE_WATCH, ZOUZHE_MATTERS.START_FILE_WATCH]);
    });
});
