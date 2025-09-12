import log4js from "log4js";
import type { Logger } from "log4js";

const DEV_MODE = process.env.NODE_ENV === "development";
const isNode =
    typeof process !== "undefined" && process.versions != null && process.versions.node != null;

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

    debug(...args: unknown[]): void {
        if (this.level === "debug") {
            console.debug(this.formatMessage("debug", ...args));
        }
    }

    info(...args: unknown[]): void {
        console.info(this.formatMessage("info", ...args));
    }

    warn(...args: unknown[]): void {
        console.warn(this.formatMessage("warn", ...args));
    }

    error(...args: unknown[]): void {
        console.error(this.formatMessage("error", ...args));
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
    worker: getLogger("worker"),
    watch: getLogger("watch"),
    window: getLogger("window"),
    shell: getLogger("shell"),
    api: getLogger("api"),
    importProgress: getLogger("importProgress"),
};
