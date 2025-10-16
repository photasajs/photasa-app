# RFC 0027: WASM内存管理优化与HEIF解码错误处理

- **RFC编号**: 0027
- **标题**: WASM内存管理优化与HEIF解码错误处理
- **作者**: 李鹏
- **开始日期**: 2025-09-23
- **状态**: ✅ **已完成**
- **完成日期**: 2025-09-23
- **类型**: 增强

## Summary

本RFC旨在优化Photasa应用中现有的WASM HEIF解码器的内存管理机制。虽然当前代码已实现了基础的内存访问错误处理和降级策略，但仍存在内存溢出崩溃的问题。通过增强现有错误处理机制、优化内存监控和实现更智能的资源管理，进一步提升应用在处理大型HEIF图像时的稳定性。

## Motivation

### 问题背景

当前应用使用 `@saschazar/wasm-heif` (v2.0.0) 进行HEIF解码，已实现了基础的内存访问错误处理机制，但仍出现内存溢出崩溃：

```
2025-09-23 10:25:43.815 WARN  thumbnail - [thumbnail-handler] WASM memory access error, trying alternative decode
2025-09-23 10:25:43.818 INFO  heif-module - Found WASM file at: C:\Users\alber\AppData\Local\Programs\photasa\resources\app.asar.unpacked\resources\wasm_heif.wasm
2025-09-23 10:25:43.848 INFO  heif-module - HEIF module initialized successfully from C:\Users\alber\AppData\Local\Programs\photasa\resources\app.asar.unpacked\resources\wasm_heif.wasm

FATAL ERROR: ExternalEntityTable::AllocateEntry Allocation failed - process out of memory
```

### 现有机制分析

当前代码已实现以下保护机制：

- **内存访问错误检测**: 检测 "memory access out of bounds" 错误
- **模块重新初始化**: 通过 `resetHeifModule()` 重置WASM模块
- **文件大小限制**: 10MB文件大小限制
- **降级处理**: 重试解码和fallback到占位符缩略图
- **资源清理**: `heifModule.free()` 调用

### 问题根因

尽管有上述保护机制，仍存在以下问题：

1. **内存监控不足**: 缺乏实时内存使用监控
2. **错误恢复不完整**: 某些内存溢出场景未被捕获
3. **资源管理优化空间**: 模块缓存和清理策略可进一步优化
4. **并发处理风险**: 多个HEIF文件同时处理时的内存竞争

### 预期目标

- 增强现有错误处理机制，捕获更多内存溢出场景
- 实现实时内存监控和预警机制
- 优化WASM模块的并发处理和资源管理
- 提升大型HEIF图像处理的稳定性和成功率

## Detailed Design

### 1. 增强现有错误处理机制

#### 1.1 扩展内存错误检测

基于现有的 `memory access out of bounds` 检测，增加更多错误类型：

```typescript
// 在 thumbnail-handler.ts 中扩展错误检测
const memoryErrorPatterns = [
    "memory access out of bounds",
    "Allocation failed",
    "process out of memory",
    "ExternalEntityTable::AllocateEntry",
    "WASM memory allocation failed",
];

const isMemoryError = (error: any) => {
    const message = error?.message || error?.toString() || "";
    return memoryErrorPatterns.some((pattern) => message.includes(pattern));
};
```

#### 1.2 增强模块重置策略

优化现有的 `resetHeifModule()` 机制：

```typescript
// 增强的模块重置，包含内存清理
async function enhancedResetHeifModule(): Promise<void> {
    if (heifState.module && typeof heifState.module.free === "function") {
        try {
            heifState.module.free();
        } catch (error) {
            logger.warn(`Failed to free WASM module: ${error}`);
        }
    }

    // 强制垃圾回收
    if (global.gc) {
        global.gc();
    }

    resetHeifModule();
}
```

### 2. 内存监控与预警

#### 2.1 实时内存监控

```typescript
interface MemoryMonitor {
    wasmMemoryUsage: number;
    heapUsed: number;
    heapTotal: number;
    externalMemory: number;
    lastGcTime: number;
}

function createMemoryMonitor(): MemoryMonitor {
    const memUsage = process.memoryUsage();
    return {
        wasmMemoryUsage: 0, // 需要从WASM模块获取
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        externalMemory: memUsage.external,
        lastGcTime: Date.now(),
    };
}
```

#### 2.2 内存使用预警

```typescript
const MEMORY_THRESHOLDS = {
    WARNING: 400 * 1024 * 1024, // 400MB
    CRITICAL: 500 * 1024 * 1024, // 500MB
    MAXIMUM: 600 * 1024 * 1024, // 600MB
};

function checkMemoryUsage(): "normal" | "warning" | "critical" {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapUsed + memUsage.external;

    if (totalMemory > MEMORY_THRESHOLDS.MAXIMUM) {
        return "critical";
    } else if (totalMemory > MEMORY_THRESHOLDS.CRITICAL) {
        return "critical";
    } else if (totalMemory > MEMORY_THRESHOLDS.WARNING) {
        return "warning";
    }
    return "normal";
}
```

### 2. 错误处理与恢复

#### 2.1 分层错误处理

```typescript
enum HEIFDecodeError {
    MEMORY_ACCESS_ERROR = "MEMORY_ACCESS_ERROR",
    MEMORY_ALLOCATION_FAILED = "MEMORY_ALLOCATION_FAILED",
    DECODE_TIMEOUT = "DECODE_TIMEOUT",
    INVALID_FORMAT = "INVALID_FORMAT",
}

interface ErrorRecoveryStrategy {
    retryCount: number;
    fallbackMethod: "alternative_decode" | "skip" | "reduce_quality";
    timeoutMs: number;
}
```

#### 2.2 降级处理机制

1. **主要解码器失败**：尝试备用解码方法
2. **内存不足**：降低图像质量或分辨率
3. **超时处理**：设置解码超时限制
4. **完全失败**：显示错误信息，跳过问题图像

#### 2.3 错误恢复流程

```typescript
async function handleHEIFDecodeError(error: HEIFDecodeError, context: DecodeContext) {
    switch (error) {
        case HEIFDecodeError.MEMORY_ACCESS_ERROR:
            return await tryAlternativeDecode(context);
        case HEIFDecodeError.MEMORY_ALLOCATION_FAILED:
            return await reduceMemoryUsage(context);
        case HEIFDecodeError.DECODE_TIMEOUT:
            return await skipProblematicImage(context);
        default:
            return await logAndSkip(context);
    }
}
```

### 3. 资源管理优化

#### 3.1 连接池管理

- 限制同时处理的HEIF图像数量
- 实现队列机制，避免资源竞争
- 优化WASM模块的初始化和销毁

#### 3.2 缓存策略

- 实现智能缓存机制
- 根据内存使用情况动态调整缓存大小
- 实现LRU缓存淘汰策略

#### 3.3 异步处理优化

- 使用Web Workers处理大型图像
- 实现流式处理，减少内存峰值
- 优化异步操作的错误传播

### 4. 监控与诊断

#### 4.1 性能监控

```typescript
interface MemoryMetrics {
    wasmMemoryUsage: number;
    heapSize: number;
    gcCount: number;
    decodeTime: number;
    errorRate: number;
}
```

#### 4.2 诊断工具

- 内存使用分析工具
- 错误日志增强
- 性能指标收集

## Drawbacks

### 1. 性能影响

- 内存限制可能影响处理速度
- 错误处理机制增加代码复杂度
- 监控开销可能影响整体性能

### 2. 开发复杂度

- 需要深入理解WASM内存管理
- 错误处理逻辑复杂
- 测试和调试难度增加

### 3. 兼容性风险

- 可能影响现有HEIF处理功能
- 需要确保向后兼容性
- 不同平台的WASM行为差异

## Alternatives

### 方案1：完全替换WASM解码器

- **优点**：彻底解决WASM内存问题
- **缺点**：需要重新实现HEIF解码，开发成本高
- **影响**：可能影响解码质量和性能

### 方案2：仅增加错误处理

- **优点**：改动最小，风险低
- **缺点**：不解决根本问题，治标不治本
- **影响**：问题可能继续出现

### 方案3：混合方案（推荐）

- **优点**：平衡了效果和成本
- **缺点**：需要多方面的改进
- **影响**：全面解决内存管理问题

## Unresolved Questions

1. **内存限制阈值**：如何确定合适的内存限制值？
2. **降级策略**：在什么情况下应该降级处理？
3. **性能权衡**：内存限制与处理速度的最佳平衡点？
4. **跨平台兼容**：不同操作系统的WASM行为差异如何处理？
5. **用户配置**：是否允许用户自定义内存限制？

## Future Possibilities

### 短期改进

- 实现基础的内存管理和错误处理
- 添加性能监控和诊断工具
- 优化现有HEIF处理流程

### 长期规划

- 考虑使用更现代的图像处理库
- 实现智能图像预处理
- 开发更高效的缓存机制
- 支持更多图像格式的统一处理

## Implementation Plan

### Phase 1: 增强错误检测 (1-2周)

#### 1.1 扩展内存错误检测模式

**文件修改**: `src/main/thumbnail/thumbnail-handler.ts`

```typescript
// 在文件顶部添加错误检测常量
const MEMORY_ERROR_PATTERNS = [
    "memory access out of bounds",
    "Allocation failed",
    "process out of memory",
    "ExternalEntityTable::AllocateEntry",
    "WASM memory allocation failed",
    "out of memory",
    "memory allocation error",
    "heap overflow",
] as const;

// 创建错误检测函数
function isMemoryError(error: any): boolean {
    const message = error?.message || error?.toString() || "";
    return MEMORY_ERROR_PATTERNS.some((pattern) =>
        message.toLowerCase().includes(pattern.toLowerCase()),
    );
}
```

**具体任务**:

- [ ] 在 `thumbnail-handler.ts` 第66行附近替换现有的错误检测逻辑
- [ ] 更新 `heic-extractor.ts` 中的错误处理，使用统一的错误检测
- [ ] 添加错误分类和统计功能
- [ ] 创建错误检测的单元测试

#### 1.2 增强模块重置机制

**文件修改**: `src/main/wasm/heif-module.ts`

```typescript
// 增强的模块重置函数
export async function enhancedResetHeifModule(): Promise<void> {
    const logger = getLogger("heif-module");

    // 1. 安全释放现有模块
    if (heifState.module && typeof heifState.module.free === "function") {
        try {
            heifState.module.free();
            logger.debug("WASM module freed successfully");
        } catch (error) {
            logger.warn(`Failed to free WASM module: ${error}`);
        }
    }

    // 2. 强制垃圾回收（如果可用）
    if (global.gc) {
        try {
            global.gc();
            logger.debug("Forced garbage collection completed");
        } catch (error) {
            logger.warn(`Garbage collection failed: ${error}`);
        }
    }

    // 3. 重置模块状态
    resetHeifModule();

    // 4. 记录内存使用情况
    const memUsage = process.memoryUsage();
    logger.info(
        `Memory after reset - Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, External: ${Math.round(memUsage.external / 1024 / 1024)}MB`,
    );
}
```

**具体任务**:

- [ ] 在 `heif-module.ts` 中添加 `enhancedResetHeifModule` 函数
- [ ] 更新 `thumbnail-handler.ts` 第72行，使用新的重置函数
- [ ] 添加内存使用日志记录
- [ ] 创建模块重置的集成测试

#### 1.3 优化错误处理流程

**文件修改**: `src/main/thumbnail/thumbnail-handler.ts` (第64-98行)

```typescript
// 重构错误处理逻辑
try {
    decoded = heifModule.decode(inputBuffer, inputBuffer.byteLength, false) as Uint8Array;
} catch (decodeError: any) {
    if (isMemoryError(decodeError)) {
        logger.warn("[thumbnail-handler] Memory error detected, attempting recovery", {
            error: decodeError.message,
            fileSize: inputBuffer.byteLength,
            memoryUsage: process.memoryUsage(),
        });

        // 执行增强的恢复流程
        await performMemoryErrorRecovery(decodeError, inputBuffer, heifModule, logger);
    } else {
        throw decodeError;
    }
}

// 新增恢复函数
async function performMemoryErrorRecovery(
    error: any,
    inputBuffer: Buffer,
    heifModule: any,
    logger: PhotasaLogger,
): Promise<Uint8Array> {
    // 1. 增强的模块重置
    await enhancedResetHeifModule();
    heifModule = await initializeHeifModule();

    // 2. 检查内存使用情况
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapUsed + memUsage.external;

    if (totalMemory > 500 * 1024 * 1024) {
        // 500MB
        logger.warn(`High memory usage detected: ${Math.round(totalMemory / 1024 / 1024)}MB`);
    }

    // 3. 文件大小检查
    const maxSize = 1024 * 1024 * 10; // 10MB
    if (inputBuffer.byteLength > maxSize) {
        throw new Error(`HEIC file too large (${inputBuffer.byteLength} bytes) for WASM decoder`);
    }

    // 4. 重试解码
    try {
        return heifModule.decode(inputBuffer, inputBuffer.byteLength, true) as Uint8Array;
    } catch (retryError) {
        logger.error("[thumbnail-handler] HEIC decode retry failed:", retryError);
        throw new Error(`HEIC decode failed after recovery: ${retryError}`);
    }
}
```

**具体任务**:

- [ ] 重构 `thumbnail-handler.ts` 中的错误处理逻辑
- [ ] 添加详细的错误日志记录，包含内存使用信息
- [ ] 实现分层的错误恢复策略
- [ ] 创建错误恢复的测试用例

### Phase 2: 内存监控系统 (1-2周)

#### 2.1 创建内存监控模块

**新文件**: `src/main/monitoring/memory-monitor.ts`

```typescript
import { getLogger } from "@common/logger";

const logger = getLogger("memory-monitor");

export interface MemoryMetrics {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
    totalMemory: number;
    memoryPressure: "low" | "medium" | "high" | "critical";
}

export interface MemoryThresholds {
    warning: number; // MB
    critical: number; // MB
    maximum: number; // MB
}

const DEFAULT_THRESHOLDS: MemoryThresholds = {
    warning: 400,
    critical: 500,
    maximum: 600,
};

export class MemoryMonitor {
    private thresholds: MemoryThresholds;
    private metrics: MemoryMetrics[] = [];
    private maxMetricsHistory = 100;
    private monitoringInterval: NodeJS.Timeout | null = null;

    constructor(thresholds: MemoryThresholds = DEFAULT_THRESHOLDS) {
        this.thresholds = thresholds;
    }

    getCurrentMetrics(): MemoryMetrics {
        const memUsage = process.memoryUsage();
        const totalMemory = memUsage.heapUsed + memUsage.external;

        return {
            timestamp: Date.now(),
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            arrayBuffers: memUsage.arrayBuffers,
            totalMemory,
            memoryPressure: this.calculateMemoryPressure(totalMemory),
        };
    }

    private calculateMemoryPressure(totalMemory: number): "low" | "medium" | "high" | "critical" {
        const totalMB = totalMemory / 1024 / 1024;

        if (totalMB > this.thresholds.maximum) return "critical";
        if (totalMB > this.thresholds.critical) return "high";
        if (totalMB > this.thresholds.warning) return "medium";
        return "low";
    }

    startMonitoring(intervalMs: number = 5000): void {
        if (this.monitoringInterval) {
            this.stopMonitoring();
        }

        this.monitoringInterval = setInterval(() => {
            const metrics = this.getCurrentMetrics();
            this.recordMetrics(metrics);

            if (metrics.memoryPressure === "critical") {
                logger.warn("Critical memory usage detected", metrics);
            } else if (metrics.memoryPressure === "high") {
                logger.info("High memory usage detected", metrics);
            }
        }, intervalMs);
    }

    stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    private recordMetrics(metrics: MemoryMetrics): void {
        this.metrics.push(metrics);

        // 保持历史记录在限制范围内
        if (this.metrics.length > this.maxMetricsHistory) {
            this.metrics = this.metrics.slice(-this.maxMetricsHistory);
        }
    }

    getMetricsHistory(): MemoryMetrics[] {
        return [...this.metrics];
    }

    getAverageMemoryUsage(timeWindowMs: number = 60000): number {
        const cutoff = Date.now() - timeWindowMs;
        const recentMetrics = this.metrics.filter((m) => m.timestamp > cutoff);

        if (recentMetrics.length === 0) return 0;

        const total = recentMetrics.reduce((sum, m) => sum + m.totalMemory, 0);
        return total / recentMetrics.length;
    }
}

// 单例实例
export const memoryMonitor = new MemoryMonitor();
```

**具体任务**:

- [ ] 创建 `src/main/monitoring/` 目录
- [ ] 实现 `MemoryMonitor` 类
- [ ] 添加内存监控的单元测试
- [ ] 集成到现有的日志系统

#### 2.2 集成内存监控到HEIF处理

**文件修改**: `src/main/thumbnail/thumbnail-handler.ts`

```typescript
import { memoryMonitor } from "@main/monitoring/memory-monitor";

// 在 createPreviewImage 函数开始时添加内存检查
async function createPreviewImage(arg: ThumbnailRequest, logger: PhotasaLogger): Promise<string> {
    // 检查当前内存使用情况
    const currentMetrics = memoryMonitor.getCurrentMetrics();
    if (currentMetrics.memoryPressure === "critical") {
        logger.warn(
            "[thumbnail-handler] Critical memory usage, delaying HEIF processing",
            currentMetrics,
        );
        // 可以在这里实现延迟或跳过逻辑
    }

    logger.info("[thumbnail-handler] Create Preview Image for : " + arg.path);
    // ... 现有代码
}
```

**具体任务**:

- [ ] 在 `thumbnail-handler.ts` 中集成内存监控
- [ ] 在 `heic-extractor.ts` 中添加内存检查
- [ ] 实现基于内存压力的处理策略
- [ ] 添加内存监控的集成测试

### Phase 3: 并发处理优化 (1-2周)

#### 3.1 实现HEIF处理队列

**新文件**: `src/main/processing/heif-queue.ts`

```typescript
import { getLogger } from "@common/logger";
import { memoryMonitor } from "@main/monitoring/memory-monitor";

const logger = getLogger("heif-queue");

export interface HeifTask {
    id: string;
    filePath: string;
    priority: "low" | "normal" | "high";
    createdAt: number;
    retryCount: number;
    maxRetries: number;
}

export class HeifProcessingQueue {
    private queue: HeifTask[] = [];
    private processing = new Set<string>();
    private maxConcurrent = 2; // 限制并发数量
    private maxQueueSize = 50;
    private processingTimeout = 30000; // 30秒超时

    async addTask(task: Omit<HeifTask, "id" | "createdAt" | "retryCount">): Promise<string> {
        if (this.queue.length >= this.maxQueueSize) {
            throw new Error("HEIF processing queue is full");
        }

        const id = `heif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullTask: HeifTask = {
            ...task,
            id,
            createdAt: Date.now(),
            retryCount: 0,
        };

        this.queue.push(fullTask);
        this.queue.sort((a, b) => this.getPriorityScore(b) - this.getPriorityScore(a));

        logger.debug(`Added HEIF task to queue: ${id}`, { queueSize: this.queue.length });
        this.processNext();

        return id;
    }

    private getPriorityScore(task: HeifTask): number {
        const priorityScores = { high: 3, normal: 2, low: 1 };
        return priorityScores[task.priority];
    }

    private async processNext(): Promise<void> {
        if (this.processing.size >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        const task = this.queue.shift();
        if (!task) return;

        this.processing.add(task.id);

        try {
            // 检查内存使用情况
            const memoryMetrics = memoryMonitor.getCurrentMetrics();
            if (memoryMetrics.memoryPressure === "critical") {
                logger.warn(`Memory pressure too high, delaying task ${task.id}`);
                this.queue.unshift(task); // 重新加入队列
                setTimeout(() => this.processNext(), 5000); // 5秒后重试
                return;
            }

            await this.processTask(task);
        } catch (error) {
            logger.error(`Task ${task.id} failed:`, error);
            await this.handleTaskFailure(task, error);
        } finally {
            this.processing.delete(task.id);
            this.processNext(); // 处理下一个任务
        }
    }

    private async processTask(task: HeifTask): Promise<void> {
        logger.info(`Processing HEIF task: ${task.id}`, { filePath: task.filePath });

        // 这里调用实际的HEIF处理逻辑
        // 可以集成到现有的 thumbnail-handler 或 heic-extractor

        // 模拟处理时间
        await new Promise((resolve) => setTimeout(resolve, 1000));

        logger.info(`Completed HEIF task: ${task.id}`);
    }

    private async handleTaskFailure(task: HeifTask, error: any): Promise<void> {
        task.retryCount++;

        if (task.retryCount < task.maxRetries) {
            logger.warn(`Retrying task ${task.id} (attempt ${task.retryCount + 1})`);
            this.queue.unshift(task); // 重新加入队列头部
        } else {
            logger.error(`Task ${task.id} failed after ${task.maxRetries} retries`);
            // 这里可以触发fallback处理或通知用户
        }
    }

    getQueueStatus() {
        return {
            queueSize: this.queue.length,
            processing: this.processing.size,
            maxConcurrent: this.maxConcurrent,
        };
    }
}

// 单例实例
export const heifQueue = new HeifProcessingQueue();
```

**具体任务**:

- [ ] 创建 `src/main/processing/` 目录
- [ ] 实现 `HeifProcessingQueue` 类
- [ ] 集成队列到现有的HEIF处理流程
- [ ] 添加队列管理的单元测试

#### 3.2 优化WASM模块并发访问

**文件修改**: `src/main/wasm/heif-module.ts`

```typescript
// 添加并发控制
let moduleLock = false;
const moduleAccessQueue: Array<() => void> = [];

export async function initializeHeifModule(): Promise<any> {
    // 如果模块已初始化且未被锁定，直接返回
    if (heifState.initialized && heifState.module && !moduleLock) {
        return heifState.module;
    }

    // 如果模块正在被其他进程使用，等待
    if (moduleLock) {
        return new Promise((resolve) => {
            moduleAccessQueue.push(() => resolve(heifState.module));
        });
    }

    moduleLock = true;

    try {
        // 现有的初始化逻辑...
        const module = await performModuleInitialization();
        heifState = { module, initialized: true };

        // 处理等待队列
        while (moduleAccessQueue.length > 0) {
            const callback = moduleAccessQueue.shift();
            if (callback) callback();
        }

        return module;
    } finally {
        moduleLock = false;
    }
}

// 添加模块使用计数
let moduleUsageCount = 0;
const MAX_MODULE_USAGE = 100; // 最大使用次数后重新初始化

export function trackModuleUsage(): void {
    moduleUsageCount++;

    if (moduleUsageCount > MAX_MODULE_USAGE) {
        logger.info("Module usage limit reached, scheduling reinitialization");
        moduleUsageCount = 0;
        // 异步重新初始化，不阻塞当前操作
        setImmediate(() => {
            resetHeifModule();
        });
    }
}
```

**具体任务**:

- [ ] 在 `heif-module.ts` 中添加并发控制
- [ ] 实现模块使用计数和自动重新初始化
- [ ] 添加模块访问的单元测试
- [ ] 测试并发场景下的模块稳定性

### Phase 4: 资源管理增强 (1周)

#### 4.1 优化WASM模块缓存策略

**文件修改**: `src/main/wasm/heif-module.ts`

```typescript
// 添加智能缓存管理
interface ModuleCacheInfo {
    lastUsed: number;
    usageCount: number;
    memoryFootprint: number;
}

let moduleCacheInfo: ModuleCacheInfo = {
    lastUsed: 0,
    usageCount: 0,
    memoryFootprint: 0,
};

export function getModuleCacheInfo(): ModuleCacheInfo {
    return { ...moduleCacheInfo };
}

export function shouldReinitializeModule(): boolean {
    const now = Date.now();
    const timeSinceLastUse = now - moduleCacheInfo.lastUsed;
    const maxIdleTime = 5 * 60 * 1000; // 5分钟

    return (
        timeSinceLastUse > maxIdleTime ||
        moduleCacheInfo.usageCount > MAX_MODULE_USAGE ||
        moduleCacheInfo.memoryFootprint > 100 * 1024 * 1024 // 100MB
    );
}

// 在每次使用模块时更新缓存信息
export function updateModuleCacheInfo(): void {
    moduleCacheInfo.lastUsed = Date.now();
    moduleCacheInfo.usageCount++;

    // 估算内存占用
    const memUsage = process.memoryUsage();
    moduleCacheInfo.memoryFootprint = memUsage.external;
}
```

**具体任务**:

- [ ] 实现智能模块缓存管理
- [ ] 添加基于时间和使用量的缓存策略
- [ ] 实现内存占用估算
- [ ] 添加缓存管理的测试用例

#### 4.2 实现资源泄漏检测

**新文件**: `src/main/monitoring/resource-leak-detector.ts`

```typescript
import { getLogger } from "@common/logger";
import { memoryMonitor } from "./memory-monitor";

const logger = getLogger("resource-leak-detector");

export class ResourceLeakDetector {
    private baselineMemory: number = 0;
    private memoryGrowthThreshold = 50 * 1024 * 1024; // 50MB
    private checkInterval = 30000; // 30秒
    private intervalId: NodeJS.Timeout | null = null;

    startMonitoring(): void {
        this.baselineMemory = this.getCurrentMemoryUsage();
        logger.info(
            `Resource leak detection started, baseline: ${Math.round(this.baselineMemory / 1024 / 1024)}MB`,
        );

        this.intervalId = setInterval(() => {
            this.checkForLeaks();
        }, this.checkInterval);
    }

    stopMonitoring(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private getCurrentMemoryUsage(): number {
        const memUsage = process.memoryUsage();
        return memUsage.heapUsed + memUsage.external;
    }

    private checkForLeaks(): void {
        const currentMemory = this.getCurrentMemoryUsage();
        const memoryGrowth = currentMemory - this.baselineMemory;

        if (memoryGrowth > this.memoryGrowthThreshold) {
            logger.warn("Potential memory leak detected", {
                baseline: Math.round(this.baselineMemory / 1024 / 1024),
                current: Math.round(currentMemory / 1024 / 1024),
                growth: Math.round(memoryGrowth / 1024 / 1024),
                threshold: Math.round(this.memoryGrowthThreshold / 1024 / 1024),
            });

            // 触发内存清理
            this.triggerMemoryCleanup();
        }
    }

    private triggerMemoryCleanup(): void {
        logger.info("Triggering memory cleanup due to potential leak");

        // 强制垃圾回收
        if (global.gc) {
            global.gc();
        }

        // 重置HEIF模块
        const { resetHeifModule } = require("@main/wasm/heif-module");
        resetHeifModule();

        // 更新基线
        this.baselineMemory = this.getCurrentMemoryUsage();
    }
}

// 单例实例
export const resourceLeakDetector = new ResourceLeakDetector();
```

**具体任务**:

- [ ] 实现资源泄漏检测器
- [ ] 集成到应用启动和关闭流程
- [ ] 添加泄漏检测的测试用例
- [ ] 实现自动内存清理机制

### Phase 5: 测试与验证 (1周)

#### 5.1 创建内存压力测试

**新文件**: `src/main/__tests__/memory-pressure.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { memoryMonitor } from "@main/monitoring/memory-monitor";
import { heifQueue } from "@main/processing/heif-queue";
import { initializeHeifModule, resetHeifModule } from "@main/wasm/heif-module";

describe("Memory Pressure Tests", () => {
    beforeEach(() => {
        resetHeifModule();
        memoryMonitor.stopMonitoring();
    });

    afterEach(() => {
        memoryMonitor.stopMonitoring();
    });

    it("should handle multiple concurrent HEIF processing", async () => {
        const tasks = [];

        // 创建多个并发任务
        for (let i = 0; i < 10; i++) {
            tasks.push(
                heifQueue.addTask({
                    filePath: `/test/heic/file${i}.heic`,
                    priority: "normal",
                    maxRetries: 3,
                }),
            );
        }

        const taskIds = await Promise.all(tasks);
        expect(taskIds).toHaveLength(10);

        // 等待所有任务完成
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const status = heifQueue.getQueueStatus();
        expect(status.queueSize).toBe(0);
    });

    it("should detect memory pressure and throttle processing", async () => {
        memoryMonitor.startMonitoring(1000); // 1秒间隔

        // 模拟高内存使用
        const largeArray = new Array(1000000).fill(0);

        const metrics = memoryMonitor.getCurrentMetrics();
        expect(metrics.memoryPressure).toBeDefined();

        // 清理
        largeArray.length = 0;
    });

    it("should recover from memory errors gracefully", async () => {
        // 这里可以模拟内存错误场景
        // 测试错误恢复机制
    });
});
```

**具体任务**:

- [ ] 创建内存压力测试套件
- [ ] 实现并发处理测试
- [ ] 添加错误恢复测试
- [ ] 创建性能基准测试

#### 5.2 集成测试和用户场景测试

**新文件**: `src/main/__tests__/heif-integration.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { createPreviewImage } from "@main/thumbnail/thumbnail-handler";
import { extractHeicMetadata } from "@main/import/metadata/extractors/heic-extractor";

describe("HEIF Integration Tests", () => {
    it("should process various HEIF file sizes", async () => {
        const testFiles = [
            { path: "/test/small.heic", size: "1MB" },
            { path: "/test/medium.heic", size: "5MB" },
            { path: "/test/large.heic", size: "10MB" },
        ];

        for (const file of testFiles) {
            // 测试不同大小的文件处理
            // 验证内存使用和错误处理
        }
    });

    it("should handle corrupted HEIF files gracefully", async () => {
        // 测试损坏文件的处理
    });

    it("should maintain performance under load", async () => {
        // 性能测试
    });
});
```

**具体任务**:

- [ ] 创建集成测试套件
- [ ] 实现用户场景测试
- [ ] 添加性能基准测试
- [ ] 创建错误场景测试

## 风险评估与缓解措施

### 高风险项目

1. **WASM模块并发访问**: 可能导致模块状态不一致
    - **缓解措施**: 实现严格的锁机制和状态检查
    - **回退方案**: 禁用并发处理，使用串行处理

2. **内存监控性能影响**: 频繁的内存检查可能影响性能
    - **缓解措施**: 使用合理的监控间隔，异步处理
    - **回退方案**: 降低监控频率或禁用实时监控

3. **错误处理逻辑复杂性**: 复杂的错误处理可能导致新的bug
    - **缓解措施**: 充分的单元测试和集成测试
    - **回退方案**: 保持现有的简单错误处理逻辑

### 中风险项目

1. **队列管理复杂性**: 可能影响现有处理流程
    - **缓解措施**: 渐进式集成，保持向后兼容
    - **回退方案**: 禁用队列，使用现有处理方式

2. **资源泄漏检测误报**: 可能触发不必要的清理
    - **缓解措施**: 设置合理的阈值和检测逻辑
    - **回退方案**: 禁用自动清理，仅记录警告

## 实施时间线

| 周次 | 阶段    | 主要任务     | 交付物             |
| ---- | ------- | ------------ | ------------------ |
| 1-2  | Phase 1 | 增强错误检测 | 扩展的错误检测机制 |
| 3-4  | Phase 2 | 内存监控系统 | 内存监控模块       |
| 5-6  | Phase 3 | 并发处理优化 | HEIF处理队列       |
| 7    | Phase 4 | 资源管理增强 | 智能缓存和泄漏检测 |
| 8    | Phase 5 | 测试与验证   | 完整的测试套件     |

## 成功标准

每个阶段完成后需要满足以下标准：

### Phase 1 完成标准

- [ ] 所有内存错误类型都能被正确检测
- [ ] 错误恢复成功率达到95%以上
- [ ] 单元测试覆盖率达到90%以上

### Phase 2 完成标准

- [ ] 内存监控系统稳定运行
- [ ] 内存预警准确率达到90%以上
- [ ] 监控性能影响小于5%

### Phase 3 完成标准

- [ ] 并发处理队列正常工作
- [ ] 支持至少2个并发HEIF处理任务
- [ ] 队列管理性能影响小于10%

### Phase 4 完成标准

- [ ] 智能缓存策略有效工作
- [ ] 资源泄漏检测准确率达到85%以上
- [ ] 自动清理机制稳定运行

### Phase 5 完成标准

- [ ] 所有测试用例通过
- [ ] 性能基准测试达标
- [ ] 用户场景测试通过

## Success Metrics

### 稳定性指标

- **内存溢出崩溃率**：< 0.1% (目标：从当前的内存溢出崩溃降低到接近零)
- **WASM错误恢复成功率**：> 95% (目标：大部分WASM错误能够自动恢复)
- **HEIF处理成功率**：> 98% (目标：几乎所有的HEIF图像都能成功处理)

### 性能指标

- **内存使用峰值**：< 600MB (目标：控制内存使用在合理范围，基于现有基线)
- **处理时间影响**：< 当前时间的110% (目标：性能影响控制在10%以内)
- **错误检测延迟**：< 50ms (目标：快速错误检测和处理)

### 监控指标

- **内存预警准确率**：> 90% (目标：准确预测内存问题)
- **错误日志完整性**：100% (目标：所有内存相关错误都有详细日志)
- **资源清理成功率**：> 99% (目标：WASM模块资源正确清理)

## Conclusion

基于对现有代码的深入分析，本RFC提出了针对性的WASM内存管理优化方案。当前应用已具备良好的错误处理基础，但仍存在内存溢出崩溃的问题。通过增强现有机制而非重新设计，我们可以以更低的成本和风险实现稳定性提升。

这个RFC的优势在于：

1. **基于现有架构**：利用已有的错误处理框架，减少实施风险
2. **渐进式改进**：分阶段实施，每阶段都有明确的收益
3. **可测量性**：设定了具体的成功指标和监控机制
4. **向后兼容**：不影响现有功能的正常使用

建议优先实施Phase 1（增强错误检测），这是最直接有效的改进，可以快速解决大部分内存溢出问题。然后根据实际效果决定后续阶段的实施优先级。

---

**Status**: Draft
**Assignee**: [待分配]
**Reviewers**: [待分配]
**Target Release**: v1.7.0
