import { addToPhotoList, getPhotasaConfig } from "../file-config";
import { vol } from "memfs";

jest.mock("fs");
jest.mock("fs/promises");

describe("addToPhotoList", () => {
    beforeEach(() => {
        vol.reset();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should add photo to .photasa.json", async () => {
        const photoPath = "/test/test/test.jpg";
        vol.fromJSON({
            [photoPath]: "1",
        });

        const result = await addToPhotoList(photoPath);

        expect(result.config.photoList.length).toBe(1);
        expect(result.config.photoList[0].path).toBe(photoPath);
    });

    it("shouldn't add photo to .photasa.json", async () => {
        const photoPath = "/test/test/test.jpg";
        const configPath = "/test/test/.photasa.json";
        vol.fromJSON({
            [photoPath]: "1",
            [configPath]: JSON.stringify({ photoList: [{ path: photoPath }] }),
        });

        const config = await getPhotasaConfig("/test/test/");

        expect(config.photoList.length).toBe(1);
        expect(config.photoList[0].path).toBe(photoPath);

        const result2 = await addToPhotoList(photoPath);
        expect(result2.config.photoList.length).toBe(1);
        expect(result2.config.photoList[0].path).toBe(photoPath);
    });

    it("should add more photos to .photasa.json", async () => {
        const photoPath = "/test/test/test.jpg";
        const photoPath1 = "/test/test/test1.jpg";

        const configPath = "/test/test/.photasa.json";
        vol.fromJSON({
            [photoPath]: "1",
            [configPath]: JSON.stringify({ photoList: [{ path: photoPath }] }),
        });

        let result2 = await addToPhotoList(photoPath);
        expect(result2.config.photoList.length).toBe(1);
        expect(result2.config.photoList[0].path).toBe(photoPath);

        result2 = await addToPhotoList(photoPath1);
        expect(result2.config.photoList.length).toBe(2);
        expect(result2.config.photoList[1].path).toBe(photoPath1);
    });
});
