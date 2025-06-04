import { describe, it, expect, vi, beforeEach } from "vitest";
import * as configHandler from "../config-handler";

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
        constructor() {}
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
    const actual = await vi.importActual<any>("rxjs");
    return {
        ...actual,
        from: (arr) => actual.of(...arr),
        mergeMap: (fn) => (source) => source,
    };
});

describe("config-handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("addConfig calls addToPhotasaConfig with correct args", () => {
        const result = { foo: "bar" };
        configHandler.addConfig(result, mockPostMessage, mockLogger as any);
        expect(mockAddToPhotasaConfig).toHaveBeenCalledWith(
            result,
            mockPostMessage,
            mockLogger as any,
        );
    });

    it("queryConfig sends next and complete actions", async () => {
        const paths = ["/folder1"];
        const logger = mockLogger as any;
        const postMessage = mockPostMessage;
        configHandler.queryConfig({ paths }, postMessage, logger);
        // Wait for the simulated stream
        await new Promise((r) => setTimeout(r, 10));
        expect(postMessage).toHaveBeenCalledWith(
            JSON.stringify({
                action: "complete",
                path: ["/folder1"],
            }),
        );
    });

    it("removeConfig sends next and complete actions", async () => {
        const result = { path: "/folder1/file1.photasa.json" };
        mockRemoveFromPhotoList.mockResolvedValueOnce(result);
        const request = { queueId: 1, paths: ["/folder1/file1.photasa.json"] };
        configHandler.removeConfig(request, mockPostMessage, mockLogger as any);
        // Wait for observable to emit
        await new Promise((r) => setTimeout(r, 10));
        expect(mockPostMessage).toHaveBeenCalledWith(
            JSON.stringify({
                queueId: 1,
                action: "complete",
                from: "remove",
            }),
        );
    });
});
