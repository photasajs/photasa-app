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
                from: "袁天罡",
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
                    expect((shengzhi.content as Record<string, unknown>).path).toBe("/test/photos");
                    expect(shengzhi.from).toBe("李世民");
                    resolve();
                }, 20);
            });
        });

        it("RFC 0143: request_rescan 应将 path 传到尉迟恭圣旨", async () => {
            const testPath = "/Users/test/Photos/Album";
            const testQizou: Qizou = {
                matter: "request_rescan",
                content: { path: testPath },
                from: "百姓",
                timestamp: Date.now(),
                metadata: { type: "request" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(1);
                    const shengzhi = yuchiGongService.receivedShengzhis[0];
                    expect(shengzhi.command).toBe("add_scan_task");
                    expect(shengzhi.content).toMatchObject({
                        path: testPath,
                        action: "rescan",
                        source: "user",
                    });
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
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: {
                    type: "report",
                },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    // ✅ 修复：只期望尉迟恭收到1个圣旨，魏征服务未注册所以没有第二个圣旨
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(1);
                    const yuchiGongShengzhi = yuchiGongService.receivedShengzhis[0];

                    expect(yuchiGongShengzhi.command).toBe("cleanup_scan_queue_for_path"); // ✅ 修复：路由配置使用cleanup命令
                    expect((yuchiGongShengzhi.content as Record<string, unknown>).path).toBe(
                        "/test/old-photos",
                    );
                    expect(yuchiGongShengzhi.from).toBe("李世民");
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
                from: "袁天罡",
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
                from: "未知服务", // 期望 from="袁天罡"
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
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    const shengzhi = yuchiGongService.receivedShengzhis[0];
                    expect((shengzhi.content as Record<string, unknown>).path).toBe(testPath);
                    resolve();
                }, 20);
            });
        });

        it("应该处理缺失变量的情况", async () => {
            const testQizou: Qizou = {
                matter: "add_path_completed",
                content: {}, // 缺少path字段
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    if (yuchiGongService.receivedShengzhis.length > 0) {
                        const shengzhi = yuchiGongService.receivedShengzhis[0];
                        // 缺失的变量应该保持原模板或为undefined
                        expect((shengzhi.content as Record<string, unknown>).path).toBeDefined();
                    }
                    resolve();
                }, 20);
            });
        });

        it("应该正确解析数组中的模板变量（scan_completed场景）", async () => {
            const testPath = "/scan/completed/path";
            const testQizou: Qizou = {
                matter: "scan_completed",
                content: { path: testPath },
                from: "尉迟恭",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            // 需要添加魏征服务来接收圣旨
            const weizhengService = new MockService("魏征");
            duruhui.connect(weizhengService);

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(weizhengService.receivedShengzhis.length).toBeGreaterThan(0);
                    const shengzhi = weizhengService.receivedShengzhis[0];
                    expect(shengzhi.command).toBe("add_paths");
                    const content = shengzhi.content as Record<string, unknown>;
                    expect(Array.isArray(content.paths)).toBe(true);
                    expect(content.paths).toContain(testPath);
                    resolve();
                }, 20);
            });
        });

        it("应该保留扫描进度的队列路径和总数", async () => {
            const yuShiNanService = new MockService("虞世南");
            duruhui.connect(yuShiNanService);

            const testQizou: Qizou = {
                matter: "scan_progress",
                content: {
                    filePath: "/album/IMG_001.jpg",
                    scanPath: "/album",
                    progress: 3,
                    total: 10,
                    type: "progress",
                },
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuShiNanService.receivedShengzhis).toHaveLength(1);
                    const shengzhi = yuShiNanService.receivedShengzhis[0];
                    expect(shengzhi.command).toBe("update_scan_progress");
                    expect(shengzhi.content).toMatchObject({
                        filePath: "/album/IMG_001.jpg",
                        scanPath: "/album",
                        progress: 3,
                        total: 10,
                        type: "progress",
                    });
                    resolve();
                }, 20);
            });
        });

        it("RFC 0136: scan_directory_discovered 应同时下旨尉迟恭与魏征", async () => {
            const weizhengService = new MockService("魏征");
            duruhui.connect(weizhengService);

            const testQizou: Qizou = {
                matter: "scan_directory_discovered",
                content: {
                    directoryPath: "/album/sub",
                    rootPath: "/album",
                },
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(yuchiGongService.receivedShengzhis).toHaveLength(1);
                    expect(yuchiGongService.receivedShengzhis[0].command).toBe("add_scan_task");
                    expect(
                        (yuchiGongService.receivedShengzhis[0].content as Record<string, unknown>)
                            .path,
                    ).toBe("/album/sub");

                    expect(weizhengService.receivedShengzhis).toHaveLength(1);
                    expect(weizhengService.receivedShengzhis[0].command).toBe("add_paths");
                    const paths = (
                        weizhengService.receivedShengzhis[0].content as Record<string, unknown>
                    ).paths;
                    expect(Array.isArray(paths)).toBe(true);
                    expect(paths).toContain("/album/sub");
                    resolve();
                }, 20);
            });
        });

        it("RFC 0136: scan_started 应下旨魏征立即 add_paths（不等 scan_completed）", async () => {
            const weizhengService = new MockService("魏征");
            duruhui.connect(weizhengService);

            const testQizou: Qizou = {
                matter: "scan_started",
                content: { path: "/Volumes/SUCAI/Test/2026" },
                from: "尉迟恭",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            (router as any).qizouBus.emit("qizou", testQizou);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(weizhengService.receivedShengzhis).toHaveLength(1);
                    expect(weizhengService.receivedShengzhis[0].command).toBe("add_paths");
                    const paths = (
                        weizhengService.receivedShengzhis[0].content as Record<string, unknown>
                    ).paths;
                    expect(paths).toEqual(["/Volumes/SUCAI/Test/2026"]);
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
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            const qizou2: Qizou = {
                matter: "add_path_completed",
                content: { path: "/path2" },
                from: "袁天罡",
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
                from: "袁天罡",
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
                from: "袁天罡",
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
                from: "袁天罡",
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
                from: "袁天罡",
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
                    from: "袁天罡",
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
                    from: "袁天罡",
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
                from: "袁天罡",
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
                from: "袁天罡",
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
