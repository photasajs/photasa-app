import { isImage, getImageType } from "../image-helper";
import path from "path";
const IMAGE_PATH = path.join(__dirname, "./photos/test.jpg");

describe("photo-import", () => {
    describe("getImageType", () => {
        it("should return image type", async () => {
            const result = await getImageType(IMAGE_PATH);
            expect(result).toEqual({
                ext: "jpg",
                mime: "image/jpeg",
            });
        });
    });
    describe("isImage", () => {
        it("should return true if file is image", async () => {
            const result = await isImage(IMAGE_PATH);
            expect(result).toBe(true);
        });
    });
});
