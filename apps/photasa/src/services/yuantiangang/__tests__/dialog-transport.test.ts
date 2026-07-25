import { describe, expect, it, vi } from "vitest";
import { DialogTransport } from "../transport/dialog-transport";

describe("DialogTransport (RFC 0154 Phase 2f)", () => {
    it.each([
        {
            multiple: true,
            selected: ["/photos/a", "/photos/b"],
            expected: { filePaths: ["/photos/a", "/photos/b"] },
        },
        {
            multiple: false,
            selected: "/photos",
            expected: { filePaths: ["/photos"] },
        },
        {
            multiple: false,
            selected: null,
            expected: { filePaths: [] },
        },
    ])(
        "normalizes directory selection when multiple=$multiple",
        async ({ multiple, selected, expected }) => {
            const open = vi.fn().mockResolvedValue(selected);
            const transport = new DialogTransport({ open });

            await expect(transport.chooseDirectories(multiple)).resolves.toEqual(expected);
            expect(open).toHaveBeenCalledWith({ directory: true, multiple });
        },
    );
});
