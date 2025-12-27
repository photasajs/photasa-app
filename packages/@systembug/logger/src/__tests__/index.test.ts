/**
 * Logger 单元测试
 */

import { Logger, LogLevel, MemoryTransport, createLogger } from "../index";

describe("Logger", () => {
    describe("基本日志功能", () => {
        test("应该记录不同级别的日志", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                level: LogLevel.DEBUG,
                transports: [transport],
                isProduction: false,
            });

            logger.debug("debug message");
            logger.info("info message");
            logger.warn("warn message");
            logger.error("error message");

            const entries = transport.getEntries();
            expect(entries).toHaveLength(4);
            expect(entries[0].level).toBe(LogLevel.DEBUG);
            expect(entries[1].level).toBe(LogLevel.INFO);
            expect(entries[2].level).toBe(LogLevel.WARN);
            expect(entries[3].level).toBe(LogLevel.ERROR);
        });

        test("应该根据日志级别过滤", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                level: LogLevel.WARN,
                transports: [transport],
                isProduction: false,
            });

            logger.debug("debug message");
            logger.info("info message");
            logger.warn("warn message");
            logger.error("error message");

            const entries = transport.getEntries();
            expect(entries).toHaveLength(2);
            expect(entries[0].level).toBe(LogLevel.WARN);
            expect(entries[1].level).toBe(LogLevel.ERROR);
        });

        test("应该支持额外参数", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                transports: [transport],
                isProduction: false,
            });

            logger.info("message with args", { key: "value" }, 123);

            const entries = transport.getEntries();
            expect(entries[0].args).toEqual([{ key: "value" }, 123]);
        });
    });

    describe("生产环境检测", () => {
        test("生产环境下应该禁用所有日志", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                level: LogLevel.DEBUG,
                transports: [transport],
                isProduction: true,
            });

            logger.debug("debug");
            logger.info("info");
            logger.warn("warn");
            logger.error("error");

            expect(transport.getEntries()).toHaveLength(0);
        });

        test("非生产环境下应该正常记录日志", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                level: LogLevel.DEBUG,
                transports: [transport],
                isProduction: false,
            });

            logger.info("test message");

            expect(transport.getEntries()).toHaveLength(1);
        });

        test("应该能检查是否为生产环境", () => {
            const prodLogger = new Logger({ isProduction: true });
            const devLogger = new Logger({ isProduction: false });

            expect(prodLogger.isProduction()).toBe(true);
            expect(devLogger.isProduction()).toBe(false);
        });
    });

    describe("上下文", () => {
        test("应该在日志中包含上下文", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                context: "TestModule",
                transports: [transport],
                isProduction: false,
            });

            logger.info("test message");

            const entries = transport.getEntries();
            expect(entries[0].context).toBe("TestModule");
        });

        test("应该创建带上下文的子Logger", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                context: "Parent",
                transports: [transport],
                isProduction: false,
            });

            const childLogger = logger.child("Child");
            childLogger.info("test message");

            const entries = transport.getEntries();
            expect(entries[0].context).toBe("Parent:Child");
        });

        test("子Logger应该继承父Logger的配置", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                level: LogLevel.WARN,
                transports: [transport],
                isProduction: false,
            });

            const childLogger = logger.child("Child");
            childLogger.info("info message"); // 应该被过滤
            childLogger.warn("warn message"); // 应该记录

            const entries = transport.getEntries();
            expect(entries).toHaveLength(1);
            expect(entries[0].level).toBe(LogLevel.WARN);
        });
    });

    describe("日志级别管理", () => {
        test("应该能设置和获取日志级别", () => {
            const logger = new Logger({ level: LogLevel.INFO, isProduction: false });

            expect(logger.getLevel()).toBe(LogLevel.INFO);

            logger.setLevel(LogLevel.ERROR);
            expect(logger.getLevel()).toBe(LogLevel.ERROR);
        });
    });

    describe("时间戳", () => {
        test("应该包含时间戳", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                enableTimestamp: true,
                transports: [transport],
                isProduction: false,
            });

            logger.info("test");

            const entries = transport.getEntries();
            expect(entries[0].timestamp).toBeGreaterThan(0);
        });

        test("应该能禁用时间戳", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                enableTimestamp: false,
                transports: [transport],
                isProduction: false,
            });

            logger.info("test");

            const entries = transport.getEntries();
            expect(entries[0].timestamp).toBe(0);
        });
    });

    describe("MemoryTransport", () => {
        test("应该能清空日志", () => {
            const transport = new MemoryTransport();
            const logger = new Logger({
                transports: [transport],
                isProduction: false,
            });

            logger.info("message 1");
            logger.info("message 2");
            expect(transport.getEntries()).toHaveLength(2);

            transport.clear();
            expect(transport.getEntries()).toHaveLength(0);
        });
    });

    describe("createLogger", () => {
        test("应该创建Logger实例", () => {
            const logger = createLogger({ level: LogLevel.DEBUG, isProduction: false });
            expect(logger).toBeInstanceOf(Logger);
            expect(logger.getLevel()).toBe(LogLevel.DEBUG);
        });
    });
});
