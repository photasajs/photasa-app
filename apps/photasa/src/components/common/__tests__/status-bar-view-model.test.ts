import { describe, expect, it } from "vitest";
import { deriveStatusBarView } from "../status-bar-view-model";

describe("deriveStatusBarView", () => {
    it("maps empty and completed scan status to Ready", () => {
        expect(deriveStatusBarView({ type: "", status: "", currentTask: "" })).toEqual({
            kind: "ready",
        });
        expect(
            deriveStatusBarView({
                type: "scan",
                status: "complete",
                currentTask: "/library",
            }),
        ).toEqual({ kind: "ready" });
    });

    it("maps Rust scan progress data to current file and processed total", () => {
        expect(
            deriveStatusBarView({
                type: "scan",
                status: "progress",
                currentTask: "/library",
                data: {
                    currentFile: "/library/IMG_001.jpg",
                    processed: 3,
                    total: 10,
                },
            }),
        ).toEqual({
            kind: "progress",
            label: "/library/IMG_001.jpg",
            processed: 3,
            total: 10,
        });
    });

    it("accepts legacy progress payloads during migration", () => {
        expect(
            deriveStatusBarView({
                type: "scan",
                status: "progress",
                currentTask: "/library/legacy.jpg",
                data: { progress: 4 },
            }),
        ).toEqual({
            kind: "progress",
            label: "/library/legacy.jpg",
            processed: 4,
        });
    });

    it("maps errors and non-scan task status without inferring queue state", () => {
        expect(
            deriveStatusBarView({
                type: "scan",
                status: "error",
                currentTask: "/library",
                error: "disk unavailable",
            }),
        ).toEqual({ kind: "error", label: "disk unavailable" });
        expect(
            deriveStatusBarView({
                type: "app",
                status: "initializing",
                currentTask: "Photasa",
            }),
        ).toEqual({ kind: "task", label: "Photasa" });
    });
});
