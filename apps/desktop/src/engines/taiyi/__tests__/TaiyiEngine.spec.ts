import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
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
});
