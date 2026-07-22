# RFC 0023: Startup Performance Optimization

- **Start Date**: 2025-09-19
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)
- **Status**: Draft

## Summary

优化 桌面应用启动性能，通过延迟初始化、并行加载和服务分级策略，减少首屏显示时间 30-40%，显著改善用户体验。

## Motivation

当前应用启动存在以下问题：

1. **启动时间过长**：在低性能设备上，应用启动可能需要 5-8 秒，用户体验不佳
2. **阻塞式初始化**：多个服务同步初始化阻塞了主进程，延迟了窗口显示
3. **资源竞争**：启动时大量并发操作导致 CPU 和 I/O 资源竞争
4. **感知性能差**：即使实际启动时间可接受，但用户看不到进度反馈，感觉很慢

期望通过优化达到：

- 首屏显示时间减少 30-40%
- 启动画面提供准确的进度反馈
- 核心功能快速可用，其他功能渐进式激活
- 支持性能监控和分析

## Detailed Design

### 1. 启动流程重构

#### 1.1 延迟 Sentry 初始化

**当前问题**：

```typescript
// main/index.ts line 30-45
if (!isDev) {
 Sentry.init({...}); // 同步阻塞初始化
}
```

**优化方案**：

```typescript
// 在 app.whenReady() 后延迟初始化
app.whenReady().then(async () => {
    // ... 创建窗口等关键操作

    // 延迟初始化 Sentry
    setTimeout(() => {
        if (!isDev) {
            initSentry();
        }
    }, 1000);
});

function initSentry() {
    Sentry.init({
        dsn: "...",
        environment: process.env.NODE_ENV || "production",
        beforeSend(event) {
            // 过滤逻辑
        },
    });
    logger.info("Sentry initialized in background");
}
```

#### 1.2 IPC 处理器分级注册

**当前问题**：
所有 IPC 处理器在 `setupIpcHandlers()` 中同步注册，包含多个文件系统操作。

**优化方案**：

```typescript
// 分为关键和非关键处理器
function setupCriticalIpcHandlers(): void {
 // 仅注册启动必需的处理器
 ipcMain.handle("picasa:get-directory", async (_, args) => {
 return app.getPath(args.name);
 });
}

function setupDeferredIpcHandlers(): void {
 // 延迟注册文件系统相关处理器
 ipcMain.on("picasa:choose-directory", () => {...});
 ipcMain.handle("picasa:check-photasa-config", async () => {...});
 ipcMain.handle("picasa:sub-folders", async () => {...});
}

// 在 createWindow 中
setupCriticalIpcHandlers();
setTimeout(() => setupDeferredIpcHandlers(), 2000);
```

### 2. 服务启动优化

#### 2.1 调整服务优先级

修改 `startup-optimizer.ts` 中的服务分级：

```typescript
private defineServicePriorities(): ServicePriority {
 return {
 // 关键服务：仅保留最少必需
 critical: [
 () => this.createConfigService(),
 () => this.createWindowService(),
 ],

 // 重要服务：窗口显示后立即初始化
 important: [
 () => this.createLogViewerService(),
 () => this.createMenuService(),
 () => this.createShellService(),
 ],

 // 后台服务：延迟 3 秒初始化
 background: [
 () => this.createUpdateService(),
 () => this.createThumbnailService(),
 () => this.createScanService(),
 () => this.createWatchService(),
 () => this.createImportService(),
 ],
 };
}
```

#### 2.2 优化后台服务初始化时机

```typescript
private scheduleBackgroundServices(backgroundServices: Array<() => Promise<any> | any>): void {
 // 延迟更长时间，减少资源竞争
 setTimeout(async () => {
 logger.debug("Starting background services initialization...");

 // 使用优先级队列
 const priorityQueue = [
 { service: backgroundServices[0], delay: 0 }, // UpdateService - 立即
 { service: backgroundServices[1], delay: 500 }, // ThumbnailService - 0.5s 后
 { service: backgroundServices[2], delay: 1000 }, // ScanService - 1s 后
 { service: backgroundServices[3], delay: 1500 }, // WatchService - 1.5s 后
 { service: backgroundServices[4], delay: 2000 }, // ImportService - 2s 后
 ];

 for (const { service, delay } of priorityQueue) {
 await new Promise(resolve => setTimeout(resolve, delay));
 try {
 await service();
 } catch (error) {
 logger.error("Background service initialization failed:", error);
 }
 }

 logger.info("All background services initialized");
 }, 3000); // 延迟到 3 秒后开始
}
```

### 3. 服务管理架构

#### 3.1 服务注册系统

引入基于装饰器和配置的服务管理系统，替代当前硬编码的服务初始化：

```typescript
// services/service-registry.ts
export interface ServiceMetadata {
    name: string;
    priority: "critical" | "important" | "background";
    dependencies?: string[];
    lazyLoad?: boolean;
    startupDelay?: number;
    retryOnFailure?: boolean;
    maxRetries?: number;
}

export interface Service {
    initialize(): Promise<void>;
    shutdown?(): Promise<void>;
    healthCheck?(): Promise<boolean>;
}

export class ServiceRegistry {
    private services = new Map<string, ServiceMetadata>();
    private instances = new Map<string, Service>();
    private initPromises = new Map<string, Promise<Service>>();

    register(metadata: ServiceMetadata, factory: () => Service): void {
        this.services.set(metadata.name, metadata);
        // 存储工厂函数而不是立即创建实例
        this.factories.set(metadata.name, factory);
    }

    async initializeByPriority(): Promise<void> {
        const grouped = this.groupByPriority();

        // 初始化关键服务（阻塞）
        await this.initializeGroup(grouped.critical, { blocking: true });

        // 异步初始化重要服务
        this.initializeGroup(grouped.important, { blocking: false });

        // 延迟初始化后台服务
        setTimeout(() => {
            this.initializeGroup(grouped.background, {
                blocking: false,
                staggered: true,
            });
        }, 3000);
    }

    private async initializeGroup(
        services: ServiceMetadata[],
        options: { blocking?: boolean; staggered?: boolean },
    ): Promise<void> {
        if (options.staggered) {
            // 错开初始化时间，避免资源竞争
            for (const service of services) {
                await this.initializeService(service);
                await new Promise((resolve) => setTimeout(resolve, service.startupDelay || 500));
            }
        } else if (options.blocking) {
            await Promise.all(services.map((s) => this.initializeService(s)));
        } else {
            // 非阻塞异步初始化
            services.forEach((s) => this.initializeService(s));
        }
    }
}
```

#### 3.2 服务配置化

使用配置文件定义服务，而不是硬编码：

```typescript
// services/service-config.ts
export const serviceConfig: ServiceMetadata[] = [
    {
        name: "config",
        priority: "critical",
        lazyLoad: false,
    },
    {
        name: "window",
        priority: "critical",
        dependencies: ["config"],
    },
    {
        name: "logViewer",
        priority: "important",
    },
    {
        name: "menu",
        priority: "important",
        dependencies: ["window"],
    },
    {
        name: "update",
        priority: "background",
        startupDelay: 0,
        retryOnFailure: true,
        maxRetries: 3,
    },
    {
        name: "thumbnail",
        priority: "background",
        startupDelay: 500,
        dependencies: ["logViewer"],
    },
    {
        name: "scan",
        priority: "background",
        startupDelay: 1000,
        dependencies: ["logViewer", "config"],
    },
    {
        name: "watch",
        priority: "background",
        startupDelay: 1500,
        lazyLoad: true, // 按需加载
    },
    {
        name: "import",
        priority: "background",
        startupDelay: 2000,
        lazyLoad: true,
    },
];
```

#### 3.3 服务装饰器

使用装饰器简化服务定义：

```typescript
// decorators/service.decorator.ts
export function Service(metadata: ServiceMetadata) {
    return function (constructor: new (...args: any[]) => any) {
        ServiceRegistry.getInstance().register(metadata, () => {
            return new constructor(...resolveeDependencies(metadata));
        });
    };
}

// 使用示例
@Service({
    name: "thumbnail",
    priority: "background",
    startupDelay: 500,
    dependencies: ["logViewer"],
})
export class ThumbnailService implements Service {
    constructor(
        private ipcMain: IpcMain,
        private mainWindow: BrowserWindow,
        private app: App,
        private logViewerService: LogViewerService,
    ) {}

    async initialize(): Promise<void> {
        // 初始化逻辑
    }

    async shutdown(): Promise<void> {
        // 清理逻辑
    }

    async healthCheck(): Promise<boolean> {
        // 健康检查
        return true;
    }
}
```

#### 3.4 动态服务加载

支持运行时动态加载和卸载服务：

```typescript
export class DynamicServiceLoader {
    private registry: ServiceRegistry;

    async loadService(name: string): Promise<Service> {
        const metadata = this.registry.getMetadata(name);
        if (!metadata) {
            throw new Error(`Service ${name} not found`);
        }

        if (metadata.lazyLoad) {
            // 动态导入服务模块
            const module = await import(`./services/${name}-service`);
            const ServiceClass = module.default;
            return new ServiceClass(...this.resolveDependencies(metadata));
        }

        return this.registry.getInstance(name);
    }

    async unloadService(name: string): Promise<void> {
        const instance = this.registry.getInstance(name);
        if (instance?.shutdown) {
            await instance.shutdown();
        }
        this.registry.removeInstance(name);
    }

    async reloadService(name: string): Promise<void> {
        await this.unloadService(name);
        await this.loadService(name);
    }
}
```

#### 3.5 服务健康监控

实现服务健康检查和自动恢复：

```typescript
export class ServiceHealthMonitor {
    private checkInterval = 30000; // 30秒
    private unhealthyServices = new Set<string>();

    startMonitoring(): void {
        setInterval(() => this.checkAllServices(), this.checkInterval);
    }

    private async checkAllServices(): Promise<void> {
        const services = this.registry.getAllInstances();

        for (const [name, service] of services) {
            if (service.healthCheck) {
                try {
                    const isHealthy = await service.healthCheck();
                    if (!isHealthy) {
                        await this.handleUnhealthyService(name);
                    } else {
                        this.unhealthyServices.delete(name);
                    }
                } catch (error) {
                    logger.error(`Health check failed for ${name}:`, error);
                    await this.handleUnhealthyService(name);
                }
            }
        }
    }

    private async handleUnhealthyService(name: string): Promise<void> {
        this.unhealthyServices.add(name);
        const metadata = this.registry.getMetadata(name);

        if (metadata?.retryOnFailure) {
            logger.warn(`Service ${name} is unhealthy, attempting restart`);
            await this.restartService(name, metadata.maxRetries || 3);
        }
    }

    private async restartService(name: string, maxRetries: number): Promise<void> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                await this.loader.reloadService(name);
                logger.info(`Service ${name} restarted successfully`);
                return;
            } catch (error) {
                logger.error(`Failed to restart ${name}, attempt ${i + 1}:`, error);
                await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
            }
        }

        logger.error(`Failed to restart ${name} after ${maxRetries} attempts`);
        // 发送通知或触发降级策略
    }
}
```

#### 3.6 使用新架构的启动优化器

重构 `StartupOptimizer` 使用新的服务管理系统：

```typescript
export class StartupOptimizer {
    private serviceRegistry: ServiceRegistry;
    private serviceLoader: DynamicServiceLoader;
    private healthMonitor: ServiceHealthMonitor;

    constructor(
        private mainWindow: BrowserWindow,
        private app: App,
        private ipcMain: IpcMain,
    ) {
        this.serviceRegistry = new ServiceRegistry();
        this.serviceLoader = new DynamicServiceLoader(this.serviceRegistry);
        this.healthMonitor = new ServiceHealthMonitor(this.serviceRegistry);

        // 自动注册所有服务
        this.autoRegisterServices();
    }

    private autoRegisterServices(): void {
        // 从配置文件加载服务定义
        serviceConfig.forEach((config) => {
            const ServiceClass = this.loadServiceClass(config.name);
            this.serviceRegistry.register(
                config,
                () => new ServiceClass(this.ipcMain, this.mainWindow, this.app),
            );
        });
    }

    async initializeServices(): Promise<void> {
        const startTime = Date.now();
        logger.info("Starting service initialization with service manager");

        try {
            await this.serviceRegistry.initializeByPriority();

            // 启动健康监控
            this.healthMonitor.startMonitoring();

            const initTime = Date.now() - startTime;
            logger.info(`All services initialized in ${initTime}ms`);
        } catch (error) {
            logger.error("Service initialization failed:", error);
            throw error;
        }
    }

    async getService<T extends Service>(name: string): Promise<T> {
        return this.serviceLoader.loadService(name) as Promise<T>;
    }
}
```

### 4. 启动画面优化

#### 4.1 移除固定延迟

**当前问题**：

```typescript
// main/index.ts line 108
await new Promise((resolve) => setTimeout(resolve, 500));
```

**优化方案**：

```typescript
// 使用 ready-to-show 事件
mainWindow.once("ready-to-show", () => {
    logger.info("Main window ready to show");

    // 平滑过渡
    if (splashWindow) {
        splashWindow.fadeOut(() => {
            splashWindow = undefined;
            mainWindow.show();
            mainWindow.focus();
        });
    } else {
        mainWindow.show();
        mainWindow.focus();
    }
});
```

#### 4.2 添加淡出动画

在 `SplashWindow` 类中添加：

```typescript
public fadeOut(callback: () => void): void {
 if (!this.window) {
 callback();
 return;
 }

 let opacity = 1.0;
 const fadeInterval = setInterval(() => {
 opacity -= 0.1;
 if (opacity <= 0) {
 clearInterval(fadeInterval);
 this.hide();
 callback();
 } else {
 this.window?.setOpacity(opacity);
 }
 }, 30); // 300ms 淡出动画
}
```

### 5. 渲染器加载优化

#### 5.1 调整超时时间

```typescript
async function loadRenderer(): Promise<void> {
    if (!mainWindow) return;

    return new Promise((resolve, reject) => {
        // 调整为 15 秒，更合理的超时时间
        const timeout = setTimeout(() => {
            logger.error("Renderer load timeout after 15 seconds");
            reject(new Error("Renderer load timeout"));
        }, 15000);

        // ... 其他代码保持不变
    });
}
```

#### 5.2 实现预热机制

```typescript
// 在开发模式下预热渲染器
if (is.dev && process.env["DESKTOP_RENDERER_URL"]) {
    // 预先检查开发服务器是否就绪
    const checkDevServer = async () => {
        try {
            const response = await fetch(process.env["DESKTOP_RENDERER_URL"]);
            return response.ok;
        } catch {
            return false;
        }
    };

    // 等待开发服务器就绪
    let retries = 0;
    while (retries < 10) {
        if (await checkDevServer()) {
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        retries++;
    }
}
```

### 6. 性能监控

#### 6.1 添加启动性能测量

```typescript
interface StartupMetrics {
    appReady: number;
    windowCreated: number;
    servicesInitialized: number;
    rendererLoaded: number;
    totalTime: number;
}

class StartupPerformanceMonitor {
    private startTime = Date.now();
    private metrics: Partial<StartupMetrics> = {};

    mark(event: keyof StartupMetrics): void {
        this.metrics[event] = Date.now() - this.startTime;
    }

    report(): void {
        logger.info("Startup Performance Metrics:", {
            ...this.metrics,
            totalTime: Date.now() - this.startTime,
        });

        // 可选：发送到分析服务
        if (!isDev) {
            this.sendToAnalytics(this.metrics);
        }
    }

    private sendToAnalytics(metrics: Partial<StartupMetrics>): void {
        // 发送到 Sentry 或其他分析服务
        Sentry.captureMessage("Startup Performance", {
            level: "info",
            extra: metrics,
        });
    }
}
```

#### 6.2 集成性能监控

```typescript
const perfMonitor = new StartupPerformanceMonitor();

app.whenReady().then(async () => {
    perfMonitor.mark("appReady");

    // ... 创建窗口
    perfMonitor.mark("windowCreated");

    // ... 初始化服务
    perfMonitor.mark("servicesInitialized");

    // ... 加载渲染器
    perfMonitor.mark("rendererLoaded");

    perfMonitor.report();
});
```

### 7. 实施计划

分阶段实施以降低风险：

**第一阶段**（1-2 天）：

- 延迟 Sentry 初始化
- 调整服务优先级
- 添加性能监控

**第二阶段**（2-3 天）：

- 优化 IPC 处理器注册
- 实现启动画面淡出动画
- 优化渲染器加载超时

**第三阶段**（1-2 天）：

- 实现渲染器预热机制
- 优化后台服务初始化时机
- 性能测试和调优

## 服务管理架构的优势

引入服务管理架构后，相比硬编码方式带来以下优势：

1. **可维护性提升**

- 服务定义集中管理，易于查看和修改
- 通过配置文件调整服务优先级，无需修改代码
- 服务依赖关系清晰明确

2. **灵活性增强**

- 支持动态加载/卸载服务
- 可根据环境或用户配置调整服务启动策略
- 易于添加新服务或移除旧服务

3. **可靠性改进**

- 自动健康检查和服务恢复
- 服务失败隔离，不影响其他服务
- 支持服务重试和降级策略

4. **性能优化**

- 按需加载（lazy loading）减少内存占用
- 智能依赖解析，避免重复初始化
- 支持并行和串行初始化策略

5. **开发体验**

- 装饰器模式简化服务定义
- 统一的服务接口规范
- 更好的类型安全和 IDE 支持

## Drawbacks

1. **复杂性增加**：

- 启动流程变得更复杂，需要更仔细的错误处理
- 服务管理系统本身增加了代码复杂度

2. **调试困难**：

- 异步和延迟初始化可能使问题定位更困难
- 服务依赖关系可能导致级联故障

3. **功能延迟**：

- 某些功能在启动后不会立即可用
- 需要处理服务未就绪的边界情况

4. **测试挑战**：

- 需要更多的集成测试来确保启动流程正确
- 服务管理系统本身需要充分测试

5. **学习成本**：

- 开发者需要理解新的服务管理架构
- 需要文档和培训支持

## Alternatives

### 方案 A：使用 Worker 线程

将重型初始化任务移到 Worker 线程中执行：

**优点**：

- 不阻塞主线程
- 真正的并行处理

**缺点**：

- 需要大量重构
- Worker 线程不能直接访问 legacy preload API
- 增加了进程间通信的复杂性

### 方案 B：预编译和缓存

在构建时预处理和缓存初始化数据：

**优点**：

- 大幅减少运行时初始化
- 启动速度最快

**缺点**：

- 增加构建复杂性
- 缓存失效问题
- 首次启动仍然慢

### 方案 C：渐进式 Web 应用（PWA）模式

采用 PWA 的渐进式增强策略：

**优点**：

- 用户体验流畅
- 功能按需加载

**缺点**：

- 需要重新设计应用架构
- 可能不适合桌面应用场景

## Unresolved Questions

1. **最优延迟时间**：各服务的延迟时间需要通过实际测试确定
2. **错误恢复策略**：延迟初始化失败时的恢复机制
3. **用户反馈**：如何向用户传达某些功能正在加载中
4. **性能基准**：需要建立性能基准来衡量优化效果
5. **跨平台差异**：Windows 和 macOS 的优化策略可能需要差异化

## Success Criteria

1. **性能指标**：

- 首屏显示时间减少 30% 以上
- 冷启动时间 < 3 秒（普通硬件）
- 热启动时间 < 1.5 秒

2. **用户体验**：

- 启动画面平滑过渡
- 核心功能立即可用
- 无明显的功能延迟感

3. **稳定性**：

- 启动失败率 < 0.1%
- 无新增崩溃或挂起
- 所有现有功能正常工作

4. **可维护性**：

- 代码复杂度可控
- 有完整的性能监控
- 易于调试和故障排查

## Implementation Checklist

### 阶段 1：服务管理架构（2-3天）

- [ ] 创建服务管理基础架构
- [ ] 实现 ServiceRegistry 类
- [ ] 实现 ServiceMetadata 接口
- [ ] 创建服务配置文件
- [ ] 实现动态服务加载器
- [ ] DynamicServiceLoader 类
- [ ] 依赖解析机制
- [ ] 懒加载支持
- [ ] 添加服务健康监控
- [ ] ServiceHealthMonitor 类
- [ ] 健康检查接口
- [ ] 自动恢复机制

### 阶段 2：核心优化（1-2天）

- [ ] 创建性能监控基础设施
- [ ] 实施 Sentry 延迟初始化
- [ ] 重构 IPC 处理器注册
- [ ] 拆分关键和非关键处理器
- [ ] 实现延迟注册机制

### 阶段 3：服务迁移（2-3天）

- [ ] 迁移现有服务到新架构
- [ ] ConfigService
- [ ] WindowService
- [ ] LogViewerService
- [ ] MenuService
- [ ] UpdateService
- [ ] ThumbnailService
- [ ] ScanService
- [ ] WatchService
- [ ] ImportService
- [ ] 调整服务启动优先级
- [ ] 实现服务装饰器模式

### 阶段 4：UI 和加载优化（1-2天）

- [ ] 优化启动画面过渡
- [ ] 实现淡出动画
- [ ] 移除固定延迟
- [ ] 实现渲染器预热机制
- [ ] 调整渲染器超时时间

### 阶段 5：测试和调优（1-2天）

- [ ] 添加性能测试用例
- [ ] 更新相关文档
- [ ] 进行跨平台测试
- [ ] 收集性能数据并调优
- [ ] 编写服务管理文档

## References

- [contract reference Performance](https://www.desktop-shell.dev/docs/latest/tutorial/performance)
- [V8 Startup Snapshot](https://v8.dev/blog/custom-startup-snapshots)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
