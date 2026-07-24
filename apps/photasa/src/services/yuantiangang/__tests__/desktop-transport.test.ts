import { describe, expect, it, vi } from "vitest";
import { DesktopTransport } from "../transport/desktop-transport";

describe("DesktopTransport (RFC 0154 Phase 2g)", () => {
    it("maps typed update, log, and window operations to Rust commands", async () => {
        const invoke = vi.fn().mockResolvedValue(undefined);
        const transport = new DesktopTransport({ invoke, listen: vi.fn() });

        await transport.check();
        await transport.download();
        await transport.install();
        await transport.status();
        await transport.version();
        await transport.configure({ enabled: true });
        await transport.open();
        await transport.close();
        await transport.minimize();
        await transport.maximize();
        await transport.unmaximize();
        await transport.closeWindow();
        await transport.closeSplashscreen();
        await transport.reload();
        await transport.isMaximized();

        expect(invoke.mock.calls).toEqual([
            ["check_for_updates"],
            ["download_update"],
            ["install_update"],
            ["get_update_status"],
            ["get_app_version"],
            ["update_auto_update_config", { patch: { enabled: true } }],
            ["log_viewer_open"],
            ["log_viewer_close"],
            ["minimize_window"],
            ["maximize_window"],
            ["unmaximize_window"],
            ["close_window"],
            ["close_splashscreen"],
            ["reload_window"],
            ["is_maximized"],
        ]);
    });

    it("returns real unlisten functions for update, log, and window events", async () => {
        const unlisten = vi.fn();
        const listen = vi.fn().mockResolvedValue(unlisten);
        const transport = new DesktopTransport({ invoke: vi.fn(), listen });
        const update = vi.fn();
        const log = vi.fn();
        const maximized = vi.fn();

        const cleanups = await Promise.all([
            transport.onProgress(update),
            transport.onEntry(log),
            transport.onMaximizedState(maximized),
        ]);
        listen.mock.calls[0][1]({ payload: 42 });
        listen.mock.calls[1][1]({ payload: { message: "ready" } });
        listen.mock.calls[2][1]({ payload: true });
        cleanups.forEach((cleanup) => cleanup());

        expect(update).toHaveBeenCalledWith(42);
        expect(log).toHaveBeenCalledWith({ message: "ready" });
        expect(maximized).toHaveBeenCalledWith(true);
        expect(unlisten).toHaveBeenCalledTimes(3);
    });
});
