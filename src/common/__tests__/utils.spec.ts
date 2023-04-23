import { buildThumbnailPath, toRelativeThumbnailPath } from "../utils";

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
});
