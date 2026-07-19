import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    timeout,
    nextFrame,
    cancellableTimeout,
    cancellableNextFrame,
    waitForAny,
    waitForAll,
} from "../async-utils";

describe("async-utils", () => {
    let originalRAF: unknown;
    let originalCancelRAF: unknown;

    beforeEach(() => {
        vi.useFakeTimers();
        originalRAF = global.requestAnimationFrame;
        originalCancelRAF = global.cancelAnimationFrame;

        vi.stubGlobal("requestAnimationFrame", (cb: (time: number) => void) => {
            // Use setTimeout to simulate next frame with a small delay
            return setTimeout(() => cb(Date.now()), 16) as unknown as number;
        });
        vi.stubGlobal("cancelAnimationFrame", (id: number) => {
            clearTimeout(id);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        // Restore manual stub if vitest unstubAllGlobals is not enough or behavior differs
        // But unstubAllGlobals should work.
    });

    describe("timeout", () => {
        it("should wait for specified delay", async () => {
            const promise = timeout(1000, "result");
            vi.advanceTimersByTime(1000);
            const result = await promise;
            expect(result).toBe("result");
        });
    });

    describe("nextFrame", () => {
        it("should wait for next frame", async () => {
            const promise = nextFrame("result");
            vi.advanceTimersByTime(16);
            const result = await promise;
            expect(result).toBe("result");
        });
    });

    describe("cancellableTimeout", () => {
        it("should resolve if not cancelled", async () => {
            const { promise } = cancellableTimeout(1000, "result");
            vi.advanceTimersByTime(1000);
            await expect(promise).resolves.toBe("result");
        });

        it("should not resolve if cancelled", async () => {
            const { promise, cancel } = cancellableTimeout(1000, "result");
            const spy = vi.fn();
            promise.then(spy);
            cancel();
            vi.advanceTimersByTime(1000);
            expect(spy).not.toHaveBeenCalled();
        });
        it("should allow calling cancel multiple times", () => {
            const { cancel } = cancellableTimeout(1000, "result");
            cancel();
            expect(() => cancel()).not.toThrow();
        });
    });

    describe("cancellableNextFrame", () => {
        it("should resolve if not cancelled", async () => {
            const { promise } = cancellableNextFrame("result");
            vi.advanceTimersByTime(16);
            await expect(promise).resolves.toBe("result");
        });

        it("should not resolve if cancelled", async () => {
            const { promise, cancel } = cancellableNextFrame("result");
            const spy = vi.fn();
            promise.then(spy);
            cancel();
            vi.advanceTimersByTime(16);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe("waitForAny", () => {
        it("should resolve when one condition is met", async () => {
            let flag1 = false;
            let flag2 = false;
            const promise = waitForAny([() => flag1, () => flag2], 1000);

            flag2 = true;
            vi.advanceTimersByTime(16);
            await expect(promise).resolves.toBe(true);
        });

        it("should reject on timeout", async () => {
            const promise = waitForAny([() => false], 100);
            vi.advanceTimersByTime(200);
            await expect(promise).rejects.toThrow("timeout");
        });
    });

    describe("waitForAll", () => {
        it("should resolve when all conditions are met", async () => {
            let flag1 = false;
            let flag2 = false;
            const promise = waitForAll([() => flag1, () => flag2], 1000);

            flag1 = true;
            vi.advanceTimersByTime(16);
            // Should not resolve yet

            flag2 = true;
            vi.advanceTimersByTime(16);
            await expect(promise).resolves.toBe(true);
        });

        it("should reject on timeout", async () => {
            const promise = waitForAll([() => false], 100);
            vi.advanceTimersByTime(200);
            await expect(promise).rejects.toThrow("timeout");
        });
    });
});
