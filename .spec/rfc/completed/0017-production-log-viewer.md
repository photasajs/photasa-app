# RFC 0017: Production Log Viewer System

- **RFC编号**: 0017
- **标题**: Production Log Viewer System
- **作者**: 李鹏
- **开始日期**: 2025-01-13
- **状态**: ✅ **已完成**
- **完成日期**: 2025-01-13
- **类型**: 功能

## 概述

实现一个按需激活的生产环境日志查看器，通过隐藏快捷键触发时才开始收集日志，在前端实时显示主进程和工作线程的日志，关闭后停止收集，实现零性能影响。

## 动机

当前问题：

1. 生产环境中难以查看应用运行日志
2. 无法实时监控主进程和Worker线程的日志输出
3. 问题诊断需要依赖外部工具或文件系统日志

需求：

1. 快速查看实时日志而不影响用户体验
2. 支持过滤和搜索功能
3. 通过隐藏快捷键触发，避免普通用户误操作

## 详细设计

### 1. 日志拦截层（按需激活）

扩展现有的 `logger.ts`，添加可激活的日志拦截器：

```typescript
// src/common/logger.ts 扩展
class LogInterceptor {
 private listeners: Set<(entry: LogEntry) => void> = new Set();
 private isActive = false;
 private originalAppenders: Map<string, any> = new Map();

 activate() {
 if (this.isActive) return;
 this.isActive = true;

 // 在Node环境动态添加自定义appender
 if (isNode) {
 this.attachInterceptor();
 }
 }

 deactivate() {
 if (!this.isActive) return;
 this.isActive = false;

 // 移除拦截器
 if (isNode) {
 this.detachInterceptor();
 }

 this.listeners.clear();
 }

 subscribe(listener: (entry: LogEntry) => void) {
 this.listeners.add(listener);
 return () => this.listeners.delete(listener);
 }

 private attachInterceptor() {
 // 为所有logger添加内存appender
 const categories = log4js.getLogger().categories;
 for (const [name, category] of categories) {
 // 保存原始配置
 this.originalAppenders.set(name, category.appenders);

 // 添加自定义appender
 log4js.configure({
 appenders: {
 ...log4js.appenders,
 memoryAppender: {
 type: 'memory',
 layout: { type: 'basic' },
 callback: (loggingEvent) => {
 if (!this.isActive) return;

 const entry: LogEntry = {
 timestamp: new Date(loggingEvent.startTime).toISOString(),
 level: loggingEvent.level.levelStr.toLowerCase(),
 category: loggingEvent.categoryName,
 message: loggingEvent.data.join(' '),
 source: 'main'
 };

 this.listeners.forEach(listener => listener(entry));
 }
 }
 },
 categories: {
 [name]: {
 appenders: [...category.appenders, 'memoryAppender'],
 level: category.level
 }
 }
 });
 }
 }

 private detachInterceptor() {
 // 恢复原始配置
 for (const [name, appenders] of this.originalAppenders) {
 // 恢复原始appenders配置
 }
 this.originalAppenders.clear();
 }
}

// 浏览器端日志拦截
export class BrowserLogger {
 private category: string;
 private level: string;
 private static interceptor?: LogInterceptor;

 static setInterceptor(interceptor: LogInterceptor) {
 BrowserLogger.interceptor = interceptor;
 }

 private notifyInterceptor(level: string, ...args: unknown[]) {
 if (!BrowserLogger.interceptor?.isActive) return;

 const entry: LogEntry = {
 timestamp: new Date().toISOString(),
 level: level as any,
 category: this.category,
 message: args.map(arg => /* safe stringify */).join(' '),
 source: 'renderer'
 };

 BrowserLogger.interceptor.notify(entry);
 }

 debug(...args: unknown[]): void {
 if (this.level === "debug") {
 console.debug(this.formatMessage("debug", ...args));
 this.notifyInterceptor("debug", ...args);
 }
 }

 // 其他日志方法类似...
}

interface LogEntry {
 timestamp: string;
 level: 'debug' | 'info' | 'warn' | 'error';
 category: string;
 message: string;
 source: 'main' | 'renderer' | 'worker';
 threadId?: string;
}
```

### 2. 主进程日志服务

创建 `LogViewerService` 管理日志收集和分发：

```typescript
// src/main/log-viewer/log-viewer-service.ts
export class LogViewerService {
    private logInterceptor = new LogInterceptor();
    private isActive = false;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        // IPC处理器
        ipcMain.handle("log:viewer-open", (event) => {
            if (this.isActive) return;
            this.isActive = true;

            // 激活日志拦截
            this.logInterceptor.activate();

            // 订阅日志流
            const unsubscribe = this.logInterceptor.subscribe((entry) => {
                mainWindow.webContents.send("log:entry", entry);
            });

            // 存储清理函数
            event.sender.once("destroyed", () => {
                this.cleanup();
            });

            return { success: true };
        });

        ipcMain.handle("log:viewer-close", () => {
            this.cleanup();
            return { success: true };
        });

        // 处理Worker日志
        ipcMain.on("worker:log", (_, entry: LogEntry) => {
            if (this.isActive) {
                // 转发给前端
                mainWindow.webContents.send("log:entry", {
                    ...entry,
                    source: "worker",
                });
            }
        });
    }

    private cleanup() {
        if (!this.isActive) return;
        this.isActive = false;
        this.logInterceptor.deactivate();
    }
}
```

### 3. 前端日志查看器组件

```vue
<!-- src/renderer/src/components/LogConsole.vue -->
<template>
    <div v-if="visible" class="log-console">
        <div class="log-header">
            <h3>系统日志控制台</h3>
            <div class="log-controls">
                <input v-model="searchTerm" placeholder="搜索日志..." class="log-search" />
                <select v-model="levelFilter">
                    <option value="">所有级别</option>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                </select>
                <button @click="clearLogs">清空</button>
                <button @click="exportLogs">导出</button>
                <button @click="close">关闭</button>
            </div>
        </div>

        <div class="log-body" ref="logContainer">
            <div
                v-for="(entry, index) in filteredLogs"
                :key="index"
                :class="['log-entry', `log-${entry.level}`]"
            >
                <span class="log-time">{{ entry.timestamp }}</span>
                <span class="log-level">{{ entry.level }}</span>
                <span class="log-category">{{ entry.category }}</span>
                <span class="log-message">{{ entry.message }}</span>
            </div>
        </div>

        <div class="log-footer">
            <span>显示 {{ filteredLogs.length }} / {{ logs.length }} 条日志</span>
            <label>
                <input type="checkbox" v-model="autoScroll" />
                自动滚动
            </label>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";

const visible = ref(false);
const logs = ref<LogEntry[]>([]);
const searchTerm = ref("");
const levelFilter = ref("");
const autoScroll = ref(true);
const logContainer = ref<HTMLElement>();

const filteredLogs = computed(() => {
    return logs.value.filter((log) => {
        const matchesLevel = !levelFilter.value || log.level === levelFilter.value;
        const matchesSearch =
            !searchTerm.value ||
            log.message.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
            log.category.toLowerCase().includes(searchTerm.value.toLowerCase());
        return matchesLevel && matchesSearch;
    });
});

// 监听快捷键
const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+Shift+Option+L (Mac) / Ctrl+Shift+Alt+L (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.altKey && e.key === "L") {
        e.preventDefault();
        toggle();
    }
};

const toggle = async () => {
    visible.value = !visible.value;
    if (visible.value) {
        // 通知主进程开始收集日志
        await window.api.log.viewerOpen();
        logs.value = []; // 清空旧日志
    } else {
        // 通知主进程停止收集日志
        await window.api.log.viewerClose();
        logs.value = []; // 清空日志
    }
};

onMounted(() => {
    document.addEventListener("keydown", handleKeyDown);

    // 监听新日志
    window.api.log.onEntry((entry: LogEntry) => {
        logs.value.push(entry);
        // 限制最大条数
        if (logs.value.length > 5000) {
            logs.value.shift();
        }

        // 自动滚动
        if (autoScroll.value && logContainer.value) {
            requestAnimationFrame(() => {
                logContainer.value!.scrollTop = logContainer.value!.scrollHeight;
            });
        }
    });
});

onUnmounted(() => {
    document.removeEventListener("keydown", handleKeyDown);
    if (visible.value) {
        window.api.log.viewerClose();
    }
});
</script>
```

### 4. Worker线程日志收集

扩展现有Worker，仅在日志查看器激活时上报：

```typescript
// 在worker中
let logViewerActive = false;

// 监听主进程通知
parentPort?.on("message", (msg) => {
    if (msg.type === "log:viewer-status") {
        logViewerActive = msg.active;
    }
});

// 包装日志函数
function workerLog(level: string, category: string, message: string) {
    // 正常输出到控制台
    console[level](`[${category}] ${message}`);

    // 仅在日志查看器激活时上报
    if (logViewerActive && parentPort) {
        parentPort.postMessage({
            type: "worker:log",
            entry: {
                timestamp: new Date().toISOString(),
                level,
                category,
                message,
                source: "worker",
                threadId: threadId,
            },
        });
    }
}
```

### 5. Preload API暴露

```typescript
// src/preload/index.ts
contextBridge.exposeInMainWorld("api", {
    log: {
        viewerOpen: () => ipcRenderer.invoke("log:viewer-open"),
        viewerClose: () => ipcRenderer.invoke("log:viewer-close"),
        onEntry: (callback: (entry: LogEntry) => void) => {
            ipcRenderer.on("log:entry", (_, entry) => callback(entry));
        },
    },
});
```

## 实施计划

1. **第一阶段**：扩展logger.ts添加可激活的LogInterceptor
2. **第二阶段**：创建LogViewerService主进程服务
3. **第三阶段**：实现LogConsole.vue组件
4. **第四阶段**：集成Worker日志收集（按需激活）
5. **第五阶段**：测试和优化

## 优势

1. **零性能影响**：日志收集仅在查看器打开时激活，平时无任何开销
2. **按需收集**：不会产生不必要的内存占用
3. **实时性**：打开即看，实时显示所有线程日志
4. **隐蔽性**：通过隐藏快捷键触发，不影响普通用户

## 风险与缓解

1. **历史日志缺失**：打开查看器前的日志无法查看 - 这是设计权衡，优先考虑性能
2. **日志丢失**：关闭查看器后日志清空 - 可选择性导出重要日志
3. **安全性**：生产环境可通过环境变量完全禁用

## 替代方案

1. 使用Desktop的DevTools控制台
2. 集成第三方日志服务（如Sentry）
3. 写入本地文件系统

## 未解决的问题

1. 是否需要持久化部分重要日志？
2. 是否需要日志级别的动态调整？
3. 是否需要支持日志的高级过滤（正则表达式）？

## 参考资料

- [contract reference IPC通信](https://www.desktop-shell.dev/docs/latest/api/ipc-main)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Log4js Appenders](https://log4js-node.github.io/log4js-node/appenders.html)
