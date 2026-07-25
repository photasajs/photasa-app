import { describe, it, expect, vi, afterEach } from "vitest";
import { installDisableBrowserContextMenu } from "../disable-browser-context-menu";

describe("installDisableBrowserContextMenu", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("prevents default on contextmenu at capture phase", () => {
        const addSpy = vi.spyOn(document, "addEventListener");
        const removeSpy = vi.spyOn(document, "removeEventListener");

        const uninstall = installDisableBrowserContextMenu(document);

        expect(addSpy).toHaveBeenCalledWith("contextmenu", expect.any(Function), { capture: true });

        const handler = addSpy.mock.calls[0]?.[1] as (event: Event) => void;
        const event = new Event("contextmenu", { bubbles: true, cancelable: true });
        const preventDefault = vi.spyOn(event, "preventDefault");

        handler(event);

        expect(preventDefault).toHaveBeenCalled();

        uninstall();

        expect(removeSpy).toHaveBeenCalledWith("contextmenu", handler, { capture: true });
    });
});
