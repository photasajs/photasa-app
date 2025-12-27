/**
 * @systembug/logger
 * 平台中立的日志库
 *
 * 生产环境下自动禁用日志输出
 */

/**
 * 日志级别
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4,
}

/**
 * 日志条目
 */
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: number;
    args?: any[];
    context?: string;
}

/**
 * 日志传输器接口
 */
export interface LogTransport {
    log(entry: LogEntry): void;
}

/**
 * Logger配置
 */
export interface LoggerConfig {
    /** 最小日志级别 */
    level?: LogLevel;
    /** 日志上下文（如模块名） */
    context?: string;
    /** 日志传输器 */
    transports?: LogTransport[];
    /** 是否启用时间戳 */
    enableTimestamp?: boolean;
    /** 是否为生产环境（生产环境下禁用日志） */
    isProduction?: boolean;
}

/**
 * 检测是否为生产环境
 */
function detectProduction(): boolean {
    // Node.js环境
    if (typeof process !== "undefined" && process.env) {
        return process.env.NODE_ENV === "production";
    }

    return false;
}

/**
 * Logger类
 */
export class Logger {
    private config: Required<LoggerConfig>;

    constructor(config: LoggerConfig = {}) {
        this.config = {
            level: LogLevel.INFO,
            context: "",
            transports: [new ConsoleTransport()],
            enableTimestamp: true,
            isProduction: config.isProduction ?? detectProduction(),
            ...config,
        };
    }

    /**
     * 记录debug日志
     */
    debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    /**
     * 记录info日志
     */
    info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    /**
     * 记录warn日志
     */
    warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    /**
     * 记录error日志
     */
    error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, message, ...args);
    }

    /**
     * 记录日志
     */
    private log(level: LogLevel, message: string, ...args: any[]): void {
        // 生产环境下禁用所有日志
        if (this.config.isProduction) {
            return;
        }

        if (level < this.config.level) {
            return;
        }

        const entry: LogEntry = {
            level,
            message,
            timestamp: this.config.enableTimestamp ? Date.now() : 0,
            args: args.length > 0 ? args : undefined,
            context: this.config.context || undefined,
        };

        for (const transport of this.config.transports) {
            transport.log(entry);
        }
    }

    /**
     * 设置日志级别
     */
    setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    /**
     * 获取日志级别
     */
    getLevel(): LogLevel {
        return this.config.level;
    }

    /**
     * 检查是否为生产环境
     */
    isProduction(): boolean {
        return this.config.isProduction;
    }

    /**
     * 创建子Logger（带上下文）
     */
    child(context: string): Logger {
        return new Logger({
            ...this.config,
            context: this.config.context ? `${this.config.context}:${context}` : context,
        });
    }
}

/**
 * 控制台传输器（平台中立）
 */
export class ConsoleTransport implements LogTransport {
    log(entry: LogEntry): void {
        const levelName = LogLevel[entry.level];
        const timestamp = entry.timestamp ? new Date(entry.timestamp).toISOString() : "";
        const context = entry.context ? `[${entry.context}]` : "";
        const prefix = [timestamp, levelName, context].filter(Boolean).join(" ");

        const logFn = this.getLogFunction(entry.level);

        if (entry.args && entry.args.length > 0) {
            logFn(`${prefix} ${entry.message}`, ...entry.args);
        } else {
            logFn(`${prefix} ${entry.message}`);
        }
    }

    private getLogFunction(level: LogLevel): (...args: any[]) => void {
        switch (level) {
            case LogLevel.DEBUG:
                return console.debug.bind(console);
            case LogLevel.INFO:
                return console.info.bind(console);
            case LogLevel.WARN:
                return console.warn.bind(console);
            case LogLevel.ERROR:
                return console.error.bind(console);
            default:
                return console.log.bind(console);
        }
    }
}

/**
 * 内存传输器（用于测试）
 */
export class MemoryTransport implements LogTransport {
    private entries: LogEntry[] = [];

    log(entry: LogEntry): void {
        this.entries.push(entry);
    }

    getEntries(): LogEntry[] {
        return this.entries;
    }

    clear(): void {
        this.entries = [];
    }
}

/**
 * 创建默认Logger
 */
export function createLogger(config?: LoggerConfig): Logger {
    return new Logger(config);
}

/**
 * 默认Logger实例
 */
export const defaultLogger = createLogger();
