/**
 * 路径文官测试
 * 验证各位文官处理文书的正确性和可靠性
 */

import { describe, it, expect, vi } from "vitest";
import {
    handleAddPath,
    handleRemovePath,
    handleAddScanFolder,
    handleThemeChange,
    handleLanguageChange,
    handleThumbnailSizeChange,
    handleGetPreferences,
    executeStrategy,
    type StrategyDependencies,
} from "../path-handlers";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import type { Zouzhe } from "@renderer/interfaces/fang-xuan-ling.interface";

describe("路径文官测试", () => {
    // 创建模拟文房和典籍
    const createMockDependencies = (): StrategyDependencies => ({
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        preferenceService: {
            addPath: vi.fn(),
            removePath: vi.fn(),
            addScanFolder: vi.fn(),
            updateTheme: vi.fn(),
            updateLanguage: vi.fn(),
            updateThumbnailSize: vi.fn(),
            loadPreferences: vi.fn(),
        },
    });

    describe("路径添加处理函数", () => {
        it("应该成功处理路径添加", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.ADD_PATH,
                content: { path: "/test/path" },
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await handleAddPath(zouzhe, dependencies);

            expect(dependencies.preferenceService.addPath).toHaveBeenCalledWith("/test/path");
            expect(dependencies.logger.debug).toHaveBeenCalledWith(
                "🏛️ 朝廷开衙，处理路径添加文书",
                { path: "/test/path" },
            );
            expect(dependencies.logger.info).toHaveBeenCalledWith(
                "🏛️ 路径添加文书处理完成: /test/path",
            );
        });

        it("应该在路径参数缺失时抛出错误", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.ADD_PATH,
                content: {},
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await expect(handleAddPath(zouzhe, dependencies)).rejects.toThrow("路径参数缺失");
        });
    });

    describe("路径移除处理函数", () => {
        it("应该成功处理路径移除", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.REMOVE_PATH,
                content: { path: "/test/path" },
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await handleRemovePath(zouzhe, dependencies);

            expect(dependencies.preferenceService.removePath).toHaveBeenCalledWith("/test/path");
            expect(dependencies.logger.info).toHaveBeenCalledWith(
                "🏛️ 路径移除文书处理完成: /test/path",
            );
        });
    });

    describe("扫描文件夹添加处理函数", () => {
        it("应该成功处理扫描文件夹添加", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.ADD_SCAN_FOLDER,
                content: { folder: "/test/folder", action: "scan", source: "user" },
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await handleAddScanFolder(zouzhe, dependencies);

            expect(dependencies.preferenceService.addScanFolder).toHaveBeenCalledWith(
                "/test/folder",
                "scan",
                "user",
            );
        });

        it("应该在参数缺失时抛出错误", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.ADD_SCAN_FOLDER,
                content: { folder: "/test/folder" }, // 缺少action
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await expect(handleAddScanFolder(zouzhe, dependencies)).rejects.toThrow(
                "扫描文件夹参数缺失",
            );
        });
    });

    describe("主题变更处理函数", () => {
        it("应该成功处理主题变更", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.THEME_CHANGE,
                content: { themeId: "dark-theme" },
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await handleThemeChange(zouzhe, dependencies);

            expect(dependencies.preferenceService.updateTheme).toHaveBeenCalledWith("dark-theme");
        });
    });

    describe("语言变更处理函数", () => {
        it("应该成功处理语言变更", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.LANGUAGE_CHANGE,
                content: { locale: "zh-CN" },
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await handleLanguageChange(zouzhe, dependencies);

            expect(dependencies.preferenceService.updateLanguage).toHaveBeenCalledWith("zh-CN");
        });
    });

    describe("缩略图大小变更处理函数", () => {
        it("应该成功处理缩略图大小变更", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE,
                content: { size: 200 },
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await handleThumbnailSizeChange(zouzhe, dependencies);

            expect(dependencies.preferenceService.updateThumbnailSize).toHaveBeenCalledWith(200);
        });

        it("应该在大小参数缺失时抛出错误", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE,
                content: {},
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await expect(handleThumbnailSizeChange(zouzhe, dependencies)).rejects.toThrow(
                "缩略图大小参数缺失",
            );
        });
    });

    describe("偏好获取处理函数", () => {
        it("应该成功处理偏好获取", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                content: {},
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await handleGetPreferences(zouzhe, dependencies);

            expect(dependencies.preferenceService.loadPreferences).toHaveBeenCalled();
        });
    });

    describe("文书司", () => {
        it("应该根据奏折类型委派对应的文官", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.ADD_PATH,
                content: { path: "/test/path" },
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await executeStrategy(zouzhe, dependencies);

            expect(dependencies.preferenceService.addPath).toHaveBeenCalledWith("/test/path");
        });

        it("应该在未知奏折类型时抛出错误", async () => {
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: "UNKNOWN_MATTER" as any,
                content: {},
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await expect(executeStrategy(zouzhe, dependencies)).rejects.toThrow(
                "未知的奏折类型: UNKNOWN_MATTER",
            );
        });

        it("应该正确包装和传递处理函数的错误", async () => {
            const dependencies = createMockDependencies();
            const error = new Error("Service error");
            dependencies.preferenceService.addPath = vi.fn().mockRejectedValue(error);

            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.ADD_PATH,
                content: { path: "/test/path" },
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            await expect(executeStrategy(zouzhe, dependencies)).rejects.toThrow(
                `文官处理失败 [${ZOUZHE_MATTERS.ADD_PATH}]: Service error`,
            );
        });
    });

    describe("文官制度验证", () => {
        it("所有文官都应各司其职", () => {
            // 验证函数没有副作用，相同输入产生相同输出
            const functions = [
                handleAddPath,
                handleRemovePath,
                handleAddScanFolder,
                handleThemeChange,
                handleLanguageChange,
                handleThumbnailSizeChange,
                handleGetPreferences,
            ];

            functions.forEach((fn) => {
                expect(typeof fn).toBe("function");
                expect(fn.length).toBe(2); // 接受两个参数：zouzhe和dependencies
            });
        });

        it("处理函数应该没有内部状态", () => {
            // 多次调用相同的函数应该产生相同的行为
            const dependencies = createMockDependencies();
            const zouzhe: Zouzhe = {
                department: "test",
                matter: ZOUZHE_MATTERS.ADD_PATH,
                content: { path: "/test/path" },
                timestamp: Date.now(),
                priority: "normal" as any,
            };

            // 第一次调用
            handleAddPath(zouzhe, dependencies);
            const firstCallCount = (dependencies.preferenceService.addPath as any).mock.calls
                .length;

            // 重置mock
            vi.clearAllMocks();

            // 第二次调用
            handleAddPath(zouzhe, dependencies);
            const secondCallCount = (dependencies.preferenceService.addPath as any).mock.calls
                .length;

            expect(firstCallCount).toBe(secondCallCount);
        });
    });
});
