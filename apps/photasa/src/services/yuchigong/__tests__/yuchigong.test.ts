/**
 * 尉迟恭（YuChiGong）单元测试
 * 测试扫描队列UI状态管理的核心功能
 *
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @date 2025-10-16
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import mitt from "mitt";
import { YuChiGongService } from "../yuchigong";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type {
    IFangXuanLingService,
    IPreference,
    IScanning,
} from "@renderer/interfaces/fang-xuan-ling.interface";
import type { ScanAction } from "@photasa/common";
import { createScanQueueItem, type ScanQueueItem } from "@renderer/stores/scanning-types";
import { useScanningStore } from "@renderer/services/fangxuanling/stores/scanning-store";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    GUANYUAN_NAMES,
    type Zouzhe,
    type ZouzheResponse,
} from "@renderer/interfaces/fang-xuan-ling.interface";

/**
 * Helper: 创建测试用 ScanAction（IPC 契约）
 */
function createTestScanAction(overrides: Partial<ScanAction> = {}): ScanAction {
    return {
        path: "/test/path",
        action: "scan",
        thumbnailSize: 150,
        operationType: "directory",
        source: "user",
        ...overrides,
    };
}

/**
 * Mock扫描队列Store（模拟房玄龄的scanning Store，v3: 使用 ScanQueueItem）
 */
class MockScanningStore implements IScanning {
    isProcessing = false;
    currentPath: string | null = null;
    nextScanAction: ScanQueueItem | null = null;
    private _queue: ScanQueueItem[] = [];

    reset(): void {
        this._queue = [];
    }

    addAction(item: ScanQueueItem): void {
        this._queue.push(item);
    }

    removeAction(path: string): void {
        this._queue = this._queue.filter((item) => item.path !== path);
    }

    isInQueue(path: string): boolean {
        return this._queue.some((item) => item.path === path);
    }

    get queue(): ScanQueueItem[] {
        return [...this._queue];
    }

    get queueSize(): number {
        return this.queue.length;
    }

    clear(): void {
        this._queue = [];
    }
}

/**
 * Mock房玄龄服务实现
 */
class MockFangXuanLingService implements IFangXuanLingService {
    public receivedZouzhes: Zouzhe[] = [];
    public shouldThrowError = false;
    public shouldApprove = true;
    public mockInstruction = "已批准";
    public mockThumbnailSize = 150;
    public skipStoreMutation = false;
    public mockSubfolders: string[] = [];
    public shouldScanFail = false;
    public shouldScanPhotosResolve = true;
    private mockScanningStore: MockScanningStore;

    constructor() {
        this.mockScanningStore = new MockScanningStore();
    }

    // ✅ RFC 0042: 实现scanning Accessor
    get scanning(): IScanning {
        return this.mockScanningStore;
    }

    // 实现IFangXuanLingService必需 of properties and methods
    get preference(): IPreference {
        return {
            currentTheme: "dark",
            currentLanguage: "zh-CN",
            thumbnailSize: this.mockThumbnailSize,
            paths: [],
            reset: vi.fn(),
        };
    }

    get notification(): never {
        throw new Error("Mock: notification not implemented");
    }

    get photos(): never {
        throw new Error("Mock: photos not implemented");
    }

    get menus(): never {
        throw new Error("Mock: menus not implemented");
    }

    get statusBar(): never {
        throw new Error("Mock: statusBar not implemented");
    }

    get appState(): never {
        throw new Error("Mock: appState not implemented");
    }

    resetAll(): void {
        this.receivedZouzhes = [];
        this.shouldThrowError = false;
        this.shouldApprove = true;
        this.mockInstruction = "已批准";
        this.skipStoreMutation = false;
        this.mockSubfolders = [];
        this.shouldScanFail = false;
        this.shouldScanPhotosResolve = true;
        this.mockScanningStore.clear();
    }

    async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
        if (this.shouldThrowError) {
            throw new Error("房玄龄处理奏折失败");
        }
        this.receivedZouzhes.push(zouzhe);

        if (zouzhe.matter === ZOUZHE_MATTERS.SCAN_PHOTOS) {
            if (this.shouldScanFail) {
                throw new Error("扫描失败");
            }
            if (!this.shouldScanPhotosResolve) {
                return new Promise(() => {}); // never resolves
            }
        }

        if (zouzhe.matter === ZOUZHE_MATTERS.TO_DIR_NAME) {
            return {
                approved: this.shouldApprove,
                matter: zouzhe.matter,
                data: "/parent/dir",
                instruction: this.mockInstruction,
                timestamp: Date.now(),
            };
        }

        if (zouzhe.matter === ZOUZHE_MATTERS.SCAN_SUBFOLDERS) {
            const subfolders = this.mockSubfolders;
            this.mockSubfolders = [];
            return {
                approved: this.shouldApprove,
                matter: zouzhe.matter,
                data: subfolders,
                instruction: this.mockInstruction,
                timestamp: Date.now(),
            };
        }

        // ✅ RFC 0042: Mock processZouzhe should update store for ADD_SCAN_ACTION
        if (zouzhe.matter === ZOUZHE_MATTERS.ADD_SCAN_ACTION && !this.skipStoreMutation) {
            const content = zouzhe.content as Record<string, unknown>;
            // ✅ 修复：工作流期望 actions 数组
            const actionsArray = content.actions;
            if (Array.isArray(actionsArray) && actionsArray.length > 0) {
                const actionData = actionsArray[0] as Record<string, unknown>;
                if (actionData && typeof actionData === "object") {
                    const rawSource = actionData.source as string;
                    const source =
                        rawSource === "discovered"
                            ? "auto"
                            : (rawSource as "user" | "auto") || "user";
                    const scanAction = createTestScanAction({
                        path: actionData.path as string,
                        action: (actionData.action as "scan" | "rescan" | "current") || "scan",
                        thumbnailSize: (actionData.thumbnailSize as number) || 150,
                        source,
                        timestamp: (actionData.timestamp as number) || Date.now(),
                        operationType:
                            (actionData.operationType as "directory" | "file") || "directory",
                        priority: actionData.priority as number | undefined,
                        fileOperationId: actionData.fileOperationId as string | undefined,
                    });
                    this.mockScanningStore.addAction(createScanQueueItem(scanAction));
                }
            }
        }

        // ✅ RFC 0042: Mock processZouzhe should update store for REMOVE_SCAN_ACTION
        if (zouzhe.matter === ZOUZHE_MATTERS.REMOVE_SCAN_ACTION && !this.skipStoreMutation) {
            const path = (zouzhe.content as Record<string, unknown>).path as string;
            this.mockScanningStore.removeAction(path);
        }

        return {
            approved: this.shouldApprove,
            matter: zouzhe.matter,
            data: { persisted: true },
            instruction: this.mockInstruction,
            timestamp: Date.now(),
        };
    }

    reset(): void {
        this.receivedZouzhes = [];
        this.shouldThrowError = false;
        this.shouldApprove = true;
        this.mockInstruction = "已批准";
        this.skipStoreMutation = false;
        this.mockScanningStore.clear();
    }
}

describe("🛡️ 尉迟恭（YuChiGong）扫描队列UI状态管理", () => {
    let yuchiGong: YuChiGongService;
    let mockFangXuanLing: MockFangXuanLingService;
    let qizouBus: ReturnType<typeof mitt<{ qizou: Qizou }>>;
    let emittedQizous: Qizou[];
    let messageChannel: MessageChannel;

    beforeEach(async () => {
        setActivePinia(createPinia());

        // RFC 0143: handleAddScanTask / requestRescan 经 normalizePath → window.api
        global.window = {
            ...global.window,
            api: {
                ...(global.window?.api ?? {}),
                normalizePath: (path: string) => path.replace(/\\/g, "/"),
            },
        } as Window & typeof globalThis;

        // 先清理旧的状态（如果存在）
        if (messageChannel && messageChannel.port2) {
            messageChannel.port2.onmessage = null;
        }
        if (messageChannel) {
            messageChannel.port1.close();
            messageChannel.port2.close();
        }
        if (yuchiGong) {
            yuchiGong.cleanup();
        }
        if (mockFangXuanLing) {
            mockFangXuanLing.reset();
        }

        // 等待清理完成
        await new Promise((resolve) => setTimeout(resolve, 10));

        // 创建新的mock服务
        mockFangXuanLing = new MockFangXuanLingService();
        mockFangXuanLing.shouldScanPhotosResolve = false;

        // 使用真实的mitt，收集emit的qizou
        emittedQizous = [];
        qizouBus = mitt<{ qizou: Qizou }>();
        qizouBus.on("qizou", (qizou) => {
            emittedQizous.push(qizou);
        });

        // 创建尉迟恭实例
        yuchiGong = new YuChiGongService(mockFangXuanLing);

        // 创建新的MessageChannel
        messageChannel = new MessageChannel();

        // 确保port2没有旧的监听器
        messageChannel.port2.onmessage = null;

        // 设置圣旨接收通道
        yuchiGong.setShengzhiPort(messageChannel.port2);

        // 设置启奏事件总线
        yuchiGong.setQizouBus(qizouBus);
    });

    afterEach(async () => {
        // 先停止所有消息处理，避免异步操作继续
        if (messageChannel && messageChannel.port2) {
            messageChannel.port2.onmessage = null;
        }
        if (messageChannel && messageChannel.port1) {
            messageChannel.port1.close();
            messageChannel.port2.close();
        }

        // 清理资源
        if (yuchiGong) {
            yuchiGong.cleanup();
        }
        if (mockFangXuanLing) {
            mockFangXuanLing.reset(); // ✅ 重置mock状态，避免测试间污染
        }

        // 清空变量，确保下次测试从干净状态开始
        yuchiGong = null as unknown as YuChiGongService;
        messageChannel = null as unknown as MessageChannel;
        mockFangXuanLing = null as unknown as MockFangXuanLingService;
        emittedQizous = [];

        // 等待所有异步操作完成
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    describe("基本功能测试", () => {
        it("应该成功创建尉迟恭实例", () => {
            expect(yuchiGong).toBeDefined();
            expect(yuchiGong).toBeInstanceOf(YuChiGongService);
        });

        it("应该正确返回服务名称", () => {
            expect(yuchiGong.name).toBe("尉迟恭");
        });

        it("应该能够设置圣旨接收通道", () => {
            const newChannel = new MessageChannel();
            const newYuchiGong = new YuChiGongService(mockFangXuanLing);

            // 不应该抛出错误
            expect(() => newYuchiGong.setShengzhiPort(newChannel.port2)).not.toThrow();

            newChannel.port1.close();
            newChannel.port2.close();
        });

        it("应该能够设置启奏事件总线", () => {
            const newYuchiGong = new YuChiGongService(mockFangXuanLing);

            // 不应该抛出错误
            expect(() => newYuchiGong.setQizouBus(qizouBus)).not.toThrow();
        });
    });

    describe("队列状态管理测试", () => {
        it("应该初始化为空队列", () => {
            expect(yuchiGong.getScanningTasks()).toEqual([]);
            expect(yuchiGong.getQueueSize()).toBe(0);
        });

        it("应该正确检查路径是否在扫描队列中", () => {
            expect(yuchiGong.isScanning("/test/path")).toBe(false);
        });

        it("应该通过getter访问队列大小", () => {
            expect(yuchiGong.queueSize).toBe(0);
        });

        it("应该通过isInQueue方法检查路径", () => {
            expect(yuchiGong.isInQueue("/test/path")).toBe(false);
        });

        it("应该通过scanningQueue getter访问队列", () => {
            const queue = yuchiGong.scanningQueue;
            expect(Array.isArray(queue)).toBe(true);
            expect(queue).toEqual([]);
        });

        it("应该能够清理所有扫描任务", () => {
            // 先添加一些任务（通过圣旨）
            const shengzhi: Shengzhi = {
                id: "test-001",
                command: "add_scan_task",
                content: { path: "/test/path" },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGong.getQueueSize()).toBeGreaterThan(0);

                    // ✅ RFC 0042: cleanup()不清空队列，队列由房玄龄管理
                    yuchiGong.cleanup();

                    // 队列仍然存在，因为是房玄龄管理的
                    expect(yuchiGong.getQueueSize()).toBeGreaterThan(0);
                    expect(yuchiGong.getScanningTasks()).toContain("/test/path");
                    resolve();
                }, 50);
            });
        });
    });

    describe("add_scan_task圣旨处理测试", () => {
        it("应该成功处理添加扫描任务圣旨", async () => {
            const testPath = "/test/photos";
            const shengzhi: Shengzhi = {
                id: `shengzhi-${Date.now()}-${Math.random()}`,
                command: "add_scan_task",
                content: { path: testPath },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            // 重置状态
            mockFangXuanLing.reset();
            emittedQizous.length = 0;

            messageChannel.port1.postMessage(shengzhi);

            // 等待异步操作完成
            await new Promise((resolve) => setTimeout(resolve, 200));

            // 验证队列状态
            expect(yuchiGong.isScanning(testPath)).toBe(true);
            expect(yuchiGong.getQueueSize()).toBe(1);

            // 验证向房玄龄发送了奏折（只检查是否发送，不检查具体数量，避免测试间污染）
            expect(mockFangXuanLing.receivedZouzhes.length).toBeGreaterThanOrEqual(1);
            const zouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.ADD_SCAN_ACTION,
            );
            expect(zouzhe).toBeDefined();
            if (zouzhe) {
                expect(zouzhe.department).toBe(GUANYUAN_NAMES.YU_CHI_GONG);
                expect(zouzhe.matter).toBe(ZOUZHE_MATTERS.ADD_SCAN_ACTION);
                const content = zouzhe.content as Record<string, unknown>;
                const actions = content.actions as Array<Record<string, unknown>>;
                expect(actions).toBeDefined();
                expect(Array.isArray(actions)).toBe(true);
                if (actions && actions.length > 0) {
                    expect(actions[0]).toMatchObject({
                        path: testPath,
                        action: "scan",
                        source: "user",
                    });
                }
                expect(zouzhe.priority).toBe(ZOUZHE_PRIORITIES.NORMAL);
            }
        });

        it("应该能够添加多个不同路径的扫描任务", async () => {
            const paths = ["/path1", "/path2", "/path3"];

            // 重置状态
            mockFangXuanLing.reset();
            emittedQizous.length = 0;

            const shengzhis: Shengzhi[] = paths.map((path, index) => ({
                id: `shengzhi-${Date.now()}-${index}-${Math.random()}`,
                command: "add_scan_task",
                content: { path },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            }));

            shengzhis.forEach((shengzhi) => {
                messageChannel.port1.postMessage(shengzhi);
            });

            // 等待异步操作完成
            await new Promise((resolve) => setTimeout(resolve, 250));

            expect(yuchiGong.getQueueSize()).toBe(3);
            paths.forEach((path) => {
                expect(yuchiGong.isScanning(path)).toBe(true);
            });

            // 验证发送了奏折（只检查是否发送，不检查具体数量，避免测试间污染）
            const addActionZouzhes = mockFangXuanLing.receivedZouzhes.filter(
                (z) => z.matter === ZOUZHE_MATTERS.ADD_SCAN_ACTION,
            );
            expect(addActionZouzhes.length).toBeGreaterThanOrEqual(3);
        });

        it("RFC 0143: add_scan_task action=rescan 应入队并标记 rescan", async () => {
            const testPath = "/test/rescan-via-shengzhi";
            mockFangXuanLing.reset();
            emittedQizous.length = 0;

            messageChannel.port1.postMessage({
                id: `shengzhi-rescan-${Date.now()}`,
                command: "add_scan_task",
                content: { path: testPath, action: "rescan", source: "user" },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            } satisfies Shengzhi);

            await new Promise((resolve) => setTimeout(resolve, 200));

            expect(yuchiGong.isScanning(testPath)).toBe(true);
            const addZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.ADD_SCAN_ACTION,
            );
            expect(addZouzhe).toBeDefined();
            const actions = (addZouzhe?.content as { actions: ScanAction[] }).actions;
            expect(actions[0]).toMatchObject({
                path: testPath,
                action: "rescan",
                source: "user",
            });
        });

        it("RFC 0143: 已在队列时 rescan 圣旨应去重并启奏 scan_task_duplicate", async () => {
            const testPath = "/test/rescan-dedup";
            mockFangXuanLing.reset();
            emittedQizous.length = 0;

            // 先入队占用
            messageChannel.port1.postMessage({
                id: "shengzhi-first",
                command: "add_scan_task",
                content: { path: testPath, action: "scan", source: "user" },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            } satisfies Shengzhi);
            await new Promise((resolve) => setTimeout(resolve, 150));
            expect(yuchiGong.isScanning(testPath)).toBe(true);
            const zouzheCountAfterFirst = mockFangXuanLing.receivedZouzhes.length;
            emittedQizous.length = 0;

            // 再发 rescan —— 应跳过
            messageChannel.port1.postMessage({
                id: "shengzhi-dedup-rescan",
                command: "add_scan_task",
                content: { path: testPath, action: "rescan", source: "user" },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            } satisfies Shengzhi);
            await new Promise((resolve) => setTimeout(resolve, 150));

            expect(yuchiGong.getQueueSize()).toBe(1);
            expect(mockFangXuanLing.receivedZouzhes.length).toBe(zouzheCountAfterFirst);
            const dup = emittedQizous.find((q) => q.matter === "scan_task_duplicate");
            expect(dup).toBeDefined();
            expect(dup?.content).toMatchObject({ path: testPath });
        });

        it("应该拒绝缺少path参数的圣旨", () => {
            const shengzhi: Shengzhi = {
                id: "shengzhi-invalid-001",
                command: "add_scan_task",
                content: {}, // 缺少path参数
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 队列应该为空
                    expect(yuchiGong.getQueueSize()).toBe(0);

                    // 不应该向房玄龄发送奏折
                    expect(mockFangXuanLing.receivedZouzhes).toHaveLength(0);

                    // 应该启奏失败消息
                    expect(emittedQizous).toHaveLength(1);
                    const qizou = emittedQizous[0];
                    expect(qizou.matter).toBe("scan_task_failed");
                    expect(qizou.content).toMatchObject({
                        shengzhiId: shengzhi.id,
                        error: "缺少path参数或类型错误",
                    });

                    resolve();
                }, 50);
            });
        });

        it("应该拒绝path为null的圣旨", () => {
            const shengzhi: Shengzhi = {
                id: "shengzhi-invalid-002",
                command: "add_scan_task",
                content: { path: null },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGong.getQueueSize()).toBe(0);
                    expect(mockFangXuanLing.receivedZouzhes).toHaveLength(0);
                    expect(emittedQizous).toHaveLength(1);
                    expect(emittedQizous[0].matter).toBe("scan_task_failed");
                    resolve();
                }, 50);
            });
        });

        it("应该拒绝path为undefined的圣旨", () => {
            const shengzhi: Shengzhi = {
                id: "shengzhi-invalid-003",
                command: "add_scan_task",
                content: { path: undefined },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGong.getQueueSize()).toBe(0);
                    expect(emittedQizous[0].matter).toBe("scan_task_failed");
                    resolve();
                }, 50);
            });
        });

        it("应该拒绝path为空字符串的圣旨", () => {
            const shengzhi: Shengzhi = {
                id: "shengzhi-invalid-004",
                command: "add_scan_task",
                content: { path: "" },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGong.getQueueSize()).toBe(0);
                    expect(emittedQizous[0].matter).toBe("scan_task_failed");
                    resolve();
                }, 50);
            });
        });

        it("应该拒绝path为只包含空格的圣旨", () => {
            const shengzhi: Shengzhi = {
                id: "shengzhi-invalid-005",
                command: "add_scan_task",
                content: { path: "   " },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGong.getQueueSize()).toBe(0);
                    expect(emittedQizous[0].matter).toBe("scan_task_failed");
                    expect((emittedQizous[0].content as Record<string, unknown>).error).toContain(
                        "缺少path参数或类型错误",
                    );
                    resolve();
                }, 50);
            });
        });

        it("应该拒绝path为非字符串类型的圣旨", () => {
            const shengzhi: Shengzhi = {
                id: "shengzhi-invalid-007",
                command: "add_scan_task",
                content: { path: 123 as unknown as string },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGong.getQueueSize()).toBe(0);
                    expect(emittedQizous[0].matter).toBe("scan_task_failed");
                    expect((emittedQizous[0].content as Record<string, unknown>).error).toContain(
                        "类型错误",
                    );
                    resolve();
                }, 50);
            });
        });

        it("应该处理房玄龄处理奏折失败的情况", () => {
            const testPath = "/test/error-path";
            mockFangXuanLing.shouldThrowError = true;

            const shengzhi: Shengzhi = {
                id: "shengzhi-error-001",
                command: "add_scan_task",
                content: { path: testPath },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 任务应该从队列中移除
                    expect(yuchiGong.isScanning(testPath)).toBe(false);
                    expect(yuchiGong.getQueueSize()).toBe(0);

                    // 应该启奏失败消息
                    const failedQizou = emittedQizous.find((q) => q.matter === "scan_task_failed");
                    expect(failedQizou).toBeDefined();
                    expect(failedQizou?.content).toMatchObject({
                        shengzhiId: shengzhi.id,
                        path: testPath,
                    });

                    resolve();
                }, 50);
            });
        });
    });

    describe("remove_scan_task圣旨处理测试", () => {
        it("应该成功处理移除扫描任务圣旨", () => {
            const testPath = "/test/remove-path";

            // 先添加任务
            const addShengzhi: Shengzhi = {
                id: "add-001",
                command: "add_scan_task",
                content: { path: testPath },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(addShengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGong.isScanning(testPath)).toBe(true);

                    // 重置mock状态
                    mockFangXuanLing.reset();
                    emittedQizous.length = 0;

                    // 移除任务
                    const removeShengzhi: Shengzhi = {
                        id: "remove-001",
                        command: "remove_scan_task",
                        content: { path: testPath },
                        priority: "normal",
                        from: "李世民",
                        timestamp: Date.now(),
                    };

                    messageChannel.port1.postMessage(removeShengzhi);

                    setTimeout(() => {
                        // 验证队列状态
                        expect(yuchiGong.isScanning(testPath)).toBe(false);
                        expect(yuchiGong.getQueueSize()).toBe(0);

                        // 验证向房玄龄发送了移除扫描奏折
                        expect(mockFangXuanLing.receivedZouzhes).toHaveLength(1);
                        const zouzhe = mockFangXuanLing.receivedZouzhes[0];
                        expect(zouzhe.matter).toBe(ZOUZHE_MATTERS.REMOVE_SCAN_ACTION);
                        // ✅ RFC 0042: 移除奏折只包含path
                        expect(zouzhe.content).toEqual({ path: testPath });

                        // 验证向李世民启奏
                        expect(emittedQizous).toHaveLength(1);
                        const qizou = emittedQizous[0];
                        expect(qizou.matter).toBe("scan_task_removed");
                        // ✅ RFC 0042: 启奏内容包含persisted标志
                        expect(qizou.content).toMatchObject({
                            shengzhiId: removeShengzhi.id,
                            path: testPath,
                            persisted: true,
                        });

                        resolve();
                    }, 50);
                }, 50);
            });
        });

        it("应该处理移除不存在任务的情况", () => {
            const testPath = "/test/nonexistent-path";
            const shengzhi: Shengzhi = {
                id: "remove-002",
                command: "remove_scan_task",
                content: { path: testPath },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 应该仍然向房玄龄发送停止扫描奏折
                    expect(mockFangXuanLing.receivedZouzhes).toHaveLength(1);

                    // 应该仍然启奏移除成功
                    expect(emittedQizous).toHaveLength(1);
                    expect(emittedQizous[0].matter).toBe("scan_task_removed");

                    resolve();
                }, 50);
            });
        });

        it("应该拒绝缺少path参数的移除圣旨", () => {
            const shengzhi: Shengzhi = {
                id: "remove-invalid-001",
                command: "remove_scan_task",
                content: {},
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(mockFangXuanLing.receivedZouzhes).toHaveLength(0);
                    expect(emittedQizous[0].matter).toBe("scan_task_failed");
                    resolve();
                }, 50);
            });
        });

        it("应该拒绝空字符串路径的移除圣旨", () => {
            const shengzhi: Shengzhi = {
                id: "remove-invalid-003",
                command: "remove_scan_task",
                content: { path: "  " },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(mockFangXuanLing.receivedZouzhes).toHaveLength(0);
                    expect(emittedQizous[0].matter).toBe("scan_task_failed");
                    expect((emittedQizous[0].content as Record<string, unknown>).error).toContain(
                        "空字符串",
                    );
                    resolve();
                }, 50);
            });
        });

        it("应该处理房玄龄处理停止奏折失败的情况", () => {
            const testPath = "/test/stop-error-path";
            mockFangXuanLing.shouldThrowError = true;

            const shengzhi: Shengzhi = {
                id: "remove-error-001",
                command: "remove_scan_task",
                content: { path: testPath },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 应该启奏失败消息
                    const failedQizou = emittedQizous.find((q) => q.matter === "scan_task_failed");
                    expect(failedQizou).toBeDefined();
                    expect(failedQizou?.content).toMatchObject({
                        shengzhiId: shengzhi.id,
                        path: testPath,
                    });

                    resolve();
                }, 50);
            });
        });
    });

    describe("未知圣旨命令处理测试", () => {
        it("应该处理未知圣旨命令", () => {
            const shengzhi: Shengzhi = {
                id: "unknown-001",
                command: "unknown_command",
                content: {},
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 不应该向房玄龄发送奏折
                    expect(mockFangXuanLing.receivedZouzhes).toHaveLength(0);

                    // 应该启奏未知命令消息
                    expect(emittedQizous).toHaveLength(1);
                    const qizou = emittedQizous[0];
                    expect(qizou.matter).toBe("shengzhi_unknown");
                    expect(qizou.content).toMatchObject({
                        shengzhiId: shengzhi.id,
                        command: "unknown_command",
                        error: "未知圣旨命令",
                    });

                    resolve();
                }, 50);
            });
        });
    });

    describe("扫描进度更新测试", () => {
        it("✅ RFC 0042: updateScanProgress已移除 - 进度由千里眼自动管理", () => {
            // ✅ RFC 0042架构要求：
            // - UI层不应该更新进度，应由千里眼（Qianliyan）在底层自动管理
            // - 进度更新应该在扫描引擎层面自动同步到store，UI只负责读取显示
            // - YuChiGong的updateScanProgress方法已在Line 431-437被注释掉

            // 验证：updateScanProgress方法不存在
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((yuchiGong as any).updateScanProgress).toBeUndefined();

            // 正确的架构：UI层通过FangXuanLing.scanning读取进度
            // 示例：const progress = fangXuanLing.scanning.currentProgress;
        });
    });

    describe("启奏通道未建立时的处理", () => {
        it("应该处理启奏通道未建立的情况", () => {
            const newYuchiGong = new YuChiGongService(mockFangXuanLing);
            const newChannel = new MessageChannel();

            // 只设置圣旨通道，不设置启奏通道
            newYuchiGong.setShengzhiPort(newChannel.port2);

            const shengzhi: Shengzhi = {
                id: "no-qizou-001",
                command: "add_scan_task",
                content: { path: "/test/path" },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            // 应该不会崩溃
            newChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 任务应该正常添加到队列
                    expect(newYuchiGong.isScanning("/test/path")).toBe(true);

                    // 但不会发送启奏（因为通道未建立）
                    expect(emittedQizous).toHaveLength(0);

                    newChannel.port1.close();
                    newChannel.port2.close();
                    resolve();
                }, 50);
            });
        });

        // ✅ RFC 0048 v3 Phase 4: 已删除测试 "应该在启奏通道未建立时记录错误"
        // 原因：addScanTask()方法已删除，该测试不再适用
        // 错误处理逻辑已在executeScan()的其他测试中覆盖
    });

    describe("圣旨处理异常测试", () => {
        it("应该捕获并处理圣旨处理过程中的异常", () => {
            // 模拟一个会导致异常的场景
            const invalidShengzhi = {
                id: "exception-001",
                command: "add_scan_task",
                content: { path: "/valid/path" },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            } as Shengzhi;

            // 让房玄龄抛出异常
            mockFangXuanLing.shouldThrowError = true;

            messageChannel.port1.postMessage(invalidShengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 应该启奏失败消息
                    const failedQizou = emittedQizous.find((q) => q.matter === "scan_task_failed");
                    expect(failedQizou).toBeDefined();

                    resolve();
                }, 50);
            });
        });
    });

    describe("removeScanTask - 移除扫描任务", () => {
        it("应该正确发送REMOVE_SCAN_ACTION奏折", async () => {
            // 1. 先添加一个任务到队列（直接通过mock store）
            (mockFangXuanLing.scanning as MockScanningStore).addAction(
                createScanQueueItem(
                    createTestScanAction({
                        path: "/test/remove-path",
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        operationType: "directory",
                    }),
                ),
            );

            // 2. 移除任务
            await yuchiGong.removeScanTask("/test/remove-path");

            // 3. 验证奏折
            expect(mockFangXuanLing.receivedZouzhes).toHaveLength(1);
            const zouzhe = mockFangXuanLing.receivedZouzhes[0];
            expect(zouzhe.department).toBe(GUANYUAN_NAMES.YU_CHI_GONG);
            expect(zouzhe.matter).toBe(ZOUZHE_MATTERS.REMOVE_SCAN_ACTION);
            expect(zouzhe.content?.path).toBe("/test/remove-path");
            expect(zouzhe.priority).toBe(ZOUZHE_PRIORITIES.NORMAL);
        });

        it("路径不在队列中时应该静默返回", async () => {
            // 移除不存在的路径
            await yuchiGong.removeScanTask("/test/non-existent");

            // 不应该发送奏折
            expect(mockFangXuanLing.receivedZouzhes).toHaveLength(0);
        });

        it("参数验证：空字符串应该抛出错误", async () => {
            await expect(yuchiGong.removeScanTask("")).rejects.toThrow("路径参数无效");
        });

        it("参数验证：只包含空格的字符串应该抛出错误", async () => {
            await expect(yuchiGong.removeScanTask("   ")).rejects.toThrow("路径不能为空字符串");
        });

        it("参数验证：null应该抛出错误", async () => {
            // @ts-expect-error - 测试运行时验证
            await expect(yuchiGong.removeScanTask(null)).rejects.toThrow("路径参数无效");
        });

        it("房玄龄拒绝时应该抛出错误", async () => {
            (mockFangXuanLing.scanning as MockScanningStore).addAction(
                createScanQueueItem(
                    createTestScanAction({
                        path: "/test/rejected-path",
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        operationType: "directory",
                    }),
                ),
            );

            // Mock房玄龄拒绝
            mockFangXuanLing.shouldApprove = false;
            mockFangXuanLing.mockInstruction = "测试拒绝";

            await expect(yuchiGong.removeScanTask("/test/rejected-path")).rejects.toThrow(
                "房玄龄未批准：测试拒绝",
            );
        });
    });

    describe("executeScan - p-queue核心扫描逻辑测试", () => {
        let mockWindowApi: {
            resetPhotasaConfig: ReturnType<typeof vi.fn>;
            scanSubfolders: ReturnType<typeof vi.fn>;
            toDirName: ReturnType<typeof vi.fn>;
            scanPhotos: ReturnType<typeof vi.fn>;
            normalizePath: ReturnType<typeof vi.fn>;
        };

        beforeEach(() => {
            mockFangXuanLing.shouldScanPhotosResolve = true;
            // Mock window.api方法
            mockWindowApi = {
                resetPhotasaConfig: vi.fn().mockResolvedValue(undefined),
                scanSubfolders: vi.fn().mockResolvedValue([]),
                toDirName: vi.fn().mockReturnValue("/parent/dir"),
                scanPhotos: vi.fn().mockResolvedValue(undefined),
                normalizePath: vi.fn((path: string) => path.replace(/\\/g, "/")),
            };

            // 注入mock到global
            global.window = {
                ...global.window,
                api: mockWindowApi as unknown as typeof window.api,
            } as Window & typeof globalThis;
        });

        it("应该成功执行目录扫描（无子文件夹）", async () => {
            const testPath = "/test/scan-path";

            // ✅ RFC 0048 v3 Phase 4: 直接调用executeScan()代替已删除 of addScanTask()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (yuchiGong as any).executeScan(testPath, "scan", "directory");

            // 等待p-queue执行完成
            await new Promise((resolve) => setTimeout(resolve, 100));

            // 验证扫描流程
            const scanSubfoldersZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) =>
                    z.matter === ZOUZHE_MATTERS.SCAN_SUBFOLDERS &&
                    z.content?.folderPath === testPath,
            );
            expect(scanSubfoldersZouzhe).toBeDefined();

            const scanPhotosZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.SCAN_PHOTOS,
            );
            expect(scanPhotosZouzhe).toBeDefined();
            expect(scanPhotosZouzhe?.content).toEqual({
                path: testPath,
                action: "scan",
                thumbnailSize: 150,
                isDirectory: true,
            });

            // 验证启奏
            const startedQizou = emittedQizous.find((q) => q.matter === "scan_started");
            expect(startedQizou).toBeDefined();
            expect((startedQizou?.content as Record<string, unknown>).path).toBe(testPath);

            const completedQizou = emittedQizous.find((q) => q.matter === "scan_completed");
            expect(completedQizou).toBeDefined();
            expect((completedQizou?.content as Record<string, unknown>).path).toBe(testPath);
        });

        it("应该在重扫描时重置配置", async () => {
            const testPath = "/test/rescan-path";

            // ✅ RFC 0048 v3 Phase 4: 直接调用executeScan()代替已删除 of addScanTask()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (yuchiGong as any).executeScan(testPath, "rescan", "directory");
            await new Promise((resolve) => setTimeout(resolve, 100));

            // 验证重置配置被调用
            const resetConfigZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.RESET_FOLDER_CONFIG,
            );
            expect(resetConfigZouzhe).toBeDefined();
            expect(resetConfigZouzhe?.content?.folder).toBe(testPath);

            const scanPhotosZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.SCAN_PHOTOS,
            );
            expect(scanPhotosZouzhe).toBeDefined();
        });

        it("requestRescan 应入队 rescan 并在执行时重置配置", async () => {
            const testPath = "/test/rescan-ui-path";
            mockFangXuanLing.mockThumbnailSize = 256;

            await yuchiGong.requestRescan(testPath);
            await new Promise((resolve) => setTimeout(resolve, 150));

            const addActionZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.ADD_SCAN_ACTION,
            );
            expect(addActionZouzhe).toBeDefined();
            expect((addActionZouzhe?.content as { actions: ScanAction[] }).actions[0]).toEqual(
                expect.objectContaining({
                    path: testPath,
                    action: "rescan",
                    thumbnailSize: 256,
                    operationType: "directory",
                }),
            );

            const resetConfigZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.RESET_FOLDER_CONFIG,
            );
            expect(resetConfigZouzhe).toBeDefined();
            expect(resetConfigZouzhe?.content?.folder).toBe(testPath);

            const scanPhotosZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.SCAN_PHOTOS,
            );
            expect(scanPhotosZouzhe).toBeDefined();
            expect(scanPhotosZouzhe?.content).toEqual(
                expect.objectContaining({
                    path: testPath,
                    action: "rescan",
                    thumbnailSize: 256,
                }),
            );
        });

        it("requestRescan 应立即写入 UI 运行时队列", async () => {
            const testPath = "/test/rescan-visible";
            mockFangXuanLing.skipStoreMutation = true;

            await yuchiGong.requestRescan(testPath);

            expect(useScanningStore().queue).toEqual([
                expect.objectContaining({
                    path: testPath,
                    action: "rescan",
                    status: "pending",
                    operationType: "directory",
                }),
            ]);
        });

        it("watch 文件操作应该入尉迟恭队列并启动文件扫描", async () => {
            await yuchiGong.scheduleFileOperationsFromWatch(
                [
                    {
                        id: "watch-op-1",
                        type: "change",
                        path: "/test/watch/file.jpg",
                        timestamp: 1_700_000_000_000,
                        priority: 2,
                        retryCount: 1,
                        metadata: {
                            thumbnailSize: 256,
                            isFile: true,
                        },
                    },
                ],
                150,
            );
            await new Promise((resolve) => setTimeout(resolve, 150));

            const addActionZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.ADD_SCAN_ACTION,
            );
            expect(addActionZouzhe).toBeDefined();
            expect((addActionZouzhe?.content as { actions: ScanAction[] }).actions[0]).toEqual(
                expect.objectContaining({
                    path: "/test/watch/file.jpg",
                    action: "rescan",
                    thumbnailSize: 256,
                    operationType: "file",
                    source: "auto",
                    priority: 2,
                    retryCount: 1,
                    fileOperationId: "watch-op-1",
                }),
            );

            const scanSubfoldersZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.SCAN_SUBFOLDERS,
            );
            expect(scanSubfoldersZouzhe).toBeUndefined();

            const scanPhotosZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.SCAN_PHOTOS,
            );
            expect(scanPhotosZouzhe).toBeDefined();
            expect(scanPhotosZouzhe?.content).toEqual({
                path: "/test/watch/file.jpg",
                action: "rescan",
                thumbnailSize: 256,
                isDirectory: false,
            });
        });

        it("应该递归扫描子文件夹", async () => {
            const testPath = "/test/parent";
            const subfolders = ["/test/parent/sub1", "/test/parent/sub2"];
            mockFangXuanLing.mockSubfolders = subfolders;

            // ✅ RFC 0048 v3 Phase 4: 直接调用executeScan()代替已删除 of addScanTask()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (yuchiGong as any).executeScan(testPath, "scan", "directory");
            await new Promise((resolve) => setTimeout(resolve, 200));

            // 验证目录扫描 (通过奏折)
            const scanPhotosZouzhes = mockFangXuanLing.receivedZouzhes.filter(
                (z) => z.matter === ZOUZHE_MATTERS.SCAN_PHOTOS,
            );
            expect(scanPhotosZouzhes.some((z) => z.content?.path === testPath)).toBe(true);
            expect(scanPhotosZouzhes.some((z) => z.content?.path === subfolders[0])).toBe(true);
            expect(scanPhotosZouzhes.some((z) => z.content?.path === subfolders[1])).toBe(true);
        });

        it("应该过滤掉 .photasaoriginals 等 Photasa 内部子文件夹与隐藏点目录", async () => {
            const testPath = "/Volumes/SUCAI/Test";
            const subfolders = [
                "/Volumes/SUCAI/Test/SubAlbum",
                "/Volumes/SUCAI/Test/.photasaoriginals",
                "/Volumes/SUCAI/Test/.photasa_config",
            ];
            mockFangXuanLing.mockSubfolders = subfolders;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (yuchiGong as any).executeScan(testPath, "scan", "directory");
            await new Promise((resolve) => setTimeout(resolve, 200));

            const scanPhotosZouzhes = mockFangXuanLing.receivedZouzhes.filter(
                (z) => z.matter === ZOUZHE_MATTERS.SCAN_PHOTOS,
            );
            expect(
                scanPhotosZouzhes.some((z) => z.content?.path === "/Volumes/SUCAI/Test/SubAlbum"),
            ).toBe(true);
            expect(
                scanPhotosZouzhes.some(
                    (z) => z.content?.path === "/Volumes/SUCAI/Test/.photasaoriginals",
                ),
            ).toBe(false);
        });

        it("应该处理文件类型扫描", async () => {
            const testPath = "/test/file.jpg";

            // 使用私有方法测试（通过any绕过类型检查）
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (yuchiGong as any).executeScan(testPath, "scan", "file");

            // 验证文件扫描不调用scanSubfolders
            const scanSubfoldersZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.SCAN_SUBFOLDERS,
            );
            expect(scanSubfoldersZouzhe).toBeUndefined();

            // 验证获取父目录
            const toDirNameZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.TO_DIR_NAME,
            );
            expect(toDirNameZouzhe).toBeDefined();
            expect(toDirNameZouzhe?.content?.path).toBe(testPath);

            // 验证扫描参数
            const scanPhotosZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.SCAN_PHOTOS,
            );
            expect(scanPhotosZouzhe).toBeDefined();
            expect(scanPhotosZouzhe?.content).toEqual({
                path: testPath,
                action: "scan",
                thumbnailSize: 150,
                isDirectory: false,
            });

            // 验证启奏包含parentDir
            await new Promise((resolve) => setTimeout(resolve, 100));
            const completedQizou = emittedQizous.find((q) => q.matter === "scan_completed");
            expect((completedQizou?.content as Record<string, unknown>).parentDir).toBe(
                "/parent/dir",
            );
        });

        it("应该处理扫描失败情况", async () => {
            const testPath = "/test/fail-path";
            mockFangXuanLing.shouldScanFail = true;

            // ✅ RFC 0048 v3 Phase 4: 直接调用executeScan()代替已删除 of addScanTask()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (yuchiGong as any).executeScan(testPath, "scan", "directory");
            await new Promise((resolve) => setTimeout(resolve, 100));

            // 验证启奏失败消息
            const failedQizou = emittedQizous.find((q) => q.matter === "scan_failed");
            expect(failedQizou).toBeDefined();
            expect((failedQizou?.content as Record<string, unknown>).path).toBe(testPath);
            expect((failedQizou?.content as Record<string, unknown>).error).toContain("扫描失败");
        });

        // ✅ RFC 0048 v3 Phase 4: 已删除测试 "应该在扫描失败后继续处理下一个任务"
        // 原因：addScanTasks()方法已删除
        // p-queue的错误隔离能力已在单任务失败测试中验证
    });

    // ✅ RFC 0048 v3 Phase 4: 已删除测试块 "addScanTasks - 批量添加扫描任务测试"
    // 原因：addScanTasks()方法已删除，批量添加功能已迁移到圣旨系统

    // ✅ RFC 0048 v3 Phase 4: 已删除测试块 "persistToStore - 异步持久化测试"
    // 原因：persistToStore()私有方法已删除，持久化现在通过Qizou-Shengzhi-FangXuanLing流程

    // ✅ RFC 0048 v3 Phase 4: 已删除测试块 "p-queue行为验证"
    // 原因：addScanTasks()方法已删除，p-queue行为在executeScan测试中间接验证

    describe("initializeScanningQueue - 初始化扫描队列测试", () => {
        it("应该成功初始化扫描队列", async () => {
            await yuchiGong.initializeScanningQueue();

            // 验证向房玄龄发送了GET_SCANNING_QUEUE奏折
            const getQueueZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
            );
            expect(getQueueZouzhe).toBeDefined();
            expect(getQueueZouzhe?.department).toBe(GUANYUAN_NAMES.YU_CHI_GONG);
        });

        it("应该处理房玄龄拒绝的情况", async () => {
            mockFangXuanLing.shouldApprove = false;
            mockFangXuanLing.mockInstruction = "拒绝获取队列";

            await yuchiGong.initializeScanningQueue();

            // 应该仍然成功完成（只是记录警告）
            const getQueueZouzhe = mockFangXuanLing.receivedZouzhes.find(
                (z) => z.matter === ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
            );
            expect(getQueueZouzhe).toBeDefined();
        });

        it("应该处理获取队列失败的情况", async () => {
            mockFangXuanLing.shouldThrowError = true;

            // 应该不抛出错误（使用空队列继续）
            await expect(yuchiGong.initializeScanningQueue()).resolves.not.toThrow();
        });
    });
});
