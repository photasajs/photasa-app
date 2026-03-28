/**
 * TaibaijinxingAdapter 测试
 * 测试菜单适配器的 shell 操作方法
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { TaibaijinxingAdapter } from "../TaibaijinxingAdapter";
import { shell } from "electron";

// Mock electron shell
jest.mock("electron", () => ({
    shell: {
        openExternal: jest.fn(),
        showItemInFolder: jest.fn(),
    },
    Menu: {
        buildFromTemplate: jest.fn(),
        setApplicationMenu: jest.fn(),
    },
}));

// Mock logger
jest.mock("@photasa/common", () => ({
    loggers: {
        window: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
        taiyi: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
    },
}));

describe("TaibaijinxingAdapter - Shell 操作", () => {
    let adapter: TaibaijinxingAdapter;

    beforeEach(async () => {
        adapter = new TaibaijinxingAdapter();
        await adapter.initialize();
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await adapter.shutdown();
    });

    describe("openExternal - 打开外部链接", () => {
        it("应该接受字符串参数并打开链接", async () => {
            const url = "https://example.com";
            (shell.openExternal as any).mockResolvedValue(undefined);

            const result = await adapter.openExternal(url);

            expect(shell.openExternal).toHaveBeenCalledWith(url);
            expect(result).toEqual({
                success: true,
                message: `外部链接已打开: ${url}`,
            });
        });

        it("应该接受对象参数并提取 url", async () => {
            const url = "https://example.com";
            const params = { url };
            (shell.openExternal as any).mockResolvedValue(undefined);

            const result = await adapter.openExternal(params);

            expect(shell.openExternal).toHaveBeenCalledWith(url);
            expect(result).toEqual({
                success: true,
                message: `外部链接已打开: ${url}`,
            });
        });

        it("应该在打开失败时抛出错误", async () => {
            const url = "https://example.com";
            const error = new Error("打开失败");
            (shell.openExternal as any).mockRejectedValue(error);

            await expect(adapter.openExternal(url)).rejects.toThrow("打开失败");
            expect(shell.openExternal).toHaveBeenCalledWith(url);
        });

        it("应该在对象参数打开失败时抛出错误", async () => {
            const url = "https://example.com";
            const params = { url };
            const error = new Error("打开失败");
            (shell.openExternal as any).mockRejectedValue(error);

            await expect(adapter.openExternal(params)).rejects.toThrow("打开失败");
            expect(shell.openExternal).toHaveBeenCalledWith(url);
        });
    });

    describe("openInFinder - 在 Finder 中显示文件", () => {
        it("应该接受字符串参数并显示文件", () => {
            const path = "/path/to/file";
            (shell.showItemInFolder as any).mockReturnValue(undefined);

            const result = adapter.openInFinder(path);

            expect(shell.showItemInFolder).toHaveBeenCalledWith(path);
            expect(result).toEqual({
                success: true,
                message: `文件已在 Finder 中显示: ${path}`,
            });
        });

        it("应该接受对象参数并提取 path", () => {
            const path = "/path/to/file";
            const params = { path };
            (shell.showItemInFolder as any).mockReturnValue(undefined);

            const result = adapter.openInFinder(params);

            expect(shell.showItemInFolder).toHaveBeenCalledWith(path);
            expect(result).toEqual({
                success: true,
                message: `文件已在 Finder 中显示: ${path}`,
            });
        });

        it("应该在显示失败时抛出错误", () => {
            const path = "/path/to/file";
            const error = new Error("显示失败");
            (shell.showItemInFolder as any).mockImplementation(() => {
                throw error;
            });

            expect(() => adapter.openInFinder(path)).toThrow("显示失败");
            expect(shell.showItemInFolder).toHaveBeenCalledWith(path);
        });

        it("应该在对象参数显示失败时抛出错误", () => {
            const path = "/path/to/file";
            const params = { path };
            const error = new Error("显示失败");
            (shell.showItemInFolder as any).mockImplementation(() => {
                throw error;
            });

            expect(() => adapter.openInFinder(params)).toThrow("显示失败");
            expect(shell.showItemInFolder).toHaveBeenCalledWith(path);
        });
    });
});
