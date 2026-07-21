import { describe, expect, it } from "vitest";
import { resolveLocale, i18nUtils } from "../config";

describe("resolveLocale", () => {
    it("maps legacy short codes to full BCP47 locales", () => {
        expect(resolveLocale("zh")).toBe("zh-CN");
        expect(resolveLocale("en")).toBe("en-US");
        expect(resolveLocale("ja")).toBe("ja-JP");
    });

    it("normalizes case and underscore separators", () => {
        expect(resolveLocale("zh-cn")).toBe("zh-CN");
        expect(resolveLocale("en_us")).toBe("en-US");
    });

    it("falls back to default for unknown codes", () => {
        expect(resolveLocale("xx-YY")).toBe("zh-CN");
        expect(resolveLocale(undefined)).toBe("zh-CN");
    });
});

describe("i18nUtils.setLocale", () => {
    it("resolves short codes before applying locale", () => {
        i18nUtils.setLocale("zh");
        expect(i18nUtils.getCurrentLocale()).toBe("zh-CN");
    });
});
