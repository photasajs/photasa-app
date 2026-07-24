import { beforeEach, describe, expect, it, vi } from "vitest";
import { chooseDirectories } from "../api";

const flatApi = {
    chooseDirectories: vi.fn(),
};

vi.mock("@renderer/ipc/api-access", () => ({
    getPhotasaApi: () => flatApi,
}));

vi.mock("@photasa/common", async () => {
    const actual = await vi.importActual<typeof import("@photasa/common")>("@photasa/common");
    return {
        ...actual,
        loggers: {
            ...actual.loggers,
            api: {
                debug: vi.fn(),
                error: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
            },
        },
    };
});

describe("legacy directory helpers retained until RFC 0154 Phase 2f", () => {
    beforeEach(() => vi.clearAllMocks());

    it("forwards multi-directory selection", async () => {
        flatApi.chooseDirectories.mockResolvedValue({ filePaths: ["/photos"] });
        await expect(chooseDirectories(true)).resolves.toEqual({ filePaths: ["/photos"] });
        expect(flatApi.chooseDirectories).toHaveBeenCalledWith(true);
    });
});
