import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readSource(relativePath: string): string {
    return readFileSync(join(packageRoot, relativePath), "utf8");
}

describe("RFC 0154 Phase 2a scan domain", () => {
    it("removes dead scan-folder compatibility task", () => {
        expect(existsSync(join(packageRoot, "src/utils/scan-folder.ts"))).toBe(false);
    });

    it("reads scan idle state from YuChiGong", () => {
        const appSource = readSource("src/App.vue");
        expect(appSource).toContain(
            'import { useYuChiGong } from "@renderer/composables/useYuChiGong"',
        );
        expect(appSource).toContain("yuChiGong.queueSize === 0");
        expect(appSource).not.toContain("scanPhotosTask");
    });

    it("removes dead scan task cancellation from preference store", () => {
        const preferenceSource = readSource("src/stores/preference.ts");
        expect(preferenceSource).not.toContain("@renderer/utils/scan-folder");
        expect(preferenceSource).not.toContain("scanPhotosTask");
    });

    it("removes legacy utils facade (utils/api.ts)", () => {
        expect(existsSync(join(packageRoot, "src/utils/api.ts"))).toBe(false);
    });

    it("keeps real scan execution behind YuChiGong decree flow", () => {
        const yuChiGongSource = readSource("src/services/yuchigong/yuchigong.ts");
        expect(yuChiGongSource).toContain("ZOUZHE_MATTERS.SCAN_PHOTOS");
        expect(yuChiGongSource).not.toContain("@renderer/utils/api");
    });
});
