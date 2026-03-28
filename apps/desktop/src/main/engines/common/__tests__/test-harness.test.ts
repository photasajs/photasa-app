import { describe, expect, it } from "vitest";

import { createInMemoryTaskQueue, createMockClock, createMockEventBus } from "../test-harness";

describe("createMockEventBus", () => {
    it("should publish events and notify subscribers", () => {
        const clock = createMockClock(1_000);
        const bus = createMockEventBus<{ type: string; payload: string; timestamp?: number }>(
            clock.now,
        );
        const received: string[] = [];
        const unsubscribe = bus.subscribe((event) => {
            received.push(`${event.type}:${event.payload}`);
        });

        bus.publish({ type: "watcher", payload: "ready" });
        expect(received).toEqual(["watcher:ready"]);
        expect(bus.snapshot()).toHaveLength(1);

        unsubscribe();
        bus.publish({ type: "scan", payload: "queued" });
        expect(received).toEqual(["watcher:ready"]);
        expect(bus.snapshot()).toHaveLength(2);
    });
});

describe("createInMemoryTaskQueue", () => {
    it("should enqueue, dequeue and drain tasks", () => {
        const queue = createInMemoryTaskQueue<string>();
        queue.enqueue("task-1");
        queue.enqueue("task-2");

        expect(queue.snapshot().pending).toHaveLength(2);
        expect(queue.dequeue()).toBe("task-1");
        expect(queue.snapshot().pending).toEqual(["task-2"]);

        queue.enqueue("task-3");
        expect(queue.drain()).toEqual(["task-2", "task-3"]);
        expect(queue.snapshot().size).toBe(0);
    });
});

describe("createMockClock", () => {
    it("should advance deterministically", () => {
        const clock = createMockClock(500);
        expect(clock.now()).toBe(500);
        expect(clock.tick(250)).toBe(750);
        expect(clock.now()).toBe(750);
    });
});
