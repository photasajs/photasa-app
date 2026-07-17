import { describe, expect, it } from "vitest";
import {
    shortenThumbnailName,
    toFileNameFromPath,
    toRelativeThumbnailPath,
    toThumbnailName,
} from "../photasa-path";

describe("photasa-path (Electron contract)", () => {
    it("toRelativeThumbnailPath matches config-core", () => {
        expect(toRelativeThumbnailPath("/album/vacation.jpg")).toBe(
            ".photasaoriginals/thumbnail-vacation.jpg.png",
        );
    });

    it("toThumbnailName keeps full source basename", () => {
        expect(toThumbnailName("holiday.heic")).toBe("thumbnail-holiday.heic.png");
    });

    it("shortenThumbnailName keeps .photasaoriginals prefix", () => {
        expect(
            shortenThumbnailName("/Volumes/pics/.photasaoriginals/thumbnail-a.jpg.png"),
        ).toBe(".photasaoriginals/thumbnail-a.jpg.png");
    });

    it("toFileNameFromPath strips directories", () => {
        expect(toFileNameFromPath("/a/b/c.jpg")).toBe("c.jpg");
    });
});
