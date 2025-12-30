import { describe, it, expect, beforeEach, afterEach, vi as jest } from "vitest";
import { TaiyiEngine } from "../core/TaiyiEngine";
import { AdapterRegistry } from "../core/adapter-registry";
import { Adapter, AdapterPriority, IAdapter } from "../core/adapter-decorators";

// Mock adapter for testing
@Adapter({
    name: "test-adapter",
    displayName: "Test Adapter",
    priority: AdapterPriority.Normal,
    description: "Test adapter for unit tests",
    engineType: "test",
})
class TestAdapter implements IAdapter {
    readonly name = "test-adapter";

    async initialize(): Promise<void> {
        // Mock initialization
    }

    async shutdown(): Promise<void> {
        // Mock shutdown
    }

    async testMethod(arg: string): Promise<string> {
        return `test-result-${arg}`;
    }
}

describe("TaiyiEngine", () => {
    let engine: TaiyiEngine;

    beforeEach(() => {
        // Clear registry before each test
        AdapterRegistry.clear();
        engine = new TaiyiEngine();
    });

    afterEach(async () => {
        if (engine) {
            await engine.shutdown();
        }
        AdapterRegistry.clear();
    });

    describe("initialization", () => {
        it("should initialize successfully", async () => {
            await expect(engine.initialize()).resolves.not.toThrow();
        });

        it("should emit initialized event", async () => {
            const initSpy = jest.fn();
            engine.on("initialized", initSpy);

            await engine.initialize();

            expect(initSpy).toHaveBeenCalled();
        });
    });

    describe("adapter management", () => {
        beforeEach(async () => {
            // Manually register the test adapter since decorators may not execute in test environment
            AdapterRegistry.registerAdapter(
                {
                    name: "test-adapter",
                    displayName: "Test Adapter",
                    priority: AdapterPriority.Normal,
                    description: "Test adapter for unit tests",
                    engineType: "test",
                },
                TestAdapter,
            );

            // Initialize the engine
            await engine.initialize();
        });

        it("should call adapter methods successfully", async () => {
            const result = await engine.callEngine("test-adapter", "testMethod", "hello");

            expect(result.success).toBe(true);
            expect(result.result).toBe("test-result-hello");
            expect(result.engineName).toBe("test-adapter");
        });

        it("should handle non-existent engine calls", async () => {
            const result = await engine.callEngine("non-existent", "testMethod", "hello");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain("not found");
        });

        it("should handle non-existent method calls", async () => {
            const result = await engine.callEngine("test-adapter", "nonExistentMethod", "hello");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain("not found");
        });

        it("should report engine status correctly", () => {
            const status = engine.getEngineStatus("test-adapter");
            expect(status).toBe("ready");
        });

        it("should report all engine statuses", () => {
            const allStatus = engine.getAllEngineStatus();
            expect(allStatus).toHaveProperty("test-adapter");
            expect(allStatus["test-adapter"]).toBe("ready");
        });

        it("should check if engine is ready", () => {
            expect(engine.isEngineReady("test-adapter")).toBe(true);
            expect(engine.isEngineReady("non-existent")).toBe(false);
        });

        it("should list available engines", () => {
            const available = engine.getAvailableEngines();
            expect(available).toContain("test-adapter");
        });
    });

    describe("shutdown", () => {
        it("should shutdown gracefully", async () => {
            await engine.initialize();
            await expect(engine.shutdown()).resolves.not.toThrow();
        });

        it("should emit shutdown event", async () => {
            await engine.initialize();

            const shutdownSpy = jest.fn();
            engine.on("shutdown", shutdownSpy);

            await engine.shutdown();

            expect(shutdownSpy).toHaveBeenCalled();
        });
    });

    describe("health check", () => {
        it("should start and stop health check", async () => {
            jest.useFakeTimers();
            const healthEngine = new TaiyiEngine({
                enableHealthCheck: true,
                healthCheckInterval: 1000,
            });

            const healthSpy = jest.fn();
            healthEngine.on("healthCheck", healthSpy);

            // Need to mock AdapterRegistry.getAllEngineStatus?
            // TaiyiEngine uses AdapterRegistry.getAllEngineStatus()
            // So we should register an adapter first
            AdapterRegistry.registerAdapter(
                { name: "test", priority: 1, displayName: "", description: "", engineType: "t" },
                TestAdapter,
            );

            await healthEngine.initialize();

            jest.advanceTimersByTime(1100);
            expect(healthSpy).toHaveBeenCalled();

            healthEngine.shutdown();
            jest.useRealTimers();
        });

        it("should emit failure event if engine error", async () => {
            jest.useFakeTimers();
            const healthEngine = new TaiyiEngine({
                enableHealthCheck: true,
                healthCheckInterval: 1000,
            });

            const failureSpy = jest.fn();
            healthEngine.on("engineFailure", failureSpy);

            // Mock getEngineStatus return error
            // We can cheat by directly setting status in registry if accessible, or mock the method
            // Since getAllEngineStatus calls AdapterRegistry, let's mock AdapterRegistry.getRegisteredAdapters
            // But AdapterRegistry is a static class.
            // We can register an adapter that we can manipulate?
            // Or better, just spy on getAllEngineStatus of the engine itself
            const statusSpy = jest.spyOn(healthEngine, "getAllEngineStatus").mockReturnValue({
                "failed-engine": "error",
            });

            await healthEngine.initialize();
            jest.advanceTimersByTime(1100);

            expect(failureSpy).toHaveBeenCalledWith(["failed-engine"]);

            healthEngine.shutdown();
            jest.useRealTimers();
        });
    });

    describe("idempotency and errors", () => {
        it("should not initialize twice", async () => {
            await engine.initialize();
            const emitSpy = jest.spyOn(engine, "emit");
            await engine.initialize();
            expect(emitSpy).not.toHaveBeenCalledWith("initialized");
        });

        it("should not shutdown if not initialized", async () => {
            const emitSpy = jest.spyOn(engine, "emit");
            await engine.shutdown();
            expect(emitSpy).not.toHaveBeenCalledWith("shutdown");
        });

        it("should handle initialization error", async () => {
            const errorMock = new Error("Init fail");
            // Mock AdapterRegistry.initializeAll to throw
            jest.spyOn(AdapterRegistry, "initializeAll").mockRejectedValueOnce(errorMock);

            await expect(engine.initialize()).rejects.toThrow("Init fail");
        });

        it("should handle shutdown error", async () => {
            await engine.initialize();
            const errorMock = new Error("Shutdown fail");
            // Mock AdapterRegistry.shutdownAll to throw
            jest.spyOn(AdapterRegistry, "shutdownAll").mockRejectedValueOnce(errorMock);

            await expect(engine.shutdown()).rejects.toThrow("Shutdown fail");
        });
    });
});
