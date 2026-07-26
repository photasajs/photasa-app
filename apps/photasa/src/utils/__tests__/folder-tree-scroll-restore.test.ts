import { describe, expect, it } from "vitest";
import {
    canAttemptScrollRestore,
    FOLDER_TREE_EMPTY_LENGTH,
    isFolderPresentInTree,
    shouldScrollOnFolderTreePopulated,
} from "../folder-tree-scroll-restore";

describe("folder-tree-scroll-restore", () => {
    describe("shouldScrollOnFolderTreePopulated", () => {
        it("returns true when tree goes from empty to populated with currentFolder", () => {
            expect(
                shouldScrollOnFolderTreePopulated(3, FOLDER_TREE_EMPTY_LENGTH, "/photos/deep"),
            ).toBe(true);
        });

        it("returns false when tree was already populated", () => {
            expect(shouldScrollOnFolderTreePopulated(4, 3, "/photos/deep")).toBe(false);
        });

        it("returns false when currentFolder is empty", () => {
            expect(shouldScrollOnFolderTreePopulated(2, FOLDER_TREE_EMPTY_LENGTH, "")).toBe(false);
        });
    });

    describe("canAttemptScrollRestore", () => {
        it("allows scroll before restore completes", () => {
            expect(canAttemptScrollRestore(false)).toBe(true);
        });

        it("blocks scroll after restore completes or user expanded tree", () => {
            expect(canAttemptScrollRestore(true)).toBe(false);
        });
    });

    describe("isFolderPresentInTree", () => {
        const tree = [
            {
                key: "/photos",
                title: "photos",
                children: [{ key: "/photos/vacation", title: "vacation", children: [] }],
            },
        ];

        it("finds nested folder by canonical path", () => {
            expect(isFolderPresentInTree("/photos/vacation", tree)).toBe(true);
        });

        it("returns false for unknown path", () => {
            expect(isFolderPresentInTree("/missing", tree)).toBe(false);
        });

        it("returns false for empty path", () => {
            expect(isFolderPresentInTree("", tree)).toBe(false);
        });
    });
});
