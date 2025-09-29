import { describe, expect, it } from "vitest";

import {
    SAMPLE_CONFIG_MANIFEST,
    SAMPLE_FOLDER_MANIFEST,
    SAMPLE_MEDIA_WORK_REQUEST,
    SAMPLE_PREFERENCE_SNAPSHOT,
    SAMPLE_SCAN_POLICY,
    SAMPLE_SCAN_TASK,
    SAMPLE_WATCH_PROFILE,
} from "../fixtures";
import {
    assertValidFileObservation,
    assertValidFolderManifest,
    type ConfigManifest,
    type FileObservation,
    type FolderManifest,
    type MediaWorkRequest,
    type PreferenceSnapshot,
    type ScanPolicy,
    type ScanTask,
} from "../contracts";

const noopObservation: FileObservation = {
    id: "ob-1",
    path: `${SAMPLE_WATCH_PROFILE.rootPath}/albums/sample.jpg`,
    kind: "add",
    isDirectory: false,
    isMediaFile: true,
    detectedAt: Date.now(),
    sourceProfileId: SAMPLE_WATCH_PROFILE.id,
    profileRevision: SAMPLE_SCAN_TASK.profileRevision,
};

describe("engine contract fixtures", () => {
    it("should satisfy ConfigManifest shape", () => {
        const manifest: ConfigManifest = SAMPLE_CONFIG_MANIFEST;
        expect(manifest.profiles).toHaveLength(1);
        expect(manifest.profiles[0].rootPath).toBe(SAMPLE_WATCH_PROFILE.rootPath);
        expect(manifest.scanPolicy.id).toBe(SAMPLE_SCAN_POLICY.id);
    });

    it("should satisfy FolderManifest shape", () => {
        const manifest: FolderManifest = SAMPLE_FOLDER_MANIFEST;
        expect(manifest.mediaIndex.every((item) => !item.relativePath.startsWith("/"))).toBe(true);
        expect(manifest.profileRevision).toBe(SAMPLE_SCAN_TASK.profileRevision);
        assertValidFolderManifest(manifest);
    });

    it("should satisfy ScanTask shape", () => {
        const task: ScanTask = SAMPLE_SCAN_TASK;
        expect(task.id).toMatch(/^task-/);
        expect(task.profileId).toBe(SAMPLE_WATCH_PROFILE.id);
    });

    it("should satisfy MediaWorkRequest shape", () => {
        const request: MediaWorkRequest = SAMPLE_MEDIA_WORK_REQUEST;
        expect(request.sourcePath).toContain(SAMPLE_WATCH_PROFILE.rootPath);
        expect(request.outputKind).toBe("thumbnail");
    });

    it("should satisfy PreferenceSnapshot shape", () => {
        const snapshot: PreferenceSnapshot = SAMPLE_PREFERENCE_SNAPSHOT;
        expect(snapshot.scanningFolders).toContain(SAMPLE_WATCH_PROFILE.rootPath);
        expect(snapshot.dirty).toBe(false);
    });

    it("should satisfy ScanPolicy shape", () => {
        const policy: ScanPolicy = SAMPLE_SCAN_POLICY;
        expect(policy.queue.maxParallel).toBeGreaterThan(0);
        expect(policy.smartRefresh.thumbnailTtlMs).toBeGreaterThan(
            policy.smartRefresh.mtimeToleranceMs,
        );
    });

    it("should validate FileObservation helper", () => {
        expect(() => assertValidFileObservation(noopObservation)).not.toThrow();
    });
});
