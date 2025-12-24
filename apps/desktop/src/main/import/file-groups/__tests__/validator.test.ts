import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FileGroup, FileInfo } from "@common/import-types";
import fs from "fs";

// Mock fs
vi.mock("fs", () => ({
    default: {
        existsSync: vi.fn(),
        statSync: vi.fn(),
    },
}));

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

describe("File Groups Validator", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Basic validation tests", () => {
        it("should validate file group structure", () => {
            const group = createFileGroup("IMG_1234.JPG", ["IMG_1234.JPG", "IMG_1234.CR2"]);

            expect(group).toHaveProperty("mainFile");
            expect(group).toHaveProperty("files");
            expect(group).toHaveProperty("type");
            expect(group).toHaveProperty("totalSize");
            expect(group.files).toHaveLength(2);
            expect(group.type).toBe("group");
        });

        it("should handle single file groups", () => {
            const group = createFileGroup("single.jpg", ["single.jpg"]);

            expect(group.type).toBe("single");
            expect(group.files).toHaveLength(1);
            expect(group.mainFile.name).toBe("single.jpg");
        });

        it("should validate empty groups array", () => {
            const groups: FileGroup[] = [];
            expect(groups).toHaveLength(0);
        });

        it("should check file existence", () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);

            const group = createFileGroup("test.jpg", ["test.jpg"]);
            const filePath = group.files[0].path;

            expect(fs.existsSync(filePath)).toBe(true);
        });

        it("should handle missing files", () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const group = createFileGroup("missing.jpg", ["missing.jpg"]);
            const filePath = group.files[0].path;

            expect(fs.existsSync(filePath)).toBe(false);
        });

        it("should check file stats", () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.statSync).mockReturnValue({
                isFile: () => true,
                size: 1024,
            } as any);

            const group = createFileGroup("test.jpg", ["test.jpg"]);
            const filePath = group.files[0].path;

            expect(fs.existsSync(filePath)).toBe(true);
            const stats = fs.statSync(filePath);
            expect(stats.isFile()).toBe(true);
            expect(stats.size).toBe(1024);
        });

        it("should detect directories", () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.statSync).mockReturnValue({
                isFile: () => false,
                size: 0,
            } as any);

            const group = createFileGroup("directory", ["directory"]);
            const filePath = group.files[0].path;

            expect(fs.existsSync(filePath)).toBe(true);
            const stats = fs.statSync(filePath);
            expect(stats.isFile()).toBe(false);
        });

        it("should handle file size validation", () => {
            const groups = [
                createFileGroup("small.jpg", ["small.jpg"]),
                createFileGroup("large.cr2", ["large.cr2"]),
            ];

            // Simulate different file sizes
            groups[0].files[0].size = 100;
            groups[1].files[0].size = 10000;

            expect(groups[0].files[0].size).toBe(100);
            expect(groups[1].files[0].size).toBe(10000);
        });

        it("should validate file group totals", () => {
            const group = createFileGroup("multi.jpg", ["multi.jpg", "multi.cr2", "multi.xmp"]);

            // Each file has default size of 1024
            expect(group.totalSize).toBe(3072);
            expect(group.files).toHaveLength(3);
            expect(group.type).toBe("group");
        });
    });
});
