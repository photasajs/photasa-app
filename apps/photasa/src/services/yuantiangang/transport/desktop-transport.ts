import type { LogEntry } from "@photasa/common";
import type {
    LogViewerCapability,
    UpdateCapability,
    WindowCapability,
} from "@renderer/interfaces/yuan-tian-gang.interface";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type Unlisten = () => void;
type Listen = <T>(event: string, handler: (event: { payload: T }) => void) => Promise<Unlisten>;

interface DesktopTransportDependencies {
    invoke: Invoke;
    listen: Listen;
}

export class DesktopTransport implements UpdateCapability, LogViewerCapability, WindowCapability {
    constructor(private readonly dependencies: DesktopTransportDependencies) {}

    check(): Promise<{ hasUpdate: boolean; version?: string; info?: unknown }> {
        return this.dependencies.invoke("check_for_updates");
    }

    download(): Promise<void> {
        return this.dependencies.invoke("download_update");
    }

    install(): Promise<void> {
        return this.dependencies.invoke("install_update");
    }

    status(): Promise<Record<string, unknown>> {
        return this.dependencies.invoke("get_update_status");
    }

    version(): Promise<string> {
        return this.dependencies.invoke("get_app_version");
    }

    configure(patch: Record<string, unknown>): Promise<boolean> {
        return this.dependencies.invoke("update_auto_update_config", { patch });
    }

    onAvailable(callback: (data: { version: string; info?: unknown }) => void): Promise<Unlisten> {
        return this.on("picasa:update-available", callback);
    }

    onProgress(callback: (progress: number) => void): Promise<Unlisten> {
        return this.on("picasa:update-progress", callback);
    }

    onDownloaded(callback: (info: unknown) => void): Promise<Unlisten> {
        return this.on("picasa:update-downloaded", callback);
    }

    onError(callback: (error: string) => void): Promise<Unlisten> {
        return this.on("picasa:update-error", callback);
    }

    onStatus(callback: (status: unknown) => void): Promise<Unlisten> {
        return this.on("picasa:update-status-changed", callback);
    }

    open(): Promise<{ success: boolean; message: string }> {
        return this.dependencies.invoke("log_viewer_open");
    }

    close(): Promise<{ success: boolean; message: string }> {
        return this.dependencies.invoke("log_viewer_close");
    }

    onEntry(callback: (entry: LogEntry) => void): Promise<Unlisten> {
        return this.on("log:entry", callback);
    }

    onToggle(callback: () => void): Promise<Unlisten> {
        return this.on("log:toggle-viewer", () => callback());
    }

    minimize(): Promise<void> {
        return this.dependencies.invoke("minimize_window");
    }

    maximize(): Promise<void> {
        return this.dependencies.invoke("maximize_window");
    }

    unmaximize(): Promise<void> {
        return this.dependencies.invoke("unmaximize_window");
    }

    closeWindow(): Promise<void> {
        return this.dependencies.invoke("close_window");
    }

    closeSplashscreen(): Promise<void> {
        return this.dependencies.invoke("close_splashscreen");
    }

    reload(): Promise<void> {
        return this.dependencies.invoke("reload_window");
    }

    isMac(): Promise<boolean> {
        return this.dependencies.invoke("platform_is_mac");
    }

    isMaximized(): Promise<boolean> {
        return this.dependencies.invoke("is_maximized");
    }

    onMaximized(callback: () => void): Promise<Unlisten> {
        return this.on("window-maximized", () => callback());
    }

    onUnmaximized(callback: () => void): Promise<Unlisten> {
        return this.on("window-unmaximized", () => callback());
    }

    onMaximizedState(callback: (state: boolean) => void): Promise<Unlisten> {
        return this.on("window-maximized-state", (state) => callback(Boolean(state)));
    }

    private on<T>(event: string, callback: (payload: T) => void): Promise<Unlisten> {
        return this.dependencies.listen<T>(event, ({ payload }) => callback(payload));
    }
}
