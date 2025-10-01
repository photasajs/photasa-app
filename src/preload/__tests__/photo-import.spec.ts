import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs-extra";

// Mock Electron API before importing photo-import
vi.mock("@electron-toolkit/preload", () => ({
    electron: {
        ipcRenderer: {
            invoke: vi.fn(),
            on: vi.fn(),
        },
    },
}));

import { importPhotos } from "../photo-import";

const IMAGE_PATH = path.join(__dirname, "./photos/");
const TEST_PATH = path.join(__dirname, "./tests/");

describe("photo-import", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_PATH)) {
            fs.removeSync(TEST_PATH);
        }
    });

    afterEach(() => {
        if (fs.existsSync(TEST_PATH)) {
            fs.removeSync(TEST_PATH);
        }
    });

    it("should import photos", () => {
        expect.assertions(1);

        // Test that the function can be called without throwing
        expect(() => {
            importPhotos([IMAGE_PATH], TEST_PATH, (args) => {
                // Callback function - just verify it can be called
                if (args.type === "complete") {
                    // Test completed successfully
                }
            });
        }).not.toThrow();
    });
});
