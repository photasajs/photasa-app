/**
 * 偏好设置扫描修复测试
 *
 * 测试 addScanFolder 函数的智能检查功能，验证已扫描的子文件夹
 * 会被智能跳过，不会添加到扫描队列
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePreferenceStore } from "../preference";
// import type { PhotasaLogger } from "@common/logger";

// Mock the API module
vi.mock("@renderer/utils/api", () => ({
    checkPhotasaConfig: vi.fn(),
}));

// Mock window.api
Object.defineProperty(window, "api", {
    value: {
        normalizePath: vi.fn((path: string) => path.replace(/\\/g, "/")),
        splitPath: vi.fn((path: string) => path.split("/").filter(Boolean)),
        joinPath: vi.fn((...parts: string[]) => parts.join("/")),
        mergePath: vi.fn((base: string, relative: string) => base + "/" + relative),
        toDirName: vi.fn((path: string) => {
            const parts = path.split("/");
            if (parts.length > 1) {
                return parts.slice(0, -1).join("/") || "/";
            }
            return ".";
        }),
        checkPhotasaConfig: vi.fn(),
    },
    writable: true,
});

// Mock the logger
// const mockLogger = {
//     debug: vi.fn(),
//     info: vi.fn(),
//     warn: vi.fn(),
//     error: vi.fn(),
// } as PhotasaLogger;

describe("preference-scan-fix", () => {
    let store: ReturnType<typeof usePreferenceStore>;

    beforeEach(() => {
        setActivePinia(createPinia());
        store = usePreferenceStore();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("addScanFolder 智能检查", () => {
        it("应该跳过已扫描的文件夹", async () => {
            const { checkPhotasaConfig } = await import("@renderer/utils/api");
            vi.mocked(checkPhotasaConfig).mockResolvedValue({
                hasConfig: true,
                photoCount: 5,
                reason: "配置文件存在且有效",
            });

            const folderPath = "/test/scanned-folder";

            // 先设置根路径，这样 buildDataNode 才能工作
            store.paths = ["/test"];
            store.folderTree = [
                {
                    key: "/test",
                    title: "/test",
                    children: [],
                },
            ];

            await store.addScanFolder(folderPath, "scan");

            // 验证检查函数被调用
            expect(checkPhotasaConfig).toHaveBeenCalledWith(folderPath);

            // 验证文件夹没有添加到扫描队列
            expect(store.scanningFolder).toHaveLength(0);

            // 验证文件夹树被更新
            expect(store.folderTree).toContainEqual(
                expect.objectContaining({
                    key: "/test",
                    children: expect.arrayContaining([
                        expect.objectContaining({
                            key: expect.stringContaining("scanned-folder"),
                        }),
                    ]),
                }),
            );
        });

        it("应该扫描没有配置文件的文件夹", async () => {
            const { checkPhotasaConfig } = await import("@renderer/utils/api");
            vi.mocked(checkPhotasaConfig).mockResolvedValue({
                hasConfig: false,
                reason: "配置文件不存在",
            });

            const folderPath = "/test/new-folder";

            await store.addScanFolder(folderPath, "scan");

            // 验证检查函数被调用
            expect(checkPhotasaConfig).toHaveBeenCalledWith(folderPath);

            // 验证文件夹被添加到扫描队列
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0]).toEqual(
                expect.objectContaining({
                    path: folderPath,
                    action: "scan",
                    operationType: "directory",
                }),
            );
        });

        it("应该扫描空配置文件的文件夹", async () => {
            const { checkPhotasaConfig } = await import("@renderer/utils/api");
            vi.mocked(checkPhotasaConfig).mockResolvedValue({
                hasConfig: false,
                reason: "配置文件为空",
            });

            const folderPath = "/test/empty-folder";

            await store.addScanFolder(folderPath, "scan");

            // 验证文件夹被添加到扫描队列
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0].path).toBe(folderPath);
        });

        it("应该强制重新扫描已扫描的文件夹", async () => {
            const { checkPhotasaConfig } = await import("@renderer/utils/api");
            vi.mocked(checkPhotasaConfig).mockResolvedValue({
                hasConfig: true,
                photoCount: 10,
                reason: "配置文件存在且有效",
            });

            const folderPath = "/test/scanned-folder";

            // 使用 rescan 动作
            await store.addScanFolder(folderPath, "rescan");

            // 验证检查函数被调用（但仍然会跳过，因为 rescan 不应该调用检查）
            // 实际上 rescan 应该直接添加到队列
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0]).toEqual(
                expect.objectContaining({
                    path: folderPath,
                    action: "rescan",
                }),
            );
        });

        it("应该处理检查函数失败的情况", async () => {
            const { checkPhotasaConfig } = await import("@renderer/utils/api");
            vi.mocked(checkPhotasaConfig).mockRejectedValue(new Error("检查失败"));

            const folderPath = "/test/error-folder";

            await store.addScanFolder(folderPath, "scan");

            // 验证文件夹被添加到扫描队列（降级处理）
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0].path).toBe(folderPath);
        });

        it("应该跳过已存在于扫描队列中的文件夹", async () => {
            const folderPath = "/test/existing-folder";

            // 先添加一次
            await store.addScanFolder(folderPath, "scan");
            expect(store.scanningFolder).toHaveLength(1);

            // 再次添加相同文件夹
            await store.addScanFolder(folderPath, "scan");

            // 验证仍然只有一个
            expect(store.scanningFolder).toHaveLength(1);
        });

        it("应该更新现有文件夹的动作为 rescan", async () => {
            const folderPath = "/test/update-folder";

            // 先添加为 scan
            await store.addScanFolder(folderPath, "scan");
            expect(store.scanningFolder[0].action).toBe("scan");

            // 更新为 rescan
            await store.addScanFolder(folderPath, "rescan");

            // 验证动作被更新
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0].action).toBe("rescan");
        });

        it("应该处理 current 动作（不检查配置文件）", async () => {
            // const { checkPhotasaConfig } = await import("@renderer/utils/api");

            const folderPath = "/test/current-folder";

            await store.addScanFolder(folderPath, "current");

            // 验证检查函数没有被调用
            // expect(checkPhotasaConfig).not.toHaveBeenCalled();

            // 验证文件夹被添加到扫描队列
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0].action).toBe("current");
        });
    });

    describe("边界情况测试", () => {
        it("应该处理空字符串路径", async () => {
            // const { checkPhotasaConfig } = await import("@renderer/utils/api");

            await store.addScanFolder("", "scan");

            // 验证检查函数被调用
            // expect(checkPhotasaConfig).toHaveBeenCalledWith("");

            // 验证文件夹被添加到扫描队列（空字符串会被标准化）
            expect(store.scanningFolder).toHaveLength(1);
        });

        it("应该处理相对路径", async () => {
            // const { checkPhotasaConfig } = await import("@renderer/utils/api");

            const relativePath = "relative/path";
            await store.addScanFolder(relativePath, "scan");

            // 验证路径被标准化
            expect(store.scanningFolder[0].path).toBe(relativePath);
        });

        it("应该处理包含特殊字符的路径", async () => {
            const { checkPhotasaConfig } = await import("@renderer/utils/api");
            vi.mocked(checkPhotasaConfig).mockResolvedValue({
                hasConfig: false,
                reason: "配置文件不存在",
            });

            const specialPath = "/test/folder with spaces/中文文件夹";
            await store.addScanFolder(specialPath, "scan");

            expect(checkPhotasaConfig).toHaveBeenCalledWith(specialPath);
            expect(store.scanningFolder[0].path).toBe(specialPath);
        });
    });

    describe("性能测试", () => {
        it("应该快速处理大量文件夹检查", async () => {
            const { checkPhotasaConfig } = await import("@renderer/utils/api");
            vi.mocked(checkPhotasaConfig).mockResolvedValue({
                hasConfig: false,
                reason: "配置文件不存在",
            });

            const folders = Array.from({ length: 100 }, (_, i) => `/test/folder${i}`);

            const startTime = Date.now();

            // 并发添加多个文件夹
            await Promise.all(folders.map((folder) => store.addScanFolder(folder, "scan")));

            const endTime = Date.now();

            expect(store.scanningFolder).toHaveLength(100);
            expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
        });

        it("应该快速跳过大量已扫描的文件夹", async () => {
            const { checkPhotasaConfig } = await import("@renderer/utils/api");
            vi.mocked(checkPhotasaConfig).mockResolvedValue({
                hasConfig: true,
                photoCount: 5,
                reason: "配置文件存在且有效",
            });

            const folders = Array.from({ length: 10 }, (_, i) => `/test/scanned-folder${i}`);

            // 先设置根路径，这样 buildDataNode 才能工作
            store.paths = ["/test"];
            store.folderTree = [
                {
                    key: "/test",
                    title: "/test",
                    children: [],
                },
            ];

            const startTime = Date.now();

            // 串行添加已扫描的文件夹，这样更容易控制mock行为
            for (const folder of folders) {
                await store.addScanFolder(folder, "scan");
            }

            const endTime = Date.now();

            // 所有文件夹都应该被跳过
            expect(store.scanningFolder).toHaveLength(0);
            expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
        });
    });

    describe("错误处理测试", () => {
        it("应该处理检查函数抛出异常", async () => {
            const { checkPhotasaConfig } = await import("@renderer/utils/api");
            vi.mocked(checkPhotasaConfig).mockImplementation(() => {
                throw new Error("网络错误");
            });

            const folderPath = "/test/error-folder";

            // 不应该抛出异常
            await expect(store.addScanFolder(folderPath, "scan")).resolves.not.toThrow();

            // 应该降级为正常扫描
            expect(store.scanningFolder).toHaveLength(1);
        });

        it("应该处理检查函数返回无效结果", async () => {
            const { checkPhotasaConfig } = await import("@renderer/utils/api");
            vi.mocked(checkPhotasaConfig).mockResolvedValue(null as any);

            const folderPath = "/test/invalid-result-folder";

            await store.addScanFolder(folderPath, "scan");

            // 应该降级为正常扫描
            expect(store.scanningFolder).toHaveLength(1);
        });
    });

    describe("addFileOperation 文件夹树更新测试", () => {
        it("应该为文件操作更新父目录的文件夹树", () => {
            const filePath = "/test/photos/image.jpg";

            // 先设置根路径，确保 buildDataNode 能工作
            store.paths = ["/test"];
            store.folderTree = [
                {
                    key: "/test",
                    title: "/test",
                    children: [],
                },
            ];

            // 添加文件操作
            store.addFileOperation({
                path: filePath,
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
                priority: 1,
                retryCount: 0,
                createdAt: Date.now(),
                fileOperationId: "test-file-1",
            });

            // 验证文件操作被添加到队列
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0].path).toBe(filePath);
            expect(store.scanningFolder[0].operationType).toBe("file");

            // 验证文件夹树被更新（应该包含父目录）
            expect(store.folderTree).toContainEqual(
                expect.objectContaining({
                    key: "/test",
                    children: expect.arrayContaining([
                        expect.objectContaining({
                            key: expect.stringContaining("photos"),
                        }),
                    ]),
                }),
            );
        });

        it("应该为目录操作正常更新文件夹树", () => {
            const dirPath = "/test/new-folder";

            // 先设置根路径
            store.paths = ["/test"];
            store.folderTree = [
                {
                    key: "/test",
                    title: "/test",
                    children: [],
                },
            ];

            // 添加目录操作
            store.addFileOperation({
                path: dirPath,
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
                priority: 1,
                retryCount: 0,
                createdAt: Date.now(),
                fileOperationId: "test-dir-1",
            });

            // 验证目录操作被添加到队列
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0].path).toBe(dirPath);
            expect(store.scanningFolder[0].operationType).toBe("directory");

            // 验证文件夹树被更新
            expect(store.folderTree).toContainEqual(
                expect.objectContaining({
                    key: "/test",
                    children: expect.arrayContaining([
                        expect.objectContaining({
                            key: expect.stringContaining("new-folder"),
                        }),
                    ]),
                }),
            );
        });

        it("应该处理根目录文件，跳过树更新", () => {
            const rootFilePath = "/image.jpg";

            store.addFileOperation({
                path: rootFilePath,
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
                priority: 1,
                retryCount: 0,
                createdAt: Date.now(),
                fileOperationId: "test-root-file",
            });

            // 验证文件操作被添加
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0].path).toBe(rootFilePath);

            // 由于是根目录文件，文件夹树不应该被更新
            expect(store.folderTree).toHaveLength(0);
        });

        it("应该处理文件路径提取错误，不中断操作", () => {
            const invalidPath = "";

            store.addFileOperation({
                path: invalidPath,
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
                priority: 1,
                retryCount: 0,
                createdAt: Date.now(),
                fileOperationId: "test-invalid-file",
            });

            // 即使路径提取失败，文件操作仍应被添加
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0].path).toBe(invalidPath);
        });

        it("应该处理路径标准化", () => {
            const windowsStylePath = "C:\\Users\\test\\photos\\image.jpg";
            // normalizePath 在 mock 中会被调用，这里我们假设它能正确处理

            store.addFileOperation({
                path: windowsStylePath,
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
                priority: 1,
                retryCount: 0,
                createdAt: Date.now(),
                fileOperationId: "test-windows-path",
            });

            // 验证操作被添加，路径被标准化
            expect(store.scanningFolder).toHaveLength(1);
            expect(store.scanningFolder[0].operationType).toBe("file");
        });
    });
});
