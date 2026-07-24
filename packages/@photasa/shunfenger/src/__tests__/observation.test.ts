import { describe, it, expect } from "vitest";
import { createObservationFromChokidar, isMediaFile } from "../observation";

describe("observation helpers", () => {
    it("detects media files by extension", () => {
        expect(isMediaFile("/photos/sample.jpg")).toBe(true);
        expect(isMediaFile("/photos/readme.txt")).toBe(false);
    });

    it("creates normalized observations from chokidar events", () => {
        const observation = createObservationFromChokidar(
            "add",
            "/photos/sample.jpg",
            false,
            "profile-1",
        );

        expect(observation.path).toBe("/photos/sample.jpg");
        expect(observation.kind).toBe("add");
        expect(observation.isDirectory).toBe(false);
        expect(observation.isMediaFile).toBe(true);
        expect(observation.profileId).toBe("profile-1");
        expect(observation.id).toBeTruthy();
    });
});
