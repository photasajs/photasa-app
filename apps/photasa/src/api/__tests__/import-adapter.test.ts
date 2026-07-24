import { beforeEach, describe, expect, it, vi } from "vitest";
import { importAdapter } from "../import.adapter";

const { mockEnv, open } = vi.hoisted(() => ({
    mockEnv: { isTauri: true },
    open: vi.fn(),
}));

vi.mock("../env", () => ({
    isTauri: () => mockEnv.isTauri,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));

describe("importAdapter directory capability retained until RFC 0154 Phase 2f", () => {
    beforeEach(() => vi.clearAllMocks());

    it("normalizes a single selected directory", async () => {
        open.mockResolvedValue("/photos");
        await expect(importAdapter.chooseDirectories(false)).resolves.toEqual({
            filePaths: ["/photos"],
        });
    });
});
