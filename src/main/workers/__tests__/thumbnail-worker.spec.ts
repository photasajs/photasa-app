import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

// Mock dependencies
vi.mock("sharp", () => ({
    default: vi.fn().mockImplementation(() => ({
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toFile: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock("fs-extra", () => ({
    default: {
        ensureDir: vi.fn().mockResolvedValue(undefined),
    },
}));

// Mock parentPort
const mockParentPort = {
    on: vi.fn(),
    postMessage: vi.fn(),
};

vi.mock("worker_threads", () => ({
    parentPort: mockParentPort,
}));

// Import the worker after mocks are set up
import "../thumbnail-worker";

describe("thumbnail-worker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should process thumbnail request successfully", async () => {
        const request = {
            file: "/path/to/image.jpg",
            size: 200,
            quality: 80,
        };

        // Simulate message from main thread
        const messageHandler = mockParentPort.on.mock.calls[0][1];
        await messageHandler(JSON.stringify(request));

        // Verify sharp was called with correct parameters
        expect(sharp).toHaveBeenCalledWith(request.file);
        expect(sharp().resize).toHaveBeenCalledWith(request.size, request.size, {
            fit: "inside",
            withoutEnlargement: true,
        });
        expect(sharp().jpeg).toHaveBeenCalledWith({
            quality: request.quality,
            progressive: true,
        });

        // Verify response was sent back
        expect(mockParentPort.postMessage).toHaveBeenCalledWith(
            JSON.stringify({
                success: true,
                file: request.file,
            }),
        );
    });

    it("should handle processing errors", async () => {
        const request = {
            file: "/path/to/image.jpg",
            size: 200,
        };

        // Mock sharp to throw an error
        (sharp().toFile as any).mockRejectedValue(new Error("Processing failed"));

        // Simulate message from main thread
        const messageHandler = mockParentPort.on.mock.calls[0][1];
        await messageHandler(JSON.stringify(request));

        // Verify error response was sent back
        expect(mockParentPort.postMessage).toHaveBeenCalledWith(
            JSON.stringify({
                success: false,
                file: request.file,
                error: "Processing failed",
            }),
        );
    });

    it("should use default quality if not specified", async () => {
        const request = {
            file: "/path/to/image.jpg",
            size: 200,
        };

        // Simulate message from main thread
        const messageHandler = mockParentPort.on.mock.calls[0][1];
        await messageHandler(JSON.stringify(request));

        // Verify default quality was used
        expect(sharp().jpeg).toHaveBeenCalledWith({
            quality: 80,
            progressive: true,
        });
    });
});
