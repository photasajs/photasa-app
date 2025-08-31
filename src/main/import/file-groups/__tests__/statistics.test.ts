import { describe, it, expect } from "vitest";
import type { FileGroup, FileInfo } from "@common/import-types";

const createFileInfo = (name: string, size = 1024): FileInfo =>
    ({
        path: `/test/${name}`,
        name,
        size,
        type: "image",
        dateSource: "exif",
        mtime: new Date(),
    }) as unknown as FileInfo;

const createFileGroup = (_mainFileName: string, fileNames: string[]): FileGroup => {
    const files = fileNames.map((name) => createFileInfo(name));
    return {
        mainFile: files[0],
        files,
        type: files.length > 1 ? "group" : "single",
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
    };
};

describe("File Groups Statistics", () => {
    it("should handle basic file group statistics", () => {
        const groups: FileGroup[] = [
            createFileGroup("IMG_1234.JPG", ["IMG_1234.JPG", "IMG_1234.CR2"]),
            createFileGroup("DSC_5678.NEF", ["DSC_5678.NEF"]),
        ];

        expect(groups).toHaveLength(2);
        expect(groups[0].type).toBe("group");
        expect(groups[1].type).toBe("single");
    });

    it("should calculate total sizes correctly", () => {
        const groups: FileGroup[] = [
            createFileGroup("test1.jpg", ["test1.jpg"]),
            createFileGroup("test2.cr2", ["test2.cr2", "test2.jpg"]),
        ];

        expect(groups[0].totalSize).toBe(1024);
        expect(groups[1].totalSize).toBe(2048);
    });

    it("should handle empty groups array", () => {
        const groups: FileGroup[] = [];
        expect(groups).toHaveLength(0);
    });

    it("should categorize file types", () => {
        const groups: FileGroup[] = [
            createFileGroup("IMG_1.JPG", ["IMG_1.JPG", "IMG_1.CR2", "IMG_1.XMP"]),
            createFileGroup("video_001.MP4", ["video_001.MP4"]),
            createFileGroup("doc_001.txt", ["doc_001.txt"]),
        ];

        expect(groups[0].files).toHaveLength(3);
        expect(groups[1].files).toHaveLength(1);
        expect(groups[2].files).toHaveLength(1);
    });

    it("should preserve file group structure", () => {
        const groups: FileGroup[] = [createFileGroup("test.jpg", ["test.jpg", "test.raw"])];

        const group = groups[0];
        expect(group).toHaveProperty("mainFile");
        expect(group).toHaveProperty("files");
        expect(group).toHaveProperty("type");
        expect(group).toHaveProperty("totalSize");
        expect(group.mainFile.name).toBe("test.jpg");
    });
});
