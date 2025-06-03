const DEV_MODE = process.env.NODE_ENV === "development";
const isNode =
    typeof process !== "undefined" && process.versions != null && process.versions.node != null;

// Simple browser logger
class BrowserLogger {
    private category: string;
    private level: string;

    constructor(category: string) {
        this.category = category;
        this.level = DEV_MODE ? "debug" : "info";
    }

    private formatMessage(level: string, ...args: any[]): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] ${level.toUpperCase()} ${this.category} - ${args.join(" ")}`;
    }

    debug(...args: any[]): void {
        if (this.level === "debug") {
            console.debug(this.formatMessage("debug", ...args));
        }
    }

    info(...args: any[]): void {
        console.info(this.formatMessage("info", ...args));
    }

    warn(...args: any[]): void {
        console.warn(this.formatMessage("warn", ...args));
    }

    error(...args: any[]): void {
        console.error(this.formatMessage("error", ...args));
    }
}

// Node.js logger using log4js
let NodeLogger: any;
if (isNode) {
    const log4js = require("log4js");
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

    NodeLogger = function (category: string) {
        const logger = log4js.getLogger(category);
        logger.level = DEV_MODE ? "debug" : "info";
        return logger;
    };
}

// Create a logger factory
export function getLogger(category: string) {
    return isNode ? new NodeLogger(category) : new BrowserLogger(category);
}

// Export commonly used loggers
export const loggers = {
    app: getLogger("app"),
    scan: getLogger("scan"),
    worker: getLogger("worker"),
    config: getLogger("config"),
    thumbnail: getLogger("thumbnail"),
    fileWatch: getLogger("file-watch"),
};
