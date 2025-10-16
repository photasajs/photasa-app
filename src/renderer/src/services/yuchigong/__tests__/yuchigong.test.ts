/**
 * 尉迟恭（YuChiGong）单元测试
 * 测试扫描队列UI状态管理的核心功能
 *
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @date 2025-10-16
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mitt from "mitt";
import { YuChiGongService } from "../yuchigong";
import type { Shengzhi } from "@common/interfaces/shengzhi.interface";
import type { Qizou } from "@common/interfaces/qizou.interface";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    GUANYUAN_NAMES,
    type Zouzhe,
    type ZouzheResponse,
} from "@renderer/interfaces/fang-xuan-ling.interface";

/**
 * Mock房玄龄服务实现
 */
class MockFangXuanLingService implements IFangXuanLingService {
    public receivedZouzhes: Zouzhe[] = [];
    public shouldThrowError = false;

    // 实现IFangXuanLingService必需的属性和方法
    get preference(): never {
        throw new Error("Mock: preference not implemented");
    }

    get notification(): never {
        throw new Error("Mock: notification not implemented");
    }

    get photos(): never {
        throw new Error("Mock: photos not implemented");
    }

    getGlobalState(): {
        preference: Record<string, unknown>;
        notification: Record<string, unknown>[];
        photos: Record<string, unknown>[];
    } {
        return {
            preference: {},
            notification: [],
            photos: [],
        };
    }

    resetAll(): void {
        this.receivedZouzhes = [];
        this.shouldThrowError = false;
    }

    async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
        if (this.shouldThrowError) {
            throw new Error("房玄龄处理奏折失败");
        }
        this.receivedZouzhes.push(zouzhe);
        return {
            approved: true,
            matter: zouzhe.matter,
            data: null,
            instruction: "已批准",
            timestamp: Date.now(),
        };
    }

    reset(): void {
        this.receivedZouzhes = [];
        this.shouldThrowError = false;
    }
}

describe("🛡️ 尉迟恭（YuChiGong）扫描队列UI状态管理", () => {
    let yuchiGong: YuChiGongService;
    let mockFangXuanLing: MockFangXuanLingService;
    let qizouBus: ReturnType<typeof mitt<{ qizou: Qizou }>>;
    let emittedQizous: Qizou[];
    let messageChannel: MessageChannel;

    beforeEach(() => {
        // 创建mock服务
        mockFangXuanLing = new MockFangXuanLingService();

        // 使用真实的mitt，收集emit的qizou
        emittedQizous = [];
        qizouBus = mitt<{ qizou: Qizou }>();
        qizouBus.on("qizou", (qizou) => {
            emittedQizous.push(qizou);
        });

        // 创建尉迟恭实例
        yuchiGong = new YuChiGongService(mockFangXuanLing);

        // 创建MessageChannel
        messageChannel = new MessageChannel();

        // 设置圣旨接收通道
        yuchiGong.setShengzhiPort(messageChannel.port2);

        // 设置启奏事件总线
        yuchiGong.setQizouBus(qizouBus);
    });

    afterEach(() => {
        // 清理资源
        yuchiGong.cleanup();
        messageChannel.port1.close();
        messageChannel.port2.close();
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

                    // 清理队列
                    yuchiGong.cleanup();

                    expect(yuchiGong.getQueueSize()).toBe(0);
                    expect(yuchiGong.getScanningTasks()).toEqual([]);
                    resolve();
                }, 50);
            });
        });
    });

    describe("add_scan_task圣旨处理测试", () => {
        it("应该成功处理添加扫描任务圣旨", () => {
            const testPath = "/test/photos";
            const shengzhi: Shengzhi = {
                id: "shengzhi-001",
                command: "add_scan_task",
                content: { path: testPath },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            };

            messageChannel.port1.postMessage(shengzhi);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 验证队列状态
                    expect(yuchiGong.isScanning(testPath)).toBe(true);
                    expect(yuchiGong.getQueueSize()).toBe(1);
                    expect(yuchiGong.getScanningTasks()).toContain(testPath);

                    // 验证向房玄龄发送了奏折
                    expect(mockFangXuanLing.receivedZouzhes).toHaveLength(1);
                    const zouzhe = mockFangXuanLing.receivedZouzhes[0];
                    expect(zouzhe.department).toBe(GUANYUAN_NAMES.YU_CHI_GONG);
                    expect(zouzhe.matter).toBe(ZOUZHE_MATTERS.START_SCAN);
                    expect(zouzhe.content).toEqual({ path: testPath });
                    expect(zouzhe.priority).toBe(ZOUZHE_PRIORITIES.NORMAL);

                    // 验证向李世民启奏
                    expect(emittedQizous).toHaveLength(1);
                    const qizou = emittedQizous[0];
                    expect(qizou.matter).toBe("scan_task_started");
                    expect(qizou.from).toBe("尉迟恭");
                    expect(qizou.content).toMatchObject({
                        shengzhiId: shengzhi.id,
                        path: testPath,
                        queueSize: 1,
                    });

                    resolve();
                }, 50);
            });
        });

        it("应该能够添加多个不同路径的扫描任务", () => {
            const paths = ["/path1", "/path2", "/path3"];
            const shengzhis: Shengzhi[] = paths.map((path, index) => ({
                id: `shengzhi-${index}`,
                command: "add_scan_task",
                content: { path },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            }));

            shengzhis.forEach((shengzhi) => {
                messageChannel.port1.postMessage(shengzhi);
            });

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGong.getQueueSize()).toBe(3);
                    paths.forEach((path) => {
                        expect(yuchiGong.isScanning(path)).toBe(true);
                    });

                    // 验证发送了3个奏折
                    expect(mockFangXuanLing.receivedZouzhes).toHaveLength(3);

                    // 验证启奏了3次
                    expect(emittedQizous).toHaveLength(3);

                    resolve();
                }, 100);
            });
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
                    expect(emittedQizous[0].content.error).toContain("空字符串");
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
                    expect(emittedQizous[0].content.error).toContain("类型错误");
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

                        // 验证向房玄龄发送了停止扫描奏折
                        expect(mockFangXuanLing.receivedZouzhes).toHaveLength(1);
                        const zouzhe = mockFangXuanLing.receivedZouzhes[0];
                        expect(zouzhe.matter).toBe(ZOUZHE_MATTERS.STOP_SCAN);
                        expect(zouzhe.content).toEqual({ path: testPath });

                        // 验证向李世民启奏
                        expect(emittedQizous).toHaveLength(1);
                        const qizou = emittedQizous[0];
                        expect(qizou.matter).toBe("scan_task_removed");
                        expect(qizou.content).toMatchObject({
                            shengzhiId: removeShengzhi.id,
                            path: testPath,
                            queueSize: 0,
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
                    expect(emittedQizous[0].content.error).toContain("空字符串");
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
        it("应该能够更新扫描进度", () => {
            const testPath = "/test/progress-path";
            const progress = { current: 50, total: 100 };

            // 不应该抛出错误
            expect(() => yuchiGong.updateScanProgress(testPath, progress)).not.toThrow();
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

    describe("并发处理测试", () => {
        it("应该能够处理多个并发圣旨", () => {
            const paths = Array.from({ length: 10 }, (_, i) => `/path/${i}`);
            const shengzhis = paths.map((path, index) => ({
                id: `concurrent-${index}`,
                command: "add_scan_task",
                content: { path },
                priority: "normal",
                from: "李世民",
                timestamp: Date.now(),
            })) as Shengzhi[];

            // 快速发送所有圣旨
            shengzhis.forEach((shengzhi) => {
                messageChannel.port1.postMessage(shengzhi);
            });

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 所有任务都应该��添加
                    expect(yuchiGong.getQueueSize()).toBe(10);
                    paths.forEach((path) => {
                        expect(yuchiGong.isScanning(path)).toBe(true);
                    });

                    // 应该发送了10个奏折
                    expect(mockFangXuanLing.receivedZouzhes).toHaveLength(10);

                    // 应该启奏了10次
                    expect(emittedQizous).toHaveLength(10);

                    resolve();
                }, 200);
            });
        });
    });
});
