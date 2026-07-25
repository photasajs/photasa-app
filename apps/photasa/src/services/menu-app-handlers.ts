/**
 * App.vue 注册的菜单动作回调（RFC 0169）
 * 与 report-issue-dialog 相同模式：菜单服务不依赖 Vue 组件实例。
 */

export type MenuAppHandlers = {
    openPreference?: () => void;
    openAbout?: () => void;
    openImportPhotos?: () => void;
    openScanList?: () => void;
    addLibraryFolder?: () => void | Promise<void>;
};

let handlers: MenuAppHandlers = {};

export function registerMenuAppHandlers(next: MenuAppHandlers): void {
    handlers = { ...handlers, ...next };
}

export function clearMenuAppHandlers(): void {
    handlers = {};
}

export function openPreferenceFromMenu(): void {
    handlers.openPreference?.();
}

export function openAboutFromMenu(): void {
    handlers.openAbout?.();
}

export function openImportPhotosFromMenu(): void {
    handlers.openImportPhotos?.();
}

export function openScanListFromMenu(): void {
    handlers.openScanList?.();
}

export function addLibraryFolderFromMenu(): void {
    void handlers.addLibraryFolder?.();
}
