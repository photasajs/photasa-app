import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { TITLEBAR_GUARD_FILES, collectTitlebarGuardViolations } from "../titlebar-platform.guard";

const PHOTASA_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readGuardFile(relativePath: string): string {
    return readFileSync(path.join(PHOTASA_ROOT, relativePath), "utf8");
}

describe("titlebar / macOS menu regression guards", () => {
    it("source files satisfy platform contracts (run on every CI + pre-commit when staged)", () => {
        const violations = collectTitlebarGuardViolations({
            titlebarMac: readGuardFile(TITLEBAR_GUARD_FILES.titlebarMac),
            titlebarMenuBar: readGuardFile(TITLEBAR_GUARD_FILES.titlebarMenuBar),
            menuData: readGuardFile(TITLEBAR_GUARD_FILES.menuData),
            menuRs: readGuardFile(TITLEBAR_GUARD_FILES.menuRs),
            mainRs: readGuardFile(TITLEBAR_GUARD_FILES.mainRs),
        });

        expect(violations, violations.join("\n")).toEqual([]);
    });
});
