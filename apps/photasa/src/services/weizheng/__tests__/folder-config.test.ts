import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import { WeiZhengService } from "../weizheng";

describe("魏征文件夹配置事务", () => {
    const processZouzhe = vi.fn();
    let service: WeiZhengService;

    beforeEach(() => {
        processZouzhe.mockReset();
        service = new WeiZhengService({
            processZouzhe,
        } as unknown as IFangXuanLingService);
    });

    it.each([true, false])("应原样返回 Rust 配置检查布尔值：%s", async (hasConfig) => {
        processZouzhe.mockResolvedValue({
            approved: true,
            data: hasConfig,
            instruction: "ok",
        });

        await expect(service.checkFolderConfig("/photos")).resolves.toBe(hasConfig);
        expect(processZouzhe).toHaveBeenCalledWith(
            expect.objectContaining({
                matter: ZOUZHE_MATTERS.CHECK_FOLDER_CONFIG,
                content: { folderPath: "/photos" },
            }),
        );
    });

    it("配置检查未获批准时应抛错", async () => {
        processZouzhe.mockResolvedValue({
            approved: false,
            data: null,
            instruction: "配置检查失败",
        });

        await expect(service.checkFolderConfig("/photos")).rejects.toThrow("配置检查失败");
    });

    it("应按目录顺序重置全部配置", async () => {
        processZouzhe.mockResolvedValue({
            approved: true,
            data: null,
            instruction: "ok",
        });

        await service.resetFolderConfigs(["/photos", "/archive"]);

        expect(processZouzhe.mock.calls.map(([zouzhe]) => zouzhe)).toEqual([
            expect.objectContaining({
                matter: ZOUZHE_MATTERS.RESET_FOLDER_CONFIG,
                content: { folder: "/photos" },
            }),
            expect.objectContaining({
                matter: ZOUZHE_MATTERS.RESET_FOLDER_CONFIG,
                content: { folder: "/archive" },
            }),
        ]);
    });
});
