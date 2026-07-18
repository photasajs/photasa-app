import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    toAbsoluteMediaPath,
    toFileUrlFromAbsolutePath,
    toWebviewMediaUrl,
    ensureWebviewMediaUrl,
    webviewMediaUrlToAbsolutePath,
    parseAssetWebviewUrl,
    absoluteThumbnailPathForSource,
} from "../media-url";

vi.mock("@tauri-apps/api/core", () => ({
    convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
    isTauri: vi.fn(() => false),
}));

describe("toAbsoluteMediaPath", () => {
    it("joins folder and relative thumbnail path", () => {
        expect(
            toAbsoluteMediaPath(
                "/Volumes/SUCAI/Test/Luigi's Mension",
                ".photasaoriginals/thumbnail-a.jpg.png",
            ),
        ).toBe("/Volumes/SUCAI/Test/Luigi's Mension/.photasaoriginals/thumbnail-a.jpg.png");
    });
});

describe("toFileUrlFromAbsolutePath", () => {
    it("encodes special path segments for file protocol", () => {
        const url = toFileUrlFromAbsolutePath("/root/特殊@#$.png");
        expect(url).toBe("file:///root/%E7%89%B9%E6%AE%8A%40%23%24.png");
    });
});

describe("parseAssetWebviewUrl", () => {
    it("decodes asset://localhost URLs from convertFileSrc", () => {
        const path = "/Volumes/SUCAI/Test/Luigi's Mension/a.jpg";
        const url = `asset://localhost/${encodeURIComponent(path)}`;
        expect(parseAssetWebviewUrl(url)).toBe(path);
    });

    it("decodes https://asset.localhost URLs", () => {
        const path = "/Volumes/SUCAI/a.jpg";
        const url = `https://asset.localhost/${encodeURIComponent(path)}`;
        expect(parseAssetWebviewUrl(url)).toBe(path);
    });
});

describe("webviewMediaUrlToAbsolutePath", () => {
    it("decodes asset.localhost URLs", () => {
        const path = webviewMediaUrlToAbsolutePath(
            `asset://localhost/${encodeURIComponent("/Volumes/SUCAI/Test/Luigi's Mension/a.jpg")}`,
        );
        expect(path).toBe("/Volumes/SUCAI/Test/Luigi's Mension/a.jpg");
    });
});

describe("absoluteThumbnailPathForSource", () => {
    it("builds thumbnail path under .photasaoriginals", () => {
        expect(absoluteThumbnailPathForSource("/album/vacation.jpg")).toBe(
            "/album/.photasaoriginals/thumbnail-vacation.jpg.png",
        );
    });
});

describe("toWebviewMediaUrl", () => {
    beforeEach(() => {
        vi.stubGlobal("window", {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("uses file protocol when not in Tauri runtime", async () => {
        const { isTauri } = await import("@tauri-apps/api/core");
        vi.mocked(isTauri).mockReturnValue(false);

        const url = toWebviewMediaUrl("/root/abc.jpg");
        expect(url).toBe("file:///root/abc.jpg");
    });

    it("uses convertFileSrc when running inside Tauri", async () => {
        const { isTauri, convertFileSrc } = await import("@tauri-apps/api/core");
        vi.mocked(isTauri).mockReturnValue(true);

        const path = "/Volumes/SUCAI/Test/Luigi's Mension/a.jpg";
        const url = toWebviewMediaUrl(path);

        expect(convertFileSrc).toHaveBeenCalledWith(path);
        expect(url).toBe(`asset://localhost/${encodeURIComponent(path)}`);
    });
});

describe("ensureWebviewMediaUrl", () => {
    beforeEach(() => {
        vi.stubGlobal("window", {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("converts legacy file:// to asset URL in Tauri", async () => {
        const { isTauri } = await import("@tauri-apps/api/core");
        vi.mocked(isTauri).mockReturnValue(true);

        const path = "/Volumes/SUCAI/a.jpg";
        const url = ensureWebviewMediaUrl(`file://${path}`);
        expect(url).toBe(`asset://localhost/${encodeURIComponent(path)}`);
    });
});
