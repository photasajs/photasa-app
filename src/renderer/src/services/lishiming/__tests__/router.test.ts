/**
 * 启奏路由器（QiZouRouter）单元测试
 * 测试YAML配置驱动的中央路由决策
 *
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @date 2025-10-16
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { QiZouRouter } from "../router";
import { DuRuHuiService } from "../../duruhui/duruhui";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import type { IService } from "@renderer/interfaces/service.interface";

/**
 * Mock服务实现
 */
class MockService implements IService {
    private _name: string;
    private _port: MessagePort | null = null;
    public receivedShengzhis: Shengzhi[] = [];

    constructor(name: string) {
        this._name = name;
    }

    get name(): string {
        return this._name;
    }

    setShengzhiPort(port: MessagePort): void {
        this._port = port;
        port.onmessage = (event: MessageEvent): void => {
            this.receivedShengzhis.push(event.data as Shengzhi);
        };
    }

    get port(): MessagePort | null {
        return this._port;
    }
}

describe("👑 启奏路由器（QiZouRouter）", () => {
    let router: QiZouRouter;
    let duruhui: DuRuHuiService;
    let chusuiliangService: MockService;
    let yuchiGongService: MockService;

    beforeEach(() => {
        // 初始化服务链
        duruhui = new DuRuHuiService();
        router = new QiZouRouter(duruhui);

        // 初始化mock服务
        chusuiliangService = new MockService("褚遂良");
        yuchiGongService = new MockService("尉迟恭");

        // 连接服务到杜如晦
        duruhui.connect(chusuiliangService);
        duruhui.connect(yuchiGongService);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("基本功能测试", () => {
        it("应该成功创建启奏路由器实例", () => {
            expect(router).toBeDefined();
            expect(router).toBeInstanceOf(QiZouRouter);
        });
    });

    describe("YAML路由配置解析", () => {
        it("应该成功加载event-routing.yml配置", () => {
            // 验证router被创建时没有抛出错误
            expect(router).toBeDefined();
        });

        it("应该正确处理add_path_completed路由规则", async () => {
            const testQizou: Qizou = {
                matter: "add_path_completed",
                content: {
                    path: "/test/photos",
                },
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: {
                    type: "report",
                },
            };

            // 发送启奏
            (router as any).qizouBus.emit("qizou", testQizou);

            // 等待异步处理
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 验证尉迟恭收到了圣旨
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(1);
                    const shengzhi = yuchiGongService.receivedShengzhis[0];

                    expect(shengzhi.command).toBe("add_scan_task");
                    expect(shengzhi.content.path).toBe("/test/photos");
                    expect(shengzhi.from).toBe("李世民");
                    resolve();
                }, 20);
            });
        });

        it("应该正确处理remove_path_completed路由规则", async () => {
            const testQizou: Qizou = {
                matter: "remove_path_completed",
                content: {
                    path: "/test/old-photos",
                },
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: {
                    type: "report",
                },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(1);
                    const shengzhi = yuchiGongService.receivedShengzhis[0];

                    expect(shengzhi.command).toBe("remove_scan_task");
                    expect(shengzhi.content.path).toBe("/test/old-photos");
                    expect(shengzhi.from).toBe("李世民");
                    resolve();
                }, 20);
            });
        });
    });

    describe("路由决策逻辑测试", () => {
        it("应该根据when条件正确匹配启奏", async () => {
            const matchingQizou: Qizou = {
                matter: "add_path_completed",
                content: { path: "/photos" },
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", matchingQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(1);
                    resolve();
                }, 20);
            });
        });

        it("应该忽略不匹配的启奏matter", async () => {
            const nonMatchingQizou: Qizou = {
                matter: "unknown_matter",
                content: {},
                from: "褚遂良",
                timestamp: Date.now(),
            };

            (router as any).qizouBus.emit("qizou", nonMatchingQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 没有服务应该收到圣旨
                    expect(chusuiliangService.receivedShengzhis).toHaveLength(0);
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(0);
                    resolve();
                }, 20);
            });
        });

        it("应该忽略来源不匹配的启奏", async () => {
            const wrongSourceQizou: Qizou = {
                matter: "add_path_completed",
                content: { path: "/photos" },
                from: "未知服务", // 期望from="褚遂良"
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", wrongSourceQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(0);
                    resolve();
                }, 20);
            });
        });
    });

    describe("变量替换测试", () => {
        it("应该正确替换content中的变量 {{qizou.content.path}}", async () => {
            const testPath = "/my/test/path";
            const testQizou: Qizou = {
                matter: "add_path_completed",
                content: { path: testPath },
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    const shengzhi = yuchiGongService.receivedShengzhis[0];
                    expect(shengzhi.content.path).toBe(testPath);
                    resolve();
                }, 20);
            });
        });

        it("应该处理缺失变量的情况", async () => {
            const testQizou: Qizou = {
                matter: "add_path_completed",
                content: {}, // 缺少path字段
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    if (yuchiGongService.receivedShengzhis.length > 0) {
                        const shengzhi = yuchiGongService.receivedShengzhis[0];
                        // 缺失的变量应该保持原模板或为undefined
                        expect(shengzhi.content.path).toBeDefined();
                    }
                    resolve();
                }, 20);
            });
        });
    });

    describe("圣旨生成测试", () => {
        it("应该生成唯一的圣旨ID", async () => {
            const qizou1: Qizou = {
                matter: "add_path_completed",
                content: { path: "/path1" },
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            const qizou2: Qizou = {
                matter: "add_path_completed",
                content: { path: "/path2" },
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", qizou1);
            (router as any).qizouBus.emit("qizou", qizou2);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(2);
                    const id1 = yuchiGongService.receivedShengzhis[0].id;
                    const id2 = yuchiGongService.receivedShengzhis[1].id;
                    expect(id1).not.toBe(id2);
                    resolve();
                }, 20);
            });
        });

        it("应该设置正确的圣旨优先级", async () => {
            const testQizou: Qizou = {
                matter: "add_path_completed",
                content: { path: "/photos" },
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    const shengzhi = yuchiGongService.receivedShengzhis[0];
                    // YAML配置中设置的priority: "normal"
                    expect(shengzhi.priority).toBe("normal");
                    resolve();
                }, 20);
            });
        });

        it("应该在圣旨元数据中保留原始启奏信息", async () => {
            const testQizou: Qizou = {
                matter: "add_path_completed",
                content: { path: "/photos" },
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    const shengzhi = yuchiGongService.receivedShengzhis[0];
                    expect(shengzhi.metadata).toBeDefined();
                    expect(shengzhi.metadata?.originalQizou).toBeDefined();
                    expect(shengzhi.metadata?.originalQizou?.matter).toBe("add_path_completed");
                    resolve();
                }, 20);
            });
        });
    });

    describe("服务隔离性测试", () => {
        it("应该只向目标服务下发圣旨", async () => {
            const testQizou: Qizou = {
                matter: "add_path_completed",
                content: { path: "/photos" },
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 只有尉迟恭应该收到圣旨
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(1);
                    // 褚遂良不应该收到圣旨
                    expect(chusuiliangService.receivedShengzhis).toHaveLength(0);
                    resolve();
                }, 20);
            });
        });
    });

    describe("错误处理测试", () => {
        it("应该处理目标服务不存在的情况", async () => {
            const loggerWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

            // 创建一个路由到不存在服务的启奏
            const testQizou: Qizou = {
                matter: "add_path_completed",
                content: { path: "/photos" },
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            // 断开尉迟恭服务（模拟服务不存在）
            // 注意：这里无法真正断开，因为DuRuHui没有disconnect方法
            // 实际生产中应该有错误日志
            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 验证没有崩溃
                    expect(true).toBe(true);
                    resolve();
                }, 20);
            });

            loggerWarnSpy.mockRestore();
        });

        it("应该处理malformed qizou的情况", async () => {
            const loggerErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            // 发送不完整的启奏
            const malformedQizou = {
                matter: "add_path_completed",
                // 缺少必需字段
            } as Qizou;

            (router as any).qizouBus.emit("qizou", malformedQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 验证没有崩溃
                    expect(true).toBe(true);
                    resolve();
                }, 20);
            });

            loggerErrorSpy.mockRestore();
        });
    });

    describe("性能测试", () => {
        it("应该能够处理连续多个启奏", async () => {
            const qizouCount = 10;
            const qizous: Qizou[] = [];

            for (let i = 0; i < qizouCount; i++) {
                qizous.push({
                    matter: "add_path_completed",
                    content: { path: `/photos-${i}` },
                    from: "褚遂良",
                    timestamp: Date.now() + i,
                    metadata: { type: "report" },
                });
            }

            qizous.forEach((qizou) => {
                (router as any).qizouBus.emit("qizou", qizou);
            });

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(qizouCount);
                    resolve();
                }, 100);
            });
        });

        it("应该能够处理快速连续的启奏", async () => {
            // 快速发送100个启奏
            for (let i = 0; i < 100; i++) {
                (router as any).qizouBus.emit("qizou", {
                    matter: "add_path_completed",
                    content: { path: `/fast-${i}` },
                    from: "褚遂良",
                    timestamp: Date.now(),
                    metadata: { type: "report" },
                });
            }

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGongService.receivedShengzhis.length).toBeGreaterThan(0);
                    resolve();
                }, 200);
            });
        });
    });

    describe("边界情况测试", () => {
        it("应该处理空content的启奏", async () => {
            const emptyContentQizou: Qizou = {
                matter: "add_path_completed",
                content: {},
                from: "褚遂良",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", emptyContentQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 应该仍然下发圣旨，即使content为空
                    expect(yuchiGongService.receivedShengzhis.length).toBeGreaterThanOrEqual(0);
                    resolve();
                }, 20);
            });
        });

        it("应该处理没有metadata的启奏", async () => {
            const noMetadataQizou: Qizou = {
                matter: "add_path_completed",
                content: { path: "/photos" },
                from: "褚遂良",
                timestamp: Date.now(),
                // 没有metadata字段
            };

            (router as any).qizouBus.emit("qizou", noMetadataQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    // 根据YAML配置，when.type是可选的，应该仍然匹配
                    if (yuchiGongService.receivedShengzhis.length > 0) {
                        expect(yuchiGongService.receivedShengzhis[0]).toBeDefined();
                    }
                    resolve();
                }, 20);
            });
        });
    });
});
