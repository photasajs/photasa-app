import { describe, it, expect, vi, beforeEach } from "vitest";

// Define mock interface
interface MockPipeline {
    on: any;
    emit: any;
    destroy: any;
    listenerCount: any;
    dataHandler?: any;
    errorHandler?: any;
    endHandler?: any;
}

// Mock stream-chain and stream-json BEFORE imports
const mockPipeline: MockPipeline = {
    on: vi.fn(),
    emit: vi.fn(),
    destroy: vi.fn(),
    listenerCount: vi.fn(() => 0),
};

vi.mock("stream-chain", () => ({
    chain: vi.fn(() => mockPipeline),
}));

vi.mock("stream-json", () => ({ parser: vi.fn() }));

// Mock Assembler
const mockConsume = vi.fn();
vi.mock("stream-json/Assembler", () => {
    return {
        default: class MockAssembler {
            get current(): any {
                if (this._shouldThrowGetter) throw new Error("Getter error");
                if (this._isNullCurrent) return null;
                return this._current;
            }
            set current(val) {
                this._current = val;
            }
            _current = { version: "1.0", photoList: [] };
            _shouldThrowGetter = false;
            _isNullCurrent = false;

            consume(chunk: any) {
                if (chunk === "_THROW_") {
                    throw new Error("Consume error");
                }
                if (chunk === "_THROW_GETTER_") {
                    this._shouldThrowGetter = true;
                }
                if (chunk === "_NULL_CURRENT_") {
                    this._isNullCurrent = true;
                }
                mockConsume(chunk);
            }
        },
    };
});

// Mock FS
vi.mock("fs", () => ({
    createReadStream: vi.fn(() => "mockStream"),
    promises: {
        access: vi.fn(),
    },
}));

import { StreamManifestReader } from "../StreamManifestReader";
import { promises as fsp } from "fs";

describe("StreamManifestReader", () => {
    let reader: StreamManifestReader;
    let mockLogger: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset pipeline mock methods
        mockPipeline.on.mockImplementation((event: string, handler: any) => {
            if (event === "data") mockPipeline.dataHandler = handler;
            if (event === "error") mockPipeline.errorHandler = handler;
            if (event === "end") mockPipeline.endHandler = handler;
            return mockPipeline;
        });
        mockPipeline.emit.mockImplementation((event: string, payload: any) => {
            if (event === "data" && mockPipeline.dataHandler) mockPipeline.dataHandler(payload);
            if (event === "error" && mockPipeline.errorHandler) mockPipeline.errorHandler(payload);
            if (event === "end" && mockPipeline.endHandler) mockPipeline.endHandler();
            return true;
        });
        mockPipeline.listenerCount.mockImplementation((event: string) => {
            if (event === "data" && mockPipeline.dataHandler) return 1;
            return 0;
        });
        mockPipeline.dataHandler = undefined;
        mockPipeline.errorHandler = undefined;
        mockPipeline.endHandler = undefined;

        mockLogger = {
            warn: vi.fn(),
            error: vi.fn(),
        };

        reader = new StreamManifestReader(mockLogger);
    });

    it("should return empty manifest if file access fails", async () => {
        (fsp.access as any).mockRejectedValue(new Error("ENOENT"));
        const result = await reader.read("/missing/file", mockLogger);
        expect(result.version).toBe("1.0");
        expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should resolve with manifest on successful stream", async () => {
        (fsp.access as any).mockResolvedValue(undefined);

        const promise = reader.read("/valid/file", mockLogger);

        await new Promise((resolve) => setTimeout(resolve, 0));

        mockPipeline.emit("data", "chunk");
        mockPipeline.emit("end");

        const result = await promise;
        expect(result).toHaveProperty("version", "1.0");
    });

    it("should reject on pipeline error", async () => {
        (fsp.access as any).mockResolvedValue(undefined);
        const promise = reader.read("/error/file", mockLogger);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const error = new Error("Stream error");
        mockPipeline.emit("error", error);

        await expect(promise).rejects.toThrow("Stream error");
        expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle error during processing (consume)", async () => {
        (fsp.access as any).mockResolvedValue(undefined);
        const _promise = reader.read("/file", mockLogger);
        await new Promise((resolve) => setTimeout(resolve, 0));

        mockPipeline.emit("data", "_THROW_");

        expect(mockPipeline.destroy).toHaveBeenCalledWith(expect.any(Error));
        // Consume error doesn't reject promise automatically in this mock setup unless we bubble it.
        // Implementation: pipeline.destroy(error) -> pipeline emits 'error' -> listener rejects.
        // We verify destroy is called.
    });

    it("should handle error during normalization", async () => {
        (fsp.access as any).mockResolvedValue(undefined);
        const promise = reader.read("/file", mockLogger);

        await new Promise((resolve) => setTimeout(resolve, 0));

        mockPipeline.emit("data", "_THROW_GETTER_");
        mockPipeline.emit("end");

        await expect(promise).rejects.toThrow("Getter error");
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining("failed to normalize config"),
            expect.any(Error),
        );
    });

    it("should use internal logger if none provided (or handle undefined)", async () => {
        const readerNoLogger = new StreamManifestReader();
        (fsp.access as any).mockResolvedValue(undefined);

        // We can't spy on undefined logger, but we can verify it doesn't crash
        const promise = readerNoLogger.read("/valid/file");
        await new Promise((resolve) => setTimeout(resolve, 0));
        mockPipeline.emit("end");

        await expect(promise).resolves.toHaveProperty("version", "1.0");
    });

    it("should handle null assembler current", async () => {
        (fsp.access as any).mockResolvedValue(undefined);
        const promise = reader.read("/file", mockLogger);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Trigger null current
        mockPipeline.emit("data", "_NULL_CURRENT_");
        mockPipeline.emit("end");

        const result = await promise;
        expect(result.version).toBe("1.0"); // from normalizeConfigManifest({})
    });
});
