import { describe, it, expect, vi } from "vitest";
import { preventDefault } from "./event";

describe("preventDefault", () => {
    it("should call e.preventDefault", () => {
        const e = { preventDefault: vi.fn() } as unknown as Event;
        preventDefault(e);
        expect(e.preventDefault).toHaveBeenCalled();
    });
});
