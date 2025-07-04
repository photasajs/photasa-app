import { describe, it, expect } from "vitest";
import { normalizeThumbnailRequest } from "../api";

describe("normalizeThumbnailRequest", () => {
    it("should remove file:// prefix from path and thumbnail", () => {
        const input = {
            path: "file:///Users/test/image.jpg",
            thumbnail: "file:///Users/test/.picasaoriginals/image.jpg",
            width: 200,
            height: 200,
            preview: "",
        };
        const result = normalizeThumbnailRequest(input);
        expect(result.path).toBe("/Users/test/image.jpg");
        expect(result.thumbnail).toBe("/Users/test/.picasaoriginals/image.jpg");
    });

    it("should not change path without file:// prefix", () => {
        const input = {
            path: "/Users/test/image.jpg",
            thumbnail: "/Users/test/.picasaoriginals/image.jpg",
            width: 200,
            height: 200,
            preview: "",
        };
        const result = normalizeThumbnailRequest(input);
        expect(result.path).toBe("/Users/test/image.jpg");
        expect(result.thumbnail).toBe("/Users/test/.picasaoriginals/image.jpg");
    });

    it("should handle empty path and thumbnail", () => {
        const input = {
            path: "",
            thumbnail: "",
            width: 200,
            height: 200,
            preview: "",
        };
        const result = normalizeThumbnailRequest(input);
        expect(result.path).toBe("");
        expect(result.thumbnail).toBe("");
    });
});
