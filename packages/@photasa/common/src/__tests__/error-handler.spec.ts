import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    PhotasaError,
    FileSystemError,
    ConfigError,
    WorkerError,
    ValidationError,
    handleError,
    retryOperation,
    formatErrorForUI,
    isValidError,
    mapToPhotasaError,
} from "../error-handler";
import { PhotasaLogger } from "../logger";

describe("Error Handler", () => {
    const mockLogger: Partial<PhotasaLogger> = {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        fatal: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Custom Error Classes", () => {
        it("should create PhotasaError with correct properties", () => {
            const error = new PhotasaError("Test error", "TEST_ERROR", { foo: "bar" });
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(PhotasaError);
            expect(error.message).toBe("Test error");
            expect(error.code).toBe("TEST_ERROR");
            expect(error.details).toEqual({ foo: "bar" });
            expect(error.name).toBe("PhotasaError");
        });

        it("should create FileSystemError with correct properties", () => {
            const error = new FileSystemError("File not found", { path: "/test" });
            expect(error).toBeInstanceOf(PhotasaError);
            expect(error.code).toBe("FILE_SYSTEM_ERROR");
            expect(error.name).toBe("FileSystemError");
        });

        it("should create ConfigError with correct properties", () => {
            const error = new ConfigError("Invalid config", { config: {} });
            expect(error).toBeInstanceOf(PhotasaError);
            expect(error.code).toBe("CONFIG_ERROR");
            expect(error.name).toBe("ConfigError");
        });

        it("should create WorkerError with correct properties", () => {
            const error = new WorkerError("Worker failed", { workerId: 1 });
            expect(error).toBeInstanceOf(PhotasaError);
            expect(error.code).toBe("WORKER_ERROR");
            expect(error.name).toBe("WorkerError");
        });

        it("should create ValidationError with correct properties", () => {
            const error = new ValidationError("Invalid input", { field: "name" });
            expect(error).toBeInstanceOf(PhotasaError);
            expect(error.code).toBe("VALIDATION_ERROR");
            expect(error.name).toBe("ValidationError");
        });
    });

    describe("handleError", () => {
        it("should handle PhotasaError correctly", () => {
            const error = new PhotasaError("Test error", "TEST_ERROR");
            const result = handleError(error, mockLogger as PhotasaLogger, "TestContext");

            expect(result).toBe(error);
            expect(mockLogger.error).toHaveBeenCalledWith("[TestContext] Test error", {
                code: "TEST_ERROR",
                details: undefined,
            });
        });

        it("should handle standard Error correctly", () => {
            const error = new Error("Standard error");
            const result = handleError(error, mockLogger as PhotasaLogger);

            expect(result).toBeInstanceOf(PhotasaError);
            expect(result.code).toBe("UNKNOWN_ERROR");
            expect(mockLogger.error).toHaveBeenCalledWith("Standard error", expect.any(Object));
        });

        it("should handle unknown error types correctly", () => {
            const error = "String error";
            const result = handleError(error, mockLogger as PhotasaLogger);

            expect(result).toBeInstanceOf(PhotasaError);
            expect(result.message).toBe("An unknown error occurred");
            expect(result.code).toBe("UNKNOWN_ERROR");
        });
    });

    describe("retryOperation", () => {
        it("should succeed on first attempt", async () => {
            const operation = vi.fn().mockResolvedValue("success");
            const result = await retryOperation(operation, 3, 100, mockLogger as PhotasaLogger);

            expect(result).toBe("success");
            expect(operation).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it("should retry on failure and eventually succeed", async () => {
            const operation = vi
                .fn()
                .mockRejectedValueOnce(new Error("First failure"))
                .mockRejectedValueOnce(new Error("Second failure"))
                .mockResolvedValueOnce("success");

            const result = await retryOperation(operation, 3, 100, mockLogger as PhotasaLogger);

            expect(result).toBe("success");
            expect(operation).toHaveBeenCalledTimes(3);
            expect(mockLogger.warn).toHaveBeenCalledTimes(2);
        });

        it("should throw after max retries", async () => {
            const error = new Error("Persistent failure");
            const operation = vi.fn().mockRejectedValue(error);

            await expect(
                retryOperation(operation, 2, 100, mockLogger as PhotasaLogger),
            ).rejects.toThrow("Persistent failure");

            expect(operation).toHaveBeenCalledTimes(2);
            expect(mockLogger.warn).toHaveBeenCalledTimes(2);
        });
    });

    describe("formatErrorForUI", () => {
        it("should format PhotasaError correctly", () => {
            const error = new PhotasaError("Test error", "TEST_ERROR", { foo: "bar" });
            const formatted = formatErrorForUI(error);

            expect(formatted).toEqual({
                message: "Test error",
                code: "TEST_ERROR",
            });
        });
    });

    describe("isValidError", () => {
        it("should return true for PhotasaError", () => {
            const error = new PhotasaError("Test error", "TEST_ERROR");
            expect(isValidError(error)).toBe(true);
        });

        it("should return false for standard Error", () => {
            const error = new Error("Test error");
            expect(isValidError(error)).toBe(false);
        });

        it("should return false for non-Error objects", () => {
            expect(isValidError("string")).toBe(false);
            expect(isValidError({})).toBe(false);
            expect(isValidError(null)).toBe(false);
        });
    });

    describe("mapToPhotasaError", () => {
        it("should return PhotasaError as is", () => {
            const error = new PhotasaError("Test error", "TEST_ERROR");
            const result = mapToPhotasaError(error);
            expect(result).toBe(error);
        });

        it("should map ENOENT to FileSystemError", () => {
            const error = new Error("File not found");
            error.name = "ENOENT";
            const result = mapToPhotasaError(error);

            expect(result).toBeInstanceOf(FileSystemError);
            expect(result.code).toBe("FILE_SYSTEM_ERROR");
        });

        it("should map standard Error to PhotasaError", () => {
            const error = new Error("Test error");
            const result = mapToPhotasaError(error);

            expect(result).toBeInstanceOf(PhotasaError);
            expect(result.code).toBe("UNKNOWN_ERROR");
        });

        it("should handle unknown error types", () => {
            const result = mapToPhotasaError("string error");

            expect(result).toBeInstanceOf(PhotasaError);
            expect(result.message).toBe("An unknown error occurred");
            expect(result.code).toBe("UNKNOWN_ERROR");
        });
    });
});
