import { describe, it, expect, beforeEach, vi } from "vitest";
import { fileExistSync } from "../file-helper";
import { vol } from "memfs";

// Mock fs-extra to use memfs
vi.mock("fs-extra", async () => {
    const memfs = await vi.importActual("memfs");
    const fs = (memfs as any).fs;
    
    // Return both default and named exports to cover all use cases
    return {
        default: fs,
        ...fs,
    };
});

vi.mock("fs", async () => {
    const memfs = await vi.importActual("memfs");
    return (memfs as any).fs;
});

vi.mock("fs/promises", async () => {
    const memfs = await vi.importActual("memfs");
    return (memfs as any).fs.promises;
});

describe("file-helper", () => {
    beforeEach(() => {
        vol.reset();
    });
    describe("fileExistSync", () => {
        it("should return false if file didn't exist", () => {
            const result = fileExistSync("test");
            expect(result).toBe(false);
        });

        it("should return true if file exists", () => {
            const fileName = "/test.txt";

            // Create file in memfs
            vol.fromJSON({ [fileName]: "test content" });

            const result = fileExistSync(fileName, { root: "/" });
            expect(result).toBe(true);
        });

        it("should return true if file exists when option is empty", () => {
            const fileName = "/test.txt";

            // Create file in memfs
            vol.fromJSON({ [fileName]: "test content" });

            const result = fileExistSync(fileName);
            expect(result).toBe(true);
        });
    });
});
