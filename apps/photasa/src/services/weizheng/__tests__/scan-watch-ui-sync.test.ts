import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import { ShengzhiCommands } from "@renderer/constants/qizou-shengzhi-commands";
import { WeiZhengService } from "../weizheng";

describe("魏征 watch 扫描 UI 同步", () => {
    const processZouzhe = vi.fn();
    const replaceCurrentFolderConfig = vi.fn();
    let service: WeiZhengService;

    beforeEach(() => {
        processZouzhe.mockReset();
        replaceCurrentFolderConfig.mockReset();
        service = new WeiZhengService({
            processZouzhe,
            appState: {
                folderTree: [{ key: "/photos", title: "photos", children: [] }],
                currentFolder: "/photos/vacation",
            },
            preference: {
                paths: ["/photos"],
                replaceCurrentFolderConfig,
            },
        } as unknown as IFangXuanLingService);
    });

    it("文件 scan_completed 应刷新当前目录 photoList", async () => {
        const refreshedConfig = {
            version: "1",
            photoList: [{ path: "new.jpg", thumbnail: "t.jpg", isVideo: false, history: [] }],
            lastModified: 2,
        };
        processZouzhe.mockResolvedValue({
            approved: true,
            data: refreshedConfig,
            instruction: "ok",
        });

        await (
            service as unknown as { processShengzhi: (s: unknown) => Promise<void> }
        ).processShengzhi({
            id: "sz-1",
            command: ShengzhiCommands.SCAN_COMPLETED,
            content: {
                path: "/photos/vacation/new.jpg",
                parentDir: "/photos/vacation",
                operationType: "file",
            },
            priority: "normal",
        });

        expect(processZouzhe).toHaveBeenCalledWith(
            expect.objectContaining({
                matter: ZOUZHE_MATTERS.GET_FOLDER_CONFIG,
                content: { folder: "/photos/vacation" },
            }),
        );
        expect(replaceCurrentFolderConfig).toHaveBeenCalledWith(
            "/photos/vacation",
            refreshedConfig,
        );
    });

    it("目录 scan_completed 仍走 add_paths 更新 folderTree", async () => {
        processZouzhe.mockResolvedValue({
            approved: true,
            data: null,
            instruction: "ok",
        });

        await (
            service as unknown as { processShengzhi: (s: unknown) => Promise<void> }
        ).processShengzhi({
            id: "sz-2",
            command: ShengzhiCommands.SCAN_COMPLETED,
            content: {
                path: "/photos/vacation/2026",
                operationType: "directory",
            },
            priority: "normal",
        });

        expect(processZouzhe).toHaveBeenCalledWith(
            expect.objectContaining({
                matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
            }),
        );
        expect(replaceCurrentFolderConfig).not.toHaveBeenCalled();
    });
});
