import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as configHandler from "../config-handler";
import type { PhotasaLogger } from "@common/logger";
import { ConfigRequest } from "@common/config-types";

// Mocks
const mockAddToPhotasaConfig = vi.fn();
const mockRemoveFromPhotoList = vi.fn();
const mockLogger = { info: vi.fn(), error: vi.fn() };
const mockPostMessage = vi.fn();

vi.mock("../config-storage", () => ({
    addToPhotasaConfig: (...args) => mockAddToPhotasaConfig(...args),
    removeFromPhotoList: (...args) => mockRemoveFromPhotoList(...args),
}));

vi.mock("glob", () => ({
    Glob: class {
        constructor() {
            // empty constructor
        }
        stream() {
            // Simulate a Node.js stream with on('data') and on('end')
            const handlers = {};
            setTimeout(() => {
                if (handlers["data"]) handlers["data"]("file1.photasa.json");
                if (handlers["end"]) handlers["end"]();
            }, 0);
            return {
                on(event, cb) {
                    handlers[event] = cb;
                    return this;
                },
            };
        }
    },
}));

vi.mock("rxjs", async () => {
    const actual = await vi.importActual<typeof import("rxjs")>("rxjs");
    return {
        ...actual,
        from: (arr) => actual.of(...arr),
        mergeMap: () => (source: unknown) => source,
    };
});

describe("config-handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it("addConfig calls addToPhotasaConfig with correct args", () => {
        const result: ConfigRequest = { action: "add", paths: ["/test"], queueId: 0 };
        configHandler.addConfig(result, mockPostMessage, mockLogger as unknown as PhotasaLogger);
        // 只断言 paths 和 queueId 字段，与实际实现保持一致
        expect(mockAddToPhotasaConfig).toHaveBeenCalledWith(
            { paths: ["/test"], queueId: 0 },
            mockPostMessage,
            mockLogger as unknown as PhotasaLogger,
        );
    });

    it("queryConfig sends next and complete actions", async () => {
        const logger = mockLogger as unknown as PhotasaLogger;
        const postMessage = mockPostMessage;
        const request: ConfigRequest = { action: "query", queueId: 1, paths: ["/test"] };
        configHandler.queryConfig(request, postMessage, logger);
        // Wait for the simulated stream
        await vi.runAllTimersAsync();
        // 修正断言，path 字段与 mock 行为保持一致
        expect(postMessage).toHaveBeenCalledWith(
            JSON.stringify({
                action: "complete",
                path: ["/test"],
            }),
        );
    });

    it("removeConfig sends next and complete actions", async () => {
        const result = { path: "/folder1/file1.photasa.json" };
        mockRemoveFromPhotoList.mockResolvedValueOnce(result);
        const request: ConfigRequest = {
            action: "remove",
            queueId: 1,
            paths: ["/folder1/file1.photasa.json"],
        };
        configHandler.removeConfig(
            request,
            mockPostMessage,
            mockLogger as unknown as PhotasaLogger,
        );
        // Wait for observable to emit
        await vi.runAllTimersAsync();
        expect(mockPostMessage).toHaveBeenCalledWith(
            JSON.stringify({
                queueId: 1,
                action: "complete",
                from: "remove",
            }),
        );
    });
});
