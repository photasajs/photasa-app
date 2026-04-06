import { describe, it, expect } from "vitest";
import { isPhotasaMediaFile } from "../media-file-guard";

describe("isPhotasaMediaFile", () => {
    it("常见图片与视频扩展名视为媒体", () => {
        expect(isPhotasaMediaFile("/album/photo.JPG")).toBe(true);
        expect(isPhotasaMediaFile("/v/clips/test.mov")).toBe(true);
    });

    it("非媒体扩展名返回 false", () => {
        expect(isPhotasaMediaFile("/docs/readme.txt")).toBe(false);
        expect(isPhotasaMediaFile("/bin/app")).toBe(false);
    });
});
