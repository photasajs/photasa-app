import { describe, it, expect, vi } from "vitest";
import type { MessagePort } from "worker_threads";
import {
    createWorkerLogViewerBridge,
    handleLogViewerStatusMessage,
    WORKER_LOG_CHANNEL,
    LOG_VIEWER_STATUS_TYPE,
} from "../worker-log-viewer-bridge";

describe("createWorkerLogViewerBridge", () => {
    it("查看器未激活时不向 port 转发，只写 baseLogger", () => {
        const postMessage = vi.fn();
        const port = { postMessage } as unknown as MessagePort;
        const baseLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
        const { workerLog } = createWorkerLogViewerBridge({
            port,
            baseLogger,
            threadId: "test-thread",
        });
        workerLog("info", "cat", "hello");
        expect(baseLogger.info).toHaveBeenCalledWith("hello");
        expect(postMessage).not.toHaveBeenCalled();
    });

    it("查看器激活后 workerLog 经 postMessage 上报", () => {
        const postMessage = vi.fn();
        const port = { postMessage } as unknown as MessagePort;
        const baseLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
        const { workerLog, setLogViewerActive } = createWorkerLogViewerBridge({
            port,
            baseLogger,
            threadId: "test-thread",
        });
        setLogViewerActive(true);
        workerLog("warn", "c2", "w");
        expect(postMessage).toHaveBeenCalledTimes(1);
        const payload = postMessage.mock.calls[0][0] as {
            type: string;
            entry: { level: string; category: string; message: string; threadId: string };
        };
        expect(payload.type).toBe(WORKER_LOG_CHANNEL);
        expect(payload.entry.level).toBe("warn");
        expect(payload.entry.category).toBe("c2");
        expect(payload.entry.message).toBe("w");
        expect(payload.entry.threadId).toBe("test-thread");
    });

    it("createCategoryLogger 将四级日志路由到 workerLog", () => {
        const baseLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
        const { createCategoryLogger } = createWorkerLogViewerBridge({
            port: null,
            baseLogger,
            threadId: "x",
        });
        const w = createCategoryLogger("my-cat");
        w.error("e");
        expect(baseLogger.error).toHaveBeenCalledWith("e");
    });
});

describe("handleLogViewerStatusMessage", () => {
    it("合法状态消息返回 true 并切换转发开关", () => {
        const postMessage = vi.fn();
        const port = { postMessage } as unknown as MessagePort;
        const baseLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
        const bridge = createWorkerLogViewerBridge({
            port,
            baseLogger,
            threadId: "t",
        });
        expect(
            handleLogViewerStatusMessage(
                { type: LOG_VIEWER_STATUS_TYPE, active: true },
                bridge,
                "t",
            ),
        ).toBe(true);
        bridge.workerLog("error", "c", "e");
        expect(postMessage).toHaveBeenCalled();
    });

    it("非状态消息返回 false", () => {
        const bridge = createWorkerLogViewerBridge({
            port: null,
            baseLogger: {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            },
            threadId: "t",
        });
        expect(handleLogViewerStatusMessage({ type: "other" }, bridge, "t")).toBe(false);
    });
});
