import { inject } from "vue";
import {
    YUAN_TIAN_GANG_TOKEN,
    type IYuanTianGangService,
    type LogViewerCapability,
    type UpdateCapability,
    type WindowCapability,
} from "@renderer/interfaces/yuan-tian-gang.interface";

const cleanup = async () => () => {};

const fallbackUpdates: UpdateCapability = {
    check: async () => ({ hasUpdate: false }),
    download: async () => {},
    install: async () => {},
    status: async () => ({}),
    version: async () => "",
    configure: async () => false,
    onAvailable: cleanup,
    onProgress: cleanup,
    onDownloaded: cleanup,
    onError: cleanup,
    onStatus: cleanup,
};

const fallbackLogs: LogViewerCapability = {
    open: async () => ({ success: false, message: "袁天罡服务未注入" }),
    close: async () => ({ success: false, message: "袁天罡服务未注入" }),
    onEntry: cleanup,
    onToggle: cleanup,
};

const fallbackWindows: WindowCapability = {
    minimize: async () => {},
    maximize: async () => {},
    unmaximize: async () => {},
    closeWindow: async () => {},
    closeSplashscreen: async () => {},
    reload: async () => {},
    isMac: async () => false,
    isMaximized: async () => false,
    onMaximized: cleanup,
    onUnmaximized: cleanup,
    onMaximizedState: cleanup,
};

const fallbackDesktop = {
    ...fallbackUpdates,
    ...fallbackLogs,
    ...fallbackWindows,
};

const fallback: Pick<IYuanTianGangService, "updates" | "logs" | "windows" | "desktop"> = {
    updates: fallbackUpdates,
    logs: fallbackLogs,
    windows: fallbackWindows,
    desktop: fallbackDesktop,
};

export function useYuanTianGang() {
    return inject<IYuanTianGangService>(YUAN_TIAN_GANG_TOKEN) ?? fallback;
}
