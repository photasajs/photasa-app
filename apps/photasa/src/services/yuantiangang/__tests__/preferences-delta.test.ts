import { describe, it, expect } from "vitest";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import { buildPreferencesDelta } from "../preferences-delta";

describe("buildPreferencesDelta", () => {
    it("THEME_CHANGE → ui.theme", () => {
        expect(buildPreferencesDelta(ZOUZHE_MATTERS.THEME_CHANGE, { themeId: "dark" })).toEqual({
            ui: { theme: "dark" },
        });
    });

    it("LANGUAGE_CHANGE → ui.language", () => {
        expect(buildPreferencesDelta(ZOUZHE_MATTERS.LANGUAGE_CHANGE, { locale: "en-US" })).toEqual({
            ui: { language: "en-US" },
        });
    });

    it("THUMBNAIL_SIZE_CHANGE → display.thumbnailSize", () => {
        expect(buildPreferencesDelta(ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE, { size: 200 })).toEqual({
            display: { thumbnailSize: 200 },
        });
    });

    it("ADD_PATH 透传房玄龄 delta 并剥离 path 协调字段", () => {
        const delta = { scanning: { paths: ["/a", "/b"] } };
        expect(buildPreferencesDelta(ZOUZHE_MATTERS.ADD_PATH, { ...delta, path: "/b" })).toEqual(
            delta,
        );
    });
});
