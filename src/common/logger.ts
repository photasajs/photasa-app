import log4js from "log4js";
import type { Logger } from "log4js";

const DEV_MODE = process.env.NODE_ENV === "development";
const isNode =
    typeof process !== "undefined" && process.versions != null && process.versions.node != null;

// 日志条目接口
export interface LogEntry {
    timestamp: string;
    level: "debug" | "info" | "warn" | "error";
    category: string;
    message: string;
    source: "main" | "renderer" | "worker";
    threadId?: string;
}

// 正确的 log4js interceptor appender 实现
const createInterceptorAppender = (interceptorInstance: LogInterceptor) => {
    return {
        configure: (_config: any, _layouts: any) => {
            // 创建 appender 函数
            const appender = (logEvent: any) => {
                // 只有在激活时才进行拦截处理
                if (interceptorInstance.isActive) {
                    const entry: LogEntry = {
                        timestamp: new Date(logEvent.startTime).toISOString(),
                        level: logEvent.level.levelStr.toLowerCase() as any,
                        category: logEvent.categoryName,
                        message: logEvent.data.join(" "),
                        source: "main",
                    };
                    interceptorInstance.notify(entry);
                }
            };

            // 添加 shutdown 支持
            appender.shutdown = (done: () => void) => {
                done();
            };

            return appender;
        },
    };
};

// 改进的日志拦截器类
export class LogInterceptor {
    private listeners = new Set<(entry: LogEntry) => void>();
    private _isActive = false;
    private originalConsole: any = {};
    private appenderModule: any;

    constructor() {
        // 创建这个实例专用的 appender 模块
        this.appenderModule = createInterceptorAppender(this);
    }

    get isActive(): boolean {
        return this._isActive;
    }

    activate() {
        if (this._isActive) return;
        this._isActive = true;

        if (isNode) {
            this.attachNodeInterceptor();
        } else {
            this.attachBrowserInterceptor();
        }
    }

    deactivate() {
        if (!this._isActive) return;
        this._isActive = false;

        if (isNode) {
            this.detachNodeInterceptor();
        } else {
            this.detachBrowserInterceptor();
        }

        this.listeners.clear();
    }

    subscribe(listener: (entry: LogEntry) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify(entry: LogEntry) {
        if (!this._isActive) return;
        this.listeners.forEach((listener) => listener(entry));
    }

    private attachNodeInterceptor() {
        // 正确的 log4js 配置，使用预创建的 appender 模块
        log4js.configure({
            appenders: {
                console: {
                    type: "console",
                    layout: {
                        type: "pattern",
                        pattern: "%[%d{yyyy-MM-dd hh:mm:ss.SSS} %-5p %c -%] %m",
                    },
                },
                interceptor: {
                    type: this.appenderModule, // 正确的模块引用方式
                },
            },
            categories: {
                default: {
                    appenders: ["console", "interceptor"], // console 保证正常输出，interceptor 提供拦截
                    level: DEV_MODE ? "debug" : "info",
                },
            },
        });
    }

    private detachNodeInterceptor() {
        // 恢复到只有 console appender 的原始配置
        log4js.configure({
            appenders: {
                console: {
                    type: "console",
                    layout: {
                        type: "pattern",
                        pattern: "%[%d{yyyy-MM-dd hh:mm:ss.SSS} %-5p %c -%] %m",
                    },
                },
            },
            categories: {
                default: {
                    appenders: ["console"],
                    level: DEV_MODE ? "debug" : "info",
                },
            },
        });
    }

    private attachBrowserInterceptor() {
        // 保存原始console方法
        this.originalConsole = {
            debug: console.debug,
            info: console.info,
            warn: console.warn,
            error: console.error,
        };

        // 非侵入式拦截：保持原有功能，添加拦截逻辑
        ["debug", "info", "warn", "error"].forEach((level) => {
            const originalMethod = console[level as keyof Console] as any;
            (console as any)[level] = function (...args: any[]) {
                // 始终调用原始方法保持正常输出
                originalMethod.apply(console, args);

                // 只有在激活时才进行拦截
                if (this._isActive) {
                    const entry: LogEntry = {
                        timestamp: new Date().toISOString(),
                        level: level as any,
                        category: "renderer",
                        message: args
                            .map((arg) =>
                                typeof arg === "object" ? safeStringify(arg) : String(arg),
                            )
                            .join(" "),
                        source: "renderer",
                    };
                    // 在 renderer 进程中，直接通知本地监听器（log viewer UI）
                    this.notify(entry);
                }
            };
        });
    }

    private detachBrowserInterceptor() {
        // 恢复原始console方法
        if (this.originalConsole.debug) {
            console.debug = this.originalConsole.debug;
            console.info = this.originalConsole.info;
            console.warn = this.originalConsole.warn;
            console.error = this.originalConsole.error;
        }
    }
}

// 全局拦截器实例
export const globalLogInterceptor = new LogInterceptor();

// 安全序列化函数，处理循环引用和不可序列化对象
function safeStringify(obj: unknown, maxDepth = 3): string {
    const seen = new WeakSet();

    function stringify(value: unknown, depth = 0): string {
        // 深度限制
        if (depth > maxDepth) {
            return "[Max depth reached]";
        }

        // 处理基本类型
        if (value === null) return "null";
        if (value === undefined) return "undefined";
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
        if (typeof value === "symbol") return `[Symbol: ${value.toString()}]`;
        if (typeof value === "bigint") return `${value}n`;

        // 处理日期
        if (value instanceof Date) {
            return value.toISOString();
        }

        // 处理错误对象
        if (value instanceof Error) {
            return `[Error: ${value.message}]`;
        }

        // 处理对象和数组
        if (typeof value === "object") {
            // 检查循环引用
            if (seen.has(value)) {
                return "[Circular Reference]";
            }
            seen.add(value);

            try {
                if (Array.isArray(value)) {
                    const items = value.slice(0, 10).map((item) => stringify(item, depth + 1));
                    const result = `[${items.join(", ")}${value.length > 10 ? ", ..." : ""}]`;
                    seen.delete(value);
                    return result;
                } else {
                    const entries = Object.entries(value).slice(0, 10);
                    const items = entries.map(
                        ([key, val]) => `${key}: ${stringify(val, depth + 1)}`,
                    );
                    const result = `{${items.join(", ")}${Object.keys(value).length > 10 ? ", ..." : ""}}`;
                    seen.delete(value);
                    return result;
                }
            } catch (error) {
                seen.delete(value);
                return `[Unserializable object: ${error instanceof Error ? error.message : "unknown error"}]`;
            }
        }

        return "[Unknown type]";
    }

    try {
        return stringify(obj);
    } catch (error) {
        return `[Stringify error: ${error instanceof Error ? error.message : "unknown error"}]`;
    }
}

// Simple browser logger
export class BrowserLogger {
    private category: string;
    private level: string;

    constructor(category: string) {
        this.category = category;
        this.level = DEV_MODE ? "debug" : "info";
    }

    private formatMessage(level: string, ...args: unknown[]): string {
        const timestamp = new Date().toISOString();
        // 智能处理不同类型的参数，安全序列化对象
        const processedArgs = args.map((arg) => {
            if (typeof arg === "object" && arg !== null) {
                return safeStringify(arg);
            }
            return String(arg);
        });
        return `[${timestamp}] ${level.toUpperCase()} ${this.category} - ${processedArgs.join(" ")}`;
    }

    private notifyInterceptor(level: string, ...args: unknown[]) {
        if (globalLogInterceptor && globalLogInterceptor["isActive"]) {
            const message = args
                .map((arg) => {
                    if (typeof arg === "object" && arg !== null) {
                        return safeStringify(arg);
                    }
                    return String(arg);
                })
                .join(" ");

            const entry: LogEntry = {
                timestamp: new Date().toISOString(),
                level: level as any,
                category: this.category,
                message,
                source: "renderer",
            };

            globalLogInterceptor.notify(entry);
        }
    }

    debug(...args: unknown[]): void {
        if (this.level === "debug") {
            console.debug(this.formatMessage("debug", ...args));
            this.notifyInterceptor("debug", ...args);
        }
    }

    info(...args: unknown[]): void {
        console.info(this.formatMessage("info", ...args));
        this.notifyInterceptor("info", ...args);
    }

    warn(...args: unknown[]): void {
        console.warn(this.formatMessage("warn", ...args));
        this.notifyInterceptor("warn", ...args);
    }

    error(...args: unknown[]): void {
        console.error(this.formatMessage("error", ...args));
        this.notifyInterceptor("error", ...args);
    }
}

// Node.js logger using log4js
if (isNode) {
    log4js.configure({
        appenders: {
            console: {
                type: "console",
                layout: {
                    type: "pattern",
                    pattern: "%[%d{yyyy-MM-dd hh:mm:ss.SSS} %-5p %c -%] %m",
                },
            },
        },
        categories: {
            default: {
                appenders: ["console"],
                level: DEV_MODE ? "debug" : "info",
            },
        },
    });
}

export type PhotasaLogger = Logger | BrowserLogger;

// Create a logger factory
export function getLogger(category: string): PhotasaLogger {
    return isNode ? log4js.getLogger(category) : new BrowserLogger(category);
}

// Export commonly used loggers
export const loggers: Record<string, PhotasaLogger> = {
    app: getLogger("app"),
    main: getLogger("main"),
    preload: getLogger("preload"),
    renderer: getLogger("renderer"),
    config: getLogger("config"),
    scan: getLogger("scan"),
    thumbnail: getLogger("thumbnail"),
    preference: getLogger("preference"),
    worker: getLogger("worker"),
    watch: getLogger("watch"),
    window: getLogger("window"),
    shell: getLogger("shell"),
    api: getLogger("api"),
    import: getLogger("import"),
    importProgress: getLogger("importProgress"),
    update: getLogger("update"),
    discovery: getLogger("discovery"),
};
