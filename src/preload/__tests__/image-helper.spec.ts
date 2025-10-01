import { describe, it, expect, vi } from "vitest";
import path from "path";

// Mock Electron API before importing image-helper
vi.mock("@electron-toolkit/preload", () => ({
    electron: {
        ipcRenderer: {
            invoke: vi.fn(),
        },
    },
}));

import { getImageType } from "../image-helper";

const IMAGE_PATH = path.join(__dirname, "./photos/test.jpg");

describe("photo-import", () => {
    describe("getImageType", () => {
        it("should return image type", async () => {
            const result = await getImageType(IMAGE_PATH);
            expect(result).toMatchSnapshot();
        });
    });
});
