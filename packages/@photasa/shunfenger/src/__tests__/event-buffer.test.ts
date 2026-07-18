import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBuffer } from "../event-buffer";
import type { FileObservation } from "../types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createObservation(overrides: Partial<FileObservation> = {}): FileObservation {
    const now = Date.now();
    return {
        id: overrides.id ?? `observation-${now}`,
        path: overrides.path ?? "/photos/sample.jpg",
        kind: overrides.kind ?? "add",
        isDirectory: overrides.isDirectory ?? false,
        isMediaFile: overrides.isMediaFile ?? true,
        detectedAt: overrides.detectedAt ?? now,
        profileId: overrides.profileId ?? "profile-1",
        metadata: overrides.metadata,
    };
}

describe("EventBuffer", () => {
    const debounceMs = 10;
    let buffer: EventBuffer;

    beforeEach(() => {
        buffer = new EventBuffer({ debounceMs, maxBatchSize: 100 });
    });

    it("flushes observations after debounce", async () => {
        const listener = vi.fn();
        buffer.setListener(listener);

        const observation = createObservation();
        buffer.enqueue(observation);

        await wait(debounceMs * 2);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(observation);
    });

    it("deduplicates by kind and path, keeping latest event", async () => {
        const listener = vi.fn();
        buffer.setListener(listener);

        const first = createObservation({ id: "first" });
        const second = createObservation({ id: "second" });
        buffer.enqueue(first);
        buffer.enqueue(second);

        await wait(debounceMs * 2);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(second);
    });

    it("force flush emits pending events immediately", async () => {
        const listener = vi.fn();
        buffer.setListener(listener);
        const observation = createObservation();

        buffer.enqueue(observation);
        buffer.forceFlush();

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("clear removes pending events and cancels timer", async () => {
        const listener = vi.fn();
        buffer.setListener(listener);

        buffer.enqueue(createObservation());
        buffer.clear();

        await wait(debounceMs * 2);

        expect(listener).not.toHaveBeenCalled();
    });
});
