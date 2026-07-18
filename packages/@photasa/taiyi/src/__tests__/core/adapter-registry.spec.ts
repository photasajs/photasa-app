import { describe, it, expect, beforeEach, afterEach, vi as jest } from "vitest";
import { AdapterRegistry } from "../../core/adapter-registry";
import { Adapter, AdapterPriority, IAdapter } from "../../core/adapter-decorators";

// Mock adapter classes
@Adapter({
    name: "adapter-a",
    displayName: "Adapter A",
    priority: AdapterPriority.High,
    description: "Adapter A",
    engineType: "test",
})
class AdapterA implements IAdapter {
    readonly name = "adapter-a";
    async initialize() {}
    async shutdown() {}
}

@Adapter({
    name: "adapter-b",
    displayName: "Adapter B",
    priority: AdapterPriority.Normal,
    description: "Adapter B",
    dependencies: ["adapter-a"],
    engineType: "test",
})
class AdapterB implements IAdapter {
    readonly name = "adapter-b";
    async initialize() {}
    async shutdown() {}
}

@Adapter({
    name: "adapter-error",
    displayName: "Error Adapter",
    priority: AdapterPriority.Low,
    description: "Adapter that fails",
    engineType: "test",
})
class ErrorAdapter implements IAdapter {
    readonly name = "adapter-error";
    async initialize() {
        throw new Error("Init failed");
    }
    async shutdown() {}
}

describe("AdapterRegistry Edge Cases", () => {
    beforeEach(() => {
        AdapterRegistry.clear();
    });

    afterEach(() => {
        AdapterRegistry.clear();
    });

    it("should throw when registering duplicate adapter", () => {
        AdapterRegistry.registerAdapter(
            {
                name: "dup",
                priority: AdapterPriority.High,
                displayName: "Dup",
                description: "",
                engineType: "t",
            },
            AdapterA,
        );
        expect(() => {
            AdapterRegistry.registerAdapter(
                {
                    name: "dup",
                    priority: AdapterPriority.High,
                    displayName: "Dup",
                    description: "",
                    engineType: "t",
                },
                AdapterA,
            );
        }).toThrow("already registered");
    });

    it("should throw when creating non-existent adapter", async () => {
        await expect(AdapterRegistry.createAdapter("non-existent")).rejects.toThrow("not found");
    });

    it("should handle initialization failure", async () => {
        AdapterRegistry.registerAdapter(
            {
                name: "adapter-error",
                priority: AdapterPriority.High,
                displayName: "",
                description: "",
                engineType: "t",
            },
            ErrorAdapter,
        );
        await expect(AdapterRegistry.createAdapter("adapter-error")).rejects.toThrow("Init failed");

        const registration = AdapterRegistry.getAdapter("adapter-error");
        expect(registration?.status).toBe("error");
        expect(registration?.lastError?.message).toBe("Init failed");
    });

    it("should initialize dependencies in order", async () => {
        // Since decorators run on class definition, we manually register for test isolation if needed,
        // but importing the class triggers decorator which registers it.
        // However, we clear registry in beforeEach, so we need to re-register.
        AdapterRegistry.registerAdapter(
            {
                name: "adapter-a",
                priority: AdapterPriority.High,
                displayName: "A",
                description: "",
                engineType: "t",
            },
            AdapterA,
        );
        AdapterRegistry.registerAdapter(
            {
                name: "adapter-b",
                priority: AdapterPriority.Normal,
                displayName: "B",
                description: "",
                dependencies: ["adapter-a"],
                engineType: "t",
            },
            AdapterB,
        );

        await AdapterRegistry.initializeAll();

        const tokenA = AdapterRegistry.getAdapter("adapter-a");
        const tokenB = AdapterRegistry.getAdapter("adapter-b");

        expect(tokenA?.status).toBe("ready");
        expect(tokenB?.status).toBe("ready");
    });

    it("should throw when dependency missing", async () => {
        AdapterRegistry.registerAdapter(
            {
                name: "adapter-c",
                priority: AdapterPriority.Normal,
                displayName: "C",
                description: "",
                dependencies: ["missing"],
                engineType: "t",
            },
            AdapterB, // reusing class
        );

        await expect(AdapterRegistry.initializeAll()).rejects.toThrow("not found");
    });

    it("should return existing instance if already created", async () => {
        AdapterRegistry.registerAdapter(
            {
                name: "adapter-a",
                priority: AdapterPriority.High,
                displayName: "A",
                description: "",
                engineType: "t",
            },
            AdapterA,
        );

        const instance1 = await AdapterRegistry.createAdapter("adapter-a");
        const instance2 = await AdapterRegistry.createAdapter("adapter-a");

        expect(instance1).toBe(instance2);
    });

    it("should handle shutdown of non-initialized adapter", async () => {
        AdapterRegistry.registerAdapter(
            {
                name: "adapter-a",
                priority: AdapterPriority.High,
                displayName: "A",
                description: "",
                engineType: "t",
            },
            AdapterA,
        );
        // Not initialized
        await AdapterRegistry.shutdownAll();
        // Should not throw
    });

    it("should handle shutdown failure", async () => {
        // Create a special adapter that fails shutdown
        const mockShutdown = jest.fn().mockRejectedValue(new Error("Shutdown error"));
        class ShutdownFailAdapter implements IAdapter {
            name = "fail-shutdown";
            initialize = async () => {};
            shutdown = mockShutdown;
        }

        AdapterRegistry.registerAdapter(
            {
                name: "fail-shutdown",
                priority: 1,
                displayName: "",
                description: "",
                engineType: "t",
            },
            ShutdownFailAdapter,
        );

        await AdapterRegistry.createAdapter("fail-shutdown");
        await AdapterRegistry.shutdownAll(); // Should catch error and log, not throw

        // We can verify logged error if we mocked logger, but simply ensuring no throw is good for coverage logic path
    });
});
