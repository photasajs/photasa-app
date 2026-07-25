import { describe, expect, it } from "vitest";
import {
    resolveScanStartedTreePath,
    shouldRefreshFolderConfigAfterFileScan,
} from "../scan-watch-sync";

describe("scan-watch-sync", () => {
    describe("resolveScanStartedTreePath", () => {
        it("uses parent directory for file watch scans", () => {
            expect(
                resolveScanStartedTreePath("/photos/vacation/new.jpg", "file", "/photos/vacation"),
            ).toBe("/photos/vacation");
        });

        it("keeps directory path for folder scans", () => {
            expect(resolveScanStartedTreePath("/photos/vacation", "directory", null)).toBe(
                "/photos/vacation",
            );
        });
    });

    describe("shouldRefreshFolderConfigAfterFileScan", () => {
        it("returns true when current folder matches parent", () => {
            expect(
                shouldRefreshFolderConfigAfterFileScan("/photos/vacation", "/photos/vacation"),
            ).toBe(true);
        });

        it("returns false when viewing a different folder", () => {
            expect(
                shouldRefreshFolderConfigAfterFileScan("/photos/other", "/photos/vacation"),
            ).toBe(false);
        });
    });
});
