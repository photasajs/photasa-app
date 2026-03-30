import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WatchProfile, FileObservation } from "../types";
import { CommandAdapter } from "../command-adapter";

function createProfile(overrides: Partial<WatchProfile> = {}): WatchProfile {
    return {
        id: overrides.id ?? "profile-1",
        rootPath: overrides.rootPath ?? "/photos",
        recursive: overrides.recursive ?? true,
        ignoreGlobs: overrides.ignoreGlobs ?? [],
        thumbnailSize: overrides.thumbnailSize ?? 150,
        autoStart: overrides.autoStart ?? true,
        priority: overrides.priority ?? "background",
        createdAt: overrides.createdAt ?? Date.now(),
        updatedAt: overrides.updatedAt ?? Date.now(),
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

describe("CommandAdapter", () => {
    let adapter: CommandAdapter;
    const dispatcher = vi.fn();
    const profile = createProfile();

    beforeEach(() => {
        adapter = new CommandAdapter({ defaultPriority: "background" });
        adapter.setDispatcher(dispatcher);
        dispatcher.mockReset();
    });

    it("creates scan command for directory observation", () => {
        const observation = createObservation({ isDirectory: true, kind: "addDir" });

        adapter.handleObservation(observation, profile);

        expect(dispatcher).toHaveBeenCalledTimes(1);
        const command = dispatcher.mock.calls[0][0];
        expect(command.type).toBe("scan-command");
        expect(command.payload.action.path).toBe(observation.path);
        expect(command.payload.action.operationType).toBe("directory");
        expect(command.payload.source).toBe("watch");
        expect(command.payload.action.fileOperationId).toBe(observation.id);
    });

    it("creates file operation command for file observation", () => {
        const observation = createObservation({ kind: "change", isDirectory: false });

        adapter.handleObservation(observation, profile);

        expect(dispatcher).toHaveBeenCalledTimes(1);
        const command = dispatcher.mock.calls[0][0];
        expect(command.type).toBe("file-operation");
        expect(command.payload.operation.type).toBe("change");
        expect(command.payload.operation.metadata?.thumbnailSize).toBe(profile.thumbnailSize);
        expect(command.payload.operation.id).toBe(observation.id);
    });

    it("maps delete events correctly", () => {
        const observation = createObservation({ kind: "delete", isDirectory: false });
        adapter.handleObservation(observation, profile);

        const command = dispatcher.mock.calls[0][0];
        expect(command.payload.operation.type).toBe("delete");
    });

    it("respects profile priority", () => {
        const userProfile = createProfile({ priority: "user" });
        const observation = createObservation();

        adapter.handleObservation(observation, userProfile);

        const command = dispatcher.mock.calls[0][0];
        if (command.type === "file-operation") {
            expect(command.payload.operation.priority).toBe(0);
        }
    });

    it("does nothing when dispatcher not set", () => {
        adapter = new CommandAdapter({ defaultPriority: "background" });
        const observation = createObservation();

        adapter.handleObservation(observation, profile);

        expect(dispatcher).not.toHaveBeenCalled();
    });
});
