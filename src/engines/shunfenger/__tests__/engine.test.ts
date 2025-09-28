import { describe, it, expect, vi, beforeEach } from "vitest";
import { createShunfengerEngine, type ShunfengerEngine } from "../index";
import type { WatchProfile, FileObservation } from "../types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createProfile(overrides: Partial<WatchProfile> = {}): WatchProfile {
    const now = Date.now();
    return {
        id: overrides.id ?? "profile-1",
        rootPath: overrides.rootPath ?? "/photos",
        recursive: overrides.recursive ?? true,
        ignoreGlobs: overrides.ignoreGlobs ?? [],
        thumbnailSize: overrides.thumbnailSize ?? 150,
        autoStart: overrides.autoStart ?? true,
        priority: overrides.priority ?? "background",
        createdAt: overrides.createdAt ?? now,
        updatedAt: overrides.updatedAt ?? now,
    };
}

function createObservation(overrides: Partial<FileObservation> = {}): FileObservation {
    const now = Date.now();
    return {
        id: overrides.id ?? `obs-${now}`,
        path: overrides.path ?? "/photos/sample.jpg",
        kind: overrides.kind ?? "add",
        isDirectory: overrides.isDirectory ?? false,
        isMediaFile: overrides.isMediaFile ?? true,
        detectedAt: overrides.detectedAt ?? now,
        profileId: overrides.profileId ?? "profile-1",
        metadata: overrides.metadata,
    };
}

describe("ShunfengerEngine", () => {
    let engine: ShunfengerEngine;

    beforeEach(() => {
        engine = createShunfengerEngine({ storageRoot: ".vitest/shunfenger" });
    });

    it("emits ready status after initialization", async () => {
        const listener = vi.fn();
        engine.onEvent(listener);
        await engine.initialize();

        await wait(20);

        const statusEvents = listener.mock.calls
            .map((call) => call[0])
            .filter((event) => event.type === "status");
        expect(statusEvents.length).toBeGreaterThan(0);
        expect(statusEvents.some((event) => event.state === "ready")).toBe(true);
    });

    it("dispatches command when observation processed", async () => {
        const dispatcher = vi.fn();
        engine.setCommandDispatcher(dispatcher);
        const profile = createProfile();
        await engine.initialize();
        await engine.configure(profile);

        const observation = createObservation();
        (engine as any).handleObservation(observation);

        expect(dispatcher).toHaveBeenCalledTimes(1);
        const command = dispatcher.mock.calls[0][0];
        expect(command.profileId).toBe(profile.id);
    });

    it("manages profiles lifecycle", async () => {
        const profile = createProfile({ id: "profile-test" });
        await engine.initialize();
        await engine.configure(profile);
        expect(engine.listProfiles().some((p) => p.id === "profile-test")).toBe(true);

        await engine.removeProfile("profile-test");
        expect(engine.listProfiles().some((p) => p.id === "profile-test")).toBe(false);
    });
});
