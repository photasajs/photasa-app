import path from "path";
import {
    PHOTASA_ORIGINALS,
    HeicExtensionRE,
    buildThumbnailPath,
    toRelativeThumbnailPath,
    toPreviewPath,
    ratioStringToParts,
    getOptimalThumbnailResolution,
    isHiddenFile,
    shouldIgnorePhotasaPath,
    isFileUnderFolder,
    toFileName,
    toThumbnailName,
    shortenThumbnailName,
} from "../utils";

describe("utils", () => {
    describe("buildThumbnailPath", () => {
        it("should build correct thumbnail path", () => {
            const photoPath = "/path/to/photo.jpg";
            const expected = path.join("/path/to", PHOTASA_ORIGINALS, "thumbnail-photo.jpg.png");
            expect(buildThumbnailPath(photoPath)).toBe(expected);
        });

        it("should handle paths with spaces", () => {
            const photoPath = "/path/to/my photo.jpg";
            const expected = path.join("/path/to", PHOTASA_ORIGINALS, "thumbnail-my photo.jpg.png");
            expect(buildThumbnailPath(photoPath)).toBe(expected);
        });

        it("should build thumbnail path from source", () => {
            expect(buildThumbnailPath("/User/some/good/pic.jepg")).toMatchSnapshot();
        });
    });

    describe("toRelativeThumbnailPath", () => {
        it("should return correct relative thumbnail path", () => {
            const photoPath = "/path/to/photo.jpg";
            const expected = path.join(PHOTASA_ORIGINALS, "thumbnail-photo.jpg.png");
            expect(toRelativeThumbnailPath(photoPath)).toBe(expected);
        });

        it("should build thumbnail path from source", () => {
            expect(toRelativeThumbnailPath("/User/some/good/pic.jepg")).toMatchSnapshot();
        });
    });

    describe("toPreviewPath", () => {
        it("should convert path to preview path", () => {
            const target = "/path/to/photo.jpg";
            const expected = path.join("/path/to", PHOTASA_ORIGINALS, "photo.jpeg");
            expect(toPreviewPath(target)).toBe(expected);
        });

        it("should handle paths with different extensions", () => {
            const target = "/path/to/photo.png";
            const expected = path.join("/path/to", PHOTASA_ORIGINALS, "photo.jpeg");
            expect(toPreviewPath(target)).toBe(expected);
        });

        it("should return preview path", () => {
            expect(toPreviewPath("/book/sime.jpg")).toBe("/book/.photasaoriginals/sime.jpeg");
        });
    });

    describe("ratioStringToParts", () => {
        it("should convert ratio string to array of numbers", () => {
            expect(ratioStringToParts("16:9")).toEqual([16, 9]);
            expect(ratioStringToParts("4:3")).toEqual([4, 3]);
        });

        it("should handle single number ratios", () => {
            expect(ratioStringToParts("1:1")).toEqual([1, 1]);
        });

        it("should return ratio parts", () => {
            expect(ratioStringToParts("3:2")).toEqual([3, 2]);
        });
    });

    describe("getOptimalThumbnailResolution", () => {
        it("should maintain aspect ratio for landscape images", () => {
            const videoDimension = { width: 1920, height: 1080 };
            const target = { width: 320, height: 240 };
            const result = getOptimalThumbnailResolution(videoDimension, target);
            expect(result.width).toBe(320);
            expect(result.height).toBe(180); // 320 * (1080/1920)
        });

        it("should maintain aspect ratio for portrait images", () => {
            const videoDimension = { width: 1080, height: 1920 };
            const target = { width: 320, height: 240 };
            const result = getOptimalThumbnailResolution(videoDimension, target);
            expect(result.width).toBe(135); // 240 * (1080/1920)
            expect(result.height).toBe(240);
        });

        it("should return optimal resolution for landscape", () => {
            expect(
                getOptimalThumbnailResolution(
                    {
                        width: 400,
                        height: 300,
                    },
                    {
                        width: 200,
                        height: 300,
                    },
                ),
            ).toStrictEqual({ height: 150, width: 200 });
        });

        it("should return optimal resolution for portrait", () => {
            expect(
                getOptimalThumbnailResolution(
                    {
                        width: 400,
                        height: 800,
                    },
                    {
                        width: 200,
                        height: 300,
                    },
                ),
            ).toStrictEqual({ height: 300, width: 150 });
        });
    });

    describe("isHiddenFile", () => {
        it("should detect hidden files", () => {
            expect(isHiddenFile(".hidden")).toBe(true);
            expect(isHiddenFile(".DS_Store")).toBe(true);
            expect(isHiddenFile(".book")).toBe(true);
        });

        it("should not detect non-hidden files", () => {
            expect(isHiddenFile("normal.txt")).toBe(false);
            expect(isHiddenFile("photo.jpg")).toBe(false);
        });
    });

    describe("shouldIgnorePhotasaPath", () => {
        it("should ignore photasa original paths", () => {
            expect(shouldIgnorePhotasaPath("/path/to/.photasaoriginals/file.jpg")).toBe(true);
            expect(shouldIgnorePhotasaPath("/path/to/.picasaoriginals/file.jpg")).toBe(true);
            expect(shouldIgnorePhotasaPath("/path/to/.photasaoriginal/file.jpg")).toBe(true);
            expect(shouldIgnorePhotasaPath("/path/to/.picasaoriginal/file.jpg")).toBe(true);
            expect(shouldIgnorePhotasaPath("/path/to/.AppleDouble/file.jpg")).toBe(true);
        });

        it("should not ignore normal paths", () => {
            expect(shouldIgnorePhotasaPath("/path/to/normal/file.jpg")).toBe(false);
            expect(shouldIgnorePhotasaPath("/path/to/photo.jpg")).toBe(false);
        });

        [".picasaoriginals", ".photasaoriginal", ".picasaoriginal", ".AppleDouble"].forEach(
            (path) => {
                it(`should return true if path is ${path}`, () => {
                    expect(shouldIgnorePhotasaPath(path)).toBe(true);
                });
            },
        );

        it("should return true if path contains photasa path", () => {
            expect(shouldIgnorePhotasaPath(".photasaoriginals/images")).toBe(true);
        });
    });

    describe("isFileUnderFolder", () => {
        it("should detect files under specified folder", () => {
            expect(isFileUnderFolder("/path/to/folder/file.jpg", "/path/to/folder")).toBe(true);
            expect(isFileUnderFolder("/book/sime.jpg", "/book")).toBe(true);
        });

        it("should not detect files in different folders", () => {
            expect(isFileUnderFolder("/path/to/other/file.jpg", "/path/to/folder")).toBe(false);
        });
    });

    describe("toFileName", () => {
        it("should extract file name with extension", () => {
            expect(toFileName("/path/to/file.jpg")).toBe("file.jpg");
            expect(toFileName("file.jpg")).toBe("file.jpg");
            expect(toFileName("/book/sime.jpg")).toBe("sime.jpg");
        });
    });

    describe("toThumbnailName", () => {
        it("should convert file name to thumbnail name", () => {
            const fileName = "photo.jpg";
            const expected = path.join(PHOTASA_ORIGINALS, "photo.jpg.png");
            expect(toThumbnailName(fileName)).toBe(expected);
        });

        it("should return thumbnail name", () => {
            expect(toThumbnailName("/book/sime.jpg")).toBe(".photasaoriginals/sime.jpg.png");
        });
    });

    describe("shortenThumbnailName", () => {
        it("should shorten absolute thumbnail path to relative path", () => {
            const absolutePath = "/path/to/.photasaoriginals/thumbnail.jpg";
            const expected = path.join(PHOTASA_ORIGINALS, "thumbnail.jpg");
            expect(shortenThumbnailName(absolutePath)).toBe(expected);
        });

        it("should shorten thumbnail name", () => {
            expect(shortenThumbnailName("/book/.photasaoriginals/sime.jpg.png")).toBe(
                ".photasaoriginals/sime.jpg.png",
            );
        });
    });

    describe("HeicExtensionRE", () => {
        it("should match HEIC file extensions", () => {
            expect(HeicExtensionRE.test("photo.heic")).toBe(true);
            expect(HeicExtensionRE.test("photo.HEIC")).toBe(true);
        });

        it("should not match non-HEIC extensions", () => {
            expect(HeicExtensionRE.test("photo.jpg")).toBe(false);
            expect(HeicExtensionRE.test("photo.png")).toBe(false);
        });
    });
});
