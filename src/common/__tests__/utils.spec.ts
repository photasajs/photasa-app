import {
    buildThumbnailPath,
    toRelativeThumbnailPath,
    isHiddenFile,
    toPreviewPath,
    ratioStringToParts,
    getOptimalThumbnailResolution,
    shouldIgnorePhotasaPath,
    isFileUnderFolder,
    toFileName,
    toThumbnailName,
    shortenThumbnailName,
} from "../utils";

describe("utils", () => {
    describe("buildThumbnailPath", () => {
        it("should build thumbnail path from source", () => {
            expect(buildThumbnailPath("/User/some/good/pic.jepg")).toMatchSnapshot();
        });
    });

    describe("toRelativeThumbnailPath", () => {
        it("should build thumbnail path from source", () => {
            expect(toRelativeThumbnailPath("/User/some/good/pic.jepg")).toMatchSnapshot();
        });
    });

    describe("isHiddenFile", () => {
        it("should return true if kind of hidden file", () => {
            expect(isHiddenFile(".book")).toBeTruthy();
        });
    });

    describe("toPreviewPath", () => {
        it("should return preview path", () => {
            expect(toPreviewPath("/book/sime.jpg")).toBe("/book/.photasaoriginals/sime.jpeg");
        });
    });

    describe("ratioStringToParts", () => {
        it("should return ratio parts", () => {
            expect(ratioStringToParts("3:2")).toEqual([3, 2]);
        });
    });

    describe("getOptimalThumbnailResolution", () => {
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
    describe("shouldIgnorePhotasaPath", () => {
        [".picasaoriginals", ".photasaoriginal", ".picasaoriginal", ".AppleDouble"].forEach(
            (path) => {
                it(`should return true if path is ${path}`, () => {
                    expect(shouldIgnorePhotasaPath(path)).toBeTruthy();
                });
            },
        );

        it("should return true if path contains photasa path", () => {
            expect(shouldIgnorePhotasaPath(".photasaoriginals/images")).toBeTruthy();
        });
    });

    describe("isFileUnderFolder", () => {
        it("should return true if file is under folder", () => {
            expect(isFileUnderFolder("/book/sime.jpg", "/book")).toBeTruthy();
        });
    });

    describe("toFileName", () => {
        it("should return file name", () => {
            expect(toFileName("/book/sime.jpg")).toBe("sime.jpg");
        });
    });

    describe("toThumbnailName", () => {
        it("should return thumbnail name", () => {
            expect(toThumbnailName("/book/sime.jpg")).toBe(".photasaoriginals/sime.jpg.png");
        });
    });

    describe("shortenThumbnailName", () => {
        it("should shorten thumbnail name", () => {
            expect(shortenThumbnailName("/book/.photasaoriginals/sime.jpg.png")).toBe(
                ".photasaoriginals/sime.jpg.png",
            );
        });
    });
});
