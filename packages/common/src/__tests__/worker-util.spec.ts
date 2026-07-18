import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    sendWorkerTask,
    onWorkerResponse,
    createResponse,
    createProgressEvent,
    createPreviewProgressEvent,
    onPreviewProgressEvent,
    type Worker,
} from "../worker-util";

describe("worker-util", () => {
    // Mock worker
    const mockWorker = {
        postMessage: vi.fn(),
        on: vi.fn(),
        terminate: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("sendWorkerTask", () => {
        it("should send message to worker and return promise", async () => {
            const promise = sendWorkerTask(mockWorker, "test-action", { data: 1 });

            expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);
            const message = mockWorker.postMessage.mock.calls[0][0];
            expect(message).toHaveProperty("id");
            expect(message.action).toBe("test-action");
            expect(message.payload).toEqual({ data: 1 });

            // Simulate response
            onWorkerResponse({
                id: message.id,
                result: "success",
            });

            await expect(promise).resolves.toBe("success");
        });

        it("should reject on error response", async () => {
            const promise = sendWorkerTask(mockWorker, "test-action", {});
            const message = mockWorker.postMessage.mock.calls[0][0];

            onWorkerResponse({
                id: message.id,
                error: "some error",
            });

            await expect(promise).rejects.toThrow("some error");
        });

        it("should handle progress updates", async () => {
            const onProgress = vi.fn();
            const promise = sendWorkerTask(mockWorker, "test-action", {}, onProgress);
            const message = mockWorker.postMessage.mock.calls[0][0];

            // Trigger progress via onPreviewProgressEvent as it shares the callback map?
            // Wait, worker-util exports onPreviewProgressEvent which looks up progressCallbacks.
            // But sendWorkerTask is generic.
            // Let's check implementation.
            // progressCallbacks is used by onPreviewProgressEvent (line 65).
            // So if we key it by taskId (which is message.id), we can trigger it.

            onPreviewProgressEvent({
                type: "preview_progress",
                taskId: message.id,
                data: 50,
            });

            expect(onProgress).toHaveBeenCalledWith(50);

            // Finish task
            onWorkerResponse({ id: message.id, result: "done" });
            await promise;
        });
    });

    describe("helper functions", () => {
        it("createResponse should format object", () => {
            const msg = { id: "123", action: "test", payload: null };
            const resp = createResponse(msg, "result");
            expect(resp).toEqual({ id: "123", result: "result" });
        });

        it("createProgressEvent should format object", () => {
            const data = {
                processedFiles: 1,
                totalFiles: 10,
                successfulFiles: 1,
                skippedFiles: 0,
                errorFiles: 0,
                currentFile: "test.jpg",
                speed: 100,
                estimatedTimeRemaining: 10,
            };
            const event = createProgressEvent("task-1", data);
            expect(event).toEqual({
                type: "progress",
                taskId: "task-1",
                data,
            });
        });

        it("createPreviewProgressEvent should format object", () => {
            const data = { progress: 0.5 };
            const event = createPreviewProgressEvent("task-1", data);
            expect(event).toEqual({
                type: "preview_progress",
                taskId: "task-1",
                data,
            });
        });
    });
});
