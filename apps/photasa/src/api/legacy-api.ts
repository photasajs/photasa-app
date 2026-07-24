/**
 * 扁平 legacy API 层 (RFC 0075)
 * 与 legacy-api.ts (RFC 0075) 的 window.api 形状 1:1 一致，
 * 在 Tauri 下委托给嵌套 adapter 或 invoke，未实现的用 stub，避免 window.api.xxx 未定义。
 */

import type { PhotasaFlatApi } from "@renderer/ipc/photasa-flat-api";
import { isTauri } from "./env";
import { api } from "./adapter";
import { toWebviewMediaUrl, webviewMediaUrlToAbsolutePath } from "@renderer/utils/media-url";
import type { ScanAction, ScanResult } from "./scan.adapter";
import { shouldIgnorePhotasaPath as ignorePhotasaPathUtil } from "@photasa/common";
import {
    callLegacyPreloadNested,
    callLegacyPreloadSection,
    getLegacyPreloadApi,
} from "./legacy-preload-access";
import {
    shortenThumbnailName as shortenThumbnailRelativePath,
    toFileNameFromPath,
    toThumbnailName as toThumbnailFileName,
} from "@renderer/utils/photasa-path";
import {
    WATCH_FILE_EVENTS,
    buildWatchStateFromEvent,
    type WatchFileEventPayload,
} from "./watch-event";

const NOT_IMPLEMENTED = "Tauri: not implemented";

/** Tauri：更新事件取消订阅（供 removeAllUpdateListeners）；用 globalThis 以便 Vitest/node 与 webview 一致 */
function getUpdateUnsubs(): Array<() => void> {
    const g = globalThis as unknown as { __photasaUpdateUnsubs?: Array<() => void> };
    if (!g.__photasaUpdateUnsubs) g.__photasaUpdateUnsubs = [];
    return g.__photasaUpdateUnsubs;
}

const EVENT_SCAN_QUEUE_ADD = "picasa:add-to-scan-queue" as const;

function getScanEventUnsubs(): Array<() => void> {
    const g = globalThis as unknown as { __photasaScanEventUnsubs?: Array<() => void> };
    if (!g.__photasaScanEventUnsubs) g.__photasaScanEventUnsubs = [];
    return g.__photasaScanEventUnsubs;
}

function stubAsync<T = never>(): Promise<T> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
}
function noopListener(): () => void {
    return () => {};
}

async function ensureInvoke() {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke;
}

/**
 * 构建扁平 window.api（与 legacy.ts 同形）
 */
export function createLegacyApi() {
    return {
        // ---------- 监听与导入 ----------
        startWatching: (config: unknown, callback: unknown) => {
            if (!isTauri())
                return callLegacyPreloadSection("api", "startWatching", config, callback);
            (async () => {
                const invoke = await ensureInvoke();
                const c = config as {
                    paths?: string[];
                    recursive?: boolean;
                    thumbnailSize?: number;
                    thumbnail_size?: number;
                };
                const thumbnailSize = c?.thumbnailSize ?? c?.thumbnail_size;
                await invoke("start_file_watch", {
                    config: {
                        paths: c?.paths ?? [],
                        recursive: c?.recursive ?? true,
                        thumbnailSize,
                    },
                });
                if (typeof callback === "function") {
                    const { listen } = await import("@tauri-apps/api/event");
                    const cb = callback as (state: unknown) => void;
                    const unlistens: Array<() => void> = [];
                    // RFC 0133：事件名 → 完整 WatchState（对齐 legacy-api fs-watch.ts）
                    for (const name of WATCH_FILE_EVENTS) {
                        const un = await listen(name, (e) => {
                            const state = buildWatchStateFromEvent(
                                name,
                                e.payload as WatchFileEventPayload,
                            );
                            if (state) {
                                cb(state);
                            }
                        });
                        unlistens.push(un);
                    }
                    (window as any).__offFileWatch = () => unlistens.forEach((u) => u());
                }
            })();
            return undefined;
        },
        stopWatching: () => {
            if (!isTauri()) return callLegacyPreloadSection("api", "stopWatching");
            (window as any).__offFileWatch?.();
            return ensureInvoke().then((invoke) => invoke("stop_file_watch"));
        },
        // ---------- 扫描 ----------
        scanPhotos: (scan: ScanAction): Promise<ScanResult> => {
            if (!isTauri()) {
                return (
                    (callLegacyPreloadSection("api", "scanPhotos", scan) as
                        | Promise<ScanResult>
                        | undefined) ?? stubAsync()
                );
            }
            const requestId = `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            return new Promise<ScanResult>((resolve, reject) => {
                (async () => {
                    try {
                        const unlisten = await api.scan.onScanResult((result) => {
                            if (result.requestId !== requestId) return;
                            if (result.type === "complete") {
                                unlisten();
                                resolve(result);
                            } else if (result.type === "error") {
                                unlisten();
                                reject(new Error(result.error || "扫描失败"));
                            }
                        });
                        await api.scan.scanPhotos(requestId, scan);
                    } catch (e) {
                        reject(e);
                    }
                })();
            });
        },

        // ---------- 目录与配置 ----------
        chooseDirectory: () => {
            if (!isTauri()) return callLegacyPreloadSection("api", "chooseDirectory");
            return (async () => {
                const { open } = await import("@tauri-apps/plugin-dialog");
                const selected = await open({ directory: true, multiple: false });
                const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
                return { filePaths: paths };
            })();
        },
        getDirectory: (name: string) => {
            if (!isTauri()) return callLegacyPreloadSection("api", "getDirectory", name);
            return ensureInvoke().then((invoke) =>
                invoke<string | null>("get_directory", { name }),
            );
        },

        fileUrlFromPath: (path: string) =>
            isTauri()
                ? Promise.resolve(toWebviewMediaUrl(webviewMediaUrlToAbsolutePath(path)))
                : Promise.resolve(path.startsWith("/") ? `file://${path}` : `file:///${path}`),

        scanSubfolders: (folderPath: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<string[]>("sub_folders", { folderPath }))
                : stubAsync(),

        // ---------- 路径与工具 ----------
        isFileUnderFolder: (file: string, folder: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) =>
                      invoke<boolean>("is_file_under_folder", { file, folder }),
                  )
                : Promise.resolve(
                      Boolean(callLegacyPreloadSection("api", "isFileUnderFolder", file, folder)),
                  ),
        toFileName: (path: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<string>("to_file_name", { path }))
                : toFileNameFromPath(path),
        toThumbnailName: (path: string) => toThumbnailFileName(path),
        shortenThumbnailName: (path: string) => shortenThumbnailRelativePath(path),
        isHiddenFile: (fileName: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<boolean>("is_hidden_file", { fileName }))
                : Promise.resolve(fileName.startsWith(".")),
        shouldIgnorePhotasaPath: (fileName: string) =>
            Promise.resolve(ignorePhotasaPathUtil(fileName)),
        toDirName: (path: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<string>("to_dir_name", { path }))
                : (() => {
                      const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
                      return i <= 0 ? "" : path.slice(0, i);
                  })(),
        isVideoFile: (path: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<boolean>("is_video_file", { path }))
                : stubAsync(),
        isImageFile: (path: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<boolean>("is_image_file", { path }))
                : stubAsync(),
        mergePath: (left: string, right = "") => {
            const safeLeft = typeof left === "string" ? left : "";
            const safeRight = typeof right === "string" ? right : "";
            return isTauri() && safeRight
                ? ensureInvoke().then((invoke) =>
                      invoke<string>("merge_path", { left: safeLeft, right: safeRight }),
                  )
                : safeRight
                  ? `${safeLeft.replace(/[/\\]+$/, "")}/${safeRight.replace(/^[/\\]+/, "")}`
                  : safeLeft;
        },
        splitPath: (path: string) => path.split(/[/\\]/).filter(Boolean),
        joinPath: (...parts: string[]) => parts.filter(Boolean).join("/"),
        getSeparator: () =>
            isTauri() ? ensureInvoke().then((invoke) => invoke<string>("get_separator")) : "/",
        // ⚠️ Must stay synchronous. Callers (FolderList / 尉迟恭 / 李世民模板) treat this as
        // `string`. Returning a Promise puts a non-cloneable value into qizou/shengzhi content;
        // JSON.stringify then drops `path`, and 尉迟恭 logs「圣旨缺少path参数或类型错误」.
        normalizePath: (path: unknown): string =>
            typeof path === "string" ? path.replace(/\\/g, "/").replace(/\/+/g, "/") : "",
        isMac: async () => {
            if (!isTauri()) return callLegacyPreloadSection("api", "isMac") ?? false;
            try {
                const invoke = await ensureInvoke();
                const p = await invoke<string>("get_platform");
                return p === "darwin";
            } catch {
                return typeof navigator !== "undefined" && navigator.platform === "MacIntel";
            }
        },

        // ---------- 窗口 (委托嵌套 adapter) ----------
        minimizeWindow: () => api.window.minimize(),
        maximizeWindow: () => api.window.maximize(),
        unmaximizeWindow: async () => {
            const invoke = await ensureInvoke();
            return invoke("unmaximize_window");
        },
        closeWindow: () => api.window.close(),
        /** RFC 0099：Tauri 调 Rust `reload_window`；contract reference 无 preload 项时用 `location.reload` */
        reloadWindow: () => {
            if (!isTauri()) {
                const elApi = getLegacyPreloadApi() as {
                    api?: { reloadWindow?: () => Promise<void> };
                };
                if (typeof elApi?.api?.reloadWindow === "function") return elApi.api.reloadWindow();
                window.location.reload();
                return Promise.resolve();
            }
            return ensureInvoke().then((invoke) => invoke<void>("reload_window"));
        },
        queryMaximized: () => api.window.isMaximized(),
        onWindowMaximized: (cb: (...args: any[]) => void) => {
            import("@tauri-apps/api/event").then(({ listen }) => {
                listen("window-maximized", () => cb()).then(
                    (un) => ((window as any).__offWindowMaximized = un),
                );
            });
            return noopListener();
        },
        onWindowUnmaximized: (cb: (...args: any[]) => void) => {
            import("@tauri-apps/api/event").then(({ listen }) => {
                listen("window-unmaximized", () => cb()).then(
                    (un) => ((window as any).__offWindowUnmaximized = un),
                );
            });
            return noopListener();
        },
        onWindowMaximizedState: (cb: (...args: any[]) => void) => {
            import("@tauri-apps/api/event").then(({ listen }) => {
                listen("window-maximized-state", (e) => cb(e)).then(
                    (un) => ((window as any).__offWindowMaximizedState = un),
                );
            });
            return noopListener();
        },
        offWindowMaximized: (_cb: (...args: any[]) => void) => {
            ((window as any).__offWindowMaximized as (() => void) | undefined)?.();
            return noopListener();
        },
        offWindowUnmaximized: (_cb: (...args: any[]) => void) => {
            ((window as any).__offWindowUnmaximized as (() => void) | undefined)?.();
            return noopListener();
        },
        offWindowMaximizedState: (_cb: (...args: any[]) => void) => {
            ((window as any).__offWindowMaximizedState as (() => void) | undefined)?.();
            return noopListener();
        },

        applySystemMenu: (menus: unknown) => {
            if (!isTauri()) return undefined;
            ensureInvoke().then((invoke) => invoke("apply_system_menu", { menus }));
            return undefined;
        },
        onMenuAction: (cb: (payload: unknown) => void) => {
            if (!isTauri()) return noopListener();
            let unlisten: (() => void) | undefined;
            import("@tauri-apps/api/event").then(({ listen }) => {
                listen("picasa:menu-action", (e) => cb(e.payload)).then((un) => {
                    unlisten = un;
                });
            });
            return () => {
                unlisten?.();
            };
        },

        // ---------- 更新 (RFC 0090) ----------
        checkForUpdates: () =>
            isTauri()
                ? ensureInvoke().then((invoke) =>
                      invoke<{ hasUpdate: boolean; version?: string; info?: unknown }>(
                          "check_for_updates",
                      ),
                  )
                : (callLegacyPreloadSection("api", "checkForUpdates") ?? stubAsync()),
        downloadUpdate: () =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<void>("download_update"))
                : (callLegacyPreloadSection("api", "downloadUpdate") ?? stubAsync()),
        installUpdate: () =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<void>("install_update"))
                : (callLegacyPreloadSection("api", "installUpdate") ?? stubAsync()),
        getUpdateStatus: () =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke("get_update_status"))
                : (callLegacyPreloadSection("api", "getUpdateStatus") ?? stubAsync()),
        getAppVersion: () =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<string>("get_app_version"))
                : (callLegacyPreloadSection("api", "getAppVersion") ?? Promise.resolve("")),
        updateAutoUpdateConfig: (config: unknown) =>
            isTauri()
                ? ensureInvoke().then((invoke) =>
                      invoke<boolean>("update_auto_update_config", { patch: config }),
                  )
                : (callLegacyPreloadSection("api", "updateAutoUpdateConfig", config) ??
                  stubAsync()),
        onUpdateProgress: (cb: (progress: number) => void) => {
            if (!isTauri()) {
                return callLegacyPreloadSection("api", "onUpdateProgress", cb) ?? noopListener();
            }
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen<number>("picasa:update-progress", (e) => cb(e.payload)).then((un) =>
                    getUpdateUnsubs().push(un),
                );
            });
            return () => {};
        },
        onUpdateDownloaded: (cb: (info?: unknown) => void) => {
            if (!isTauri()) {
                return callLegacyPreloadSection("api", "onUpdateDownloaded", cb) ?? noopListener();
            }
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen("picasa:update-downloaded", (e) => cb(e.payload as unknown)).then((un) =>
                    getUpdateUnsubs().push(un),
                );
            });
            return () => {};
        },
        onUpdateError: (cb: (error: string) => void) => {
            if (!isTauri()) {
                return callLegacyPreloadSection("api", "onUpdateError", cb) ?? noopListener();
            }
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen<string>("picasa:update-error", (e) => cb(e.payload)).then((un) =>
                    getUpdateUnsubs().push(un),
                );
            });
            return () => {};
        },
        onUpdateAvailable: (cb: (data: { version: string; info?: unknown }) => void) => {
            if (!isTauri()) {
                return callLegacyPreloadSection("api", "onUpdateAvailable", cb) ?? noopListener();
            }
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen("picasa:update-available", (e) =>
                    cb(e.payload as { version: string; info?: unknown }),
                ).then((un) => getUpdateUnsubs().push(un));
            });
            return () => {};
        },
        onStatusChanged: (cb: (status: unknown) => void) => {
            if (!isTauri()) {
                return callLegacyPreloadSection("api", "onStatusChanged", cb) ?? noopListener();
            }
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen("picasa:update-status-changed", (e) => cb(e.payload)).then((un) =>
                    getUpdateUnsubs().push(un),
                );
            });
            return () => {};
        },
        removeAllUpdateListeners: () => {
            if (!isTauri()) {
                callLegacyPreloadSection("api", "removeAllUpdateListeners");
                return;
            }
            const subs = getUpdateUnsubs();
            while (subs.length) {
                subs.pop()?.();
            }
        },

        // ---------- 导入增强 ----------
        chooseDirectories: (multiSelect = true) => api.import.chooseDirectories(multiSelect),
        onScanQueueAdd: (cb: (operations: unknown[]) => void) => {
            if (!isTauri()) {
                return callLegacyPreloadSection("api", "onScanQueueAdd", cb) ?? noopListener();
            }
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen(EVENT_SCAN_QUEUE_ADD, (e) => cb((e.payload as unknown[]) ?? [])).then((un) =>
                    getScanEventUnsubs().push(un),
                );
            });
            return () => {};
        },

        // ---------- 日志 (RFC 0088, 0089) ----------
        log: {
            viewerOpen: () =>
                isTauri()
                    ? ensureInvoke().then((invoke) =>
                          invoke<{ success: boolean; message: string }>("log_viewer_open"),
                      )
                    : (callLegacyPreloadNested(["api", "log"], "viewerOpen") ?? stubAsync()),
            viewerClose: () =>
                isTauri()
                    ? ensureInvoke().then((invoke) =>
                          invoke<{ success: boolean; message: string }>("log_viewer_close"),
                      )
                    : (callLegacyPreloadNested(["api", "log"], "viewerClose") ?? stubAsync()),
            onEntry: (callback: (entry: unknown) => void) => {
                if (!isTauri()) {
                    return (
                        callLegacyPreloadNested(["api", "log"], "onEntry", callback) ??
                        noopListener()
                    );
                }
                let unlisten: (() => void) | undefined;
                void import("@tauri-apps/api/event").then(({ listen }) => {
                    listen("log:entry", (e) => callback(e.payload)).then((un) => {
                        unlisten = un;
                    });
                });
                return () => {
                    unlisten?.();
                };
            },
            onToggleViewer: (callback: () => void) => {
                if (!isTauri()) {
                    return (
                        callLegacyPreloadNested(["api", "log"], "onToggleViewer", callback) ??
                        noopListener()
                    );
                }
                let unlisten: (() => void) | undefined;
                void import("@tauri-apps/api/event").then(({ listen }) => {
                    listen("log:toggle-viewer", () => callback()).then((un) => {
                        unlisten = un;
                    });
                });
                return () => {
                    unlisten?.();
                };
            },
        },

        // ---------- 路径扩展 (api-path 使用，无则 stub) ----------
        isAbsolutePath: (path: string) =>
            Promise.resolve(path.startsWith("/") || /^[A-Za-z]:[/\\]/.test(path)),
        relativePath: (from: string, to: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<string>("relative_path", { from, to }))
                : stubAsync(),
        resolvePath: (...segments: string[]) =>
            isTauri() && segments.length > 0
                ? ensureInvoke().then((invoke) =>
                      invoke<string>("resolve_path", { path: segments.filter(Boolean).join("/") }),
                  )
                : Promise.resolve(segments.filter(Boolean).join("/")),
        getRoot: (path: string) => {
            if (isTauri()) {
                return ensureInvoke().then((invoke) => invoke<string>("get_path_root", { path }));
            }
            const normalized = typeof path === "string" ? path.replace(/\\/g, "/") : "";
            if (normalized.startsWith("/")) {
                return Promise.resolve("/");
            }
            const m = /^([A-Za-z]:)(\/|$)/.exec(normalized);
            if (m) {
                return Promise.resolve(m[2] === "/" ? `${m[1]}/` : m[1]);
            }
            return Promise.resolve("");
        },
    } as unknown as PhotasaFlatApi;
}
