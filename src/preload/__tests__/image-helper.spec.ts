import { getImageType } from "../image-helper";
import path from "path";

const IMAGE_PATH = path.join(__dirname, "./photos/test.jpg");

describe("photo-import", () => {
    describe("getImageType", () => {
        it("should return image type", async () => {
            const result = await getImageType(IMAGE_PATH);
            expect(result).toMatchSnapshot();
        });
    });
});
