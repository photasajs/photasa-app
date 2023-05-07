import { buildThumbnailPath, toRelativeThumbnailPath, isHiddenFile } from "../utils";

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
});
