/**
 * 扁平 legacy API 层 (RFC 0075)
 * 与 apps/desktop/src/preload/legacy.ts 的 window.api 形状 1:1 一致，
 * 在 Tauri 下委托给嵌套 adapter 或 invoke，未实现的用 stub，避免 window.api.xxx 未定义。
 */

import { isTauri } from "./env";
import { api } from "./adapter";
import { toWebviewMediaUrl, webviewMediaUrlToAbsolutePath } from "@renderer/utils/media-url";
import { normalizeImportProgressPayload } from "./import.adapter";
import type { ScanAction, ScanResult } from "./scan.adapter";
import type { ThumbnailRequest } from "./thumbnail.adapter";
import type { ImportConfig } from "./import.adapter";
import type {
    FileMetadata,
    ImportHistory,
    ImportPreview,
    ImportProgress,
    RecoverableImport,
    RecoverableImportActionResult,
    UndoPreview,
    UndoResult,
} from "@photasa/common";
import { shouldIgnorePhotasaPath as ignorePhotasaPathUtil } from "@photasa/common";
import {
    shortenThumbnailName as shortenThumbnailRelativePath,
    toFileNameFromPath,
    toThumbnailName as toThumbnailFileName,
} from "@renderer/utils/photasa-path";
import {
    EVENT_IMPORT_PREVIEW_PROGRESS,
    EVENT_SCAN_QUEUE_ADD,
    emptyUndoPreview,
} from "./tauri-import-stubs";

const NOT_IMPLEMENTED = "Tauri: not implemented";

/** Tauri：更新事件取消订阅（供 removeAllUpdateListeners）；用 globalThis 以便 Vitest/node 与 webview 一致 */
function getUpdateUnsubs(): Array<() => void> {
    const g = globalThis as unknown as { __photasaUpdateUnsubs?: Array<() => void> };
    if (!g.__photasaUpdateUnsubs) g.__photasaUpdateUnsubs = [];
    return g.__photasaUpdateUnsubs;
}

/** 与 `src-tauri/commands/import_legacy.rs` 中 `IMPORT_PHOTOS_LEGACY_EVENT` 一致（仅桥接，无业务逻辑） */
const IMPORT_PHOTOS_LEGACY_EVENT = "picasa:import-photos-legacy" as const;

/** Tauri：导入事件取消订阅收集（供 removeImportListeners）；用 globalThis 以便 Vitest/node 与 webview 一致 */
function getImportUnsubs(): Array<() => void> {
    const g = globalThis as unknown as { __photasaImportUnsubs?: Array<() => void> };
    if (!g.__photasaImportUnsubs) g.__photasaImportUnsubs = [];
    return g.__photasaImportUnsubs;
}

function stubAsync<T = never>(): Promise<T> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
}
function noopListener(): () => void {
    return () => {};
}

/** 用于 scanPhotos：requestId -> resolve */
const scanResolveMap = new Map<string, (value: ScanResult) => void>();

async function ensureInvoke() {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke;
}

function parseIsoDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") return new Date(value);
    return new Date(0);
}

/** RFC 0093：Rust 事件 JSON 中 `created` 为 RFC3339 字符串，与 Electron preload 传入的 `Date` 对齐 */
function normalizeImportPhotosActionFromRust(action: unknown): unknown {
    if (!action || typeof action !== "object") return action;
    const a = { ...(action as Record<string, unknown>) };
    if ("created" in a && a.created != null && !(a.created instanceof Date)) {
        a.created = parseIsoDate(a.created);
    }
    return a;
}

function normalizeUndoPreviewFromRust(raw: unknown, fallbackId: string): UndoPreview {
    if (!raw || typeof raw !== "object") {
        return emptyUndoPreview(fallbackId);
    }
    const r = raw as Record<string, unknown>;
    const dirs = r.directoriesToCleanup;
    const dirSet =
        dirs instanceof Set
            ? (dirs as Set<string>)
            : new Set(Array.isArray(dirs) ? (dirs as string[]) : []);

    const filesRaw = Array.isArray(r.filesToDelete) ? r.filesToDelete : [];
    const filesToDelete = filesRaw.map((f) => {
        const x = f as Record<string, unknown>;
        return {
            path: String(x.path ?? ""),
            size: Number(x.size ?? 0),
            originalPath: String(x.originalPath ?? ""),
            importTime: parseIsoDate(x.importTime),
        };
    });

    const issuesRaw = Array.isArray(r.potentialIssues) ? r.potentialIssues : [];
    const potentialIssues = issuesRaw.map((p) => {
        const x = p as Record<string, unknown>;
        const sev = x.severity;
        const severity: "info" | "warning" | "error" =
            sev === "warning" || sev === "error" || sev === "info" ? sev : "info";
        return {
            file: String(x.file ?? ""),
            issue: String(x.issue ?? ""),
            severity,
        };
    });

    return {
        historyId: typeof r.historyId === "string" ? r.historyId : fallbackId,
        canUndo: Boolean(r.canUndo),
        reason: typeof r.reason === "string" ? r.reason : "",
        filesToDelete,
        directoriesToCleanup: dirSet,
        potentialIssues,
        estimatedTime: typeof r.estimatedTime === "number" ? r.estimatedTime : 0,
    };
}

function normalizeUndoResultFromRust(raw: unknown): UndoResult {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const errList = Array.isArray(r.errors) ? r.errors : [];
    const errors = errList.map((e) => {
        const x = e as Record<string, unknown>;
        return { file: String(x.file ?? ""), error: String(x.error ?? "") };
    });
    const rd = r.restoredDirectories;
    const restoredDirectories =
        rd instanceof Set
            ? (rd as Set<string>)
            : new Set(Array.isArray(rd) ? (rd as string[]) : []);
    return {
        success: Boolean(r.success),
        deletedFiles: Array.isArray(r.deletedFiles) ? (r.deletedFiles as string[]) : [],
        errors,
        restoredDirectories,
        undoId: String(r.undoId ?? ""),
        timestamp: parseIsoDate(r.timestamp),
    };
}

function normalizeRecoverableImport(raw: unknown): RecoverableImport {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const filesRaw = Array.isArray(r.fileList) ? r.fileList : [];
    const fileList = filesRaw.map((file) => {
        const f = file as Record<string, unknown>;
        return {
            originalPath: String(f.originalPath ?? ""),
            targetPath: String(f.targetPath ?? ""),
            size: Number(f.size ?? 0),
            checksum: f.checksum == null ? null : String(f.checksum),
            importTime: parseIsoDate(f.importTime),
        };
    });
    const status =
        r.status === "running" || r.status === "paused" || r.status === "interrupted"
            ? r.status
            : "interrupted";

    return {
        id: String(r.id ?? r.importId ?? ""),
        importId: typeof r.importId === "string" ? r.importId : undefined,
        status,
        sourcePaths: Array.isArray(r.sourcePaths) ? (r.sourcePaths as string[]) : [],
        targetPath: String(r.targetPath ?? ""),
        totalFiles: Number(r.totalFiles ?? 0),
        config:
            r.config && typeof r.config === "object"
                ? (r.config as RecoverableImport["config"])
                : undefined,
        progress:
            r.progress && typeof r.progress === "object"
                ? (r.progress as RecoverableImport["progress"])
                : undefined,
        fileList,
        startedAt: parseIsoDate(r.startedAt),
        updatedAt: parseIsoDate(r.updatedAt),
    };
}

function normalizeRecoverableImportActionResult(raw: unknown): RecoverableImportActionResult {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const errList = Array.isArray(r.errors) ? r.errors : [];
    const errors = errList.map((e) => {
        const x = e as Record<string, unknown>;
        return { file: String(x.file ?? ""), error: String(x.error ?? "") };
    });
    return {
        success: Boolean(r.success),
        importId: String(r.importId ?? ""),
        deletedFiles: Array.isArray(r.deletedFiles) ? (r.deletedFiles as string[]) : undefined,
        keptFiles: typeof r.keptFiles === "number" ? r.keptFiles : undefined,
        errors,
        timestamp: parseIsoDate(r.timestamp),
    };
}

function normalizeFileMetadataFromRust(raw: unknown): FileMetadata {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const ds = r.dateSource;
    const dateSource: FileMetadata["dateSource"] =
        ds === "file_modified" ||
        ds === "file_created" ||
        ds === "exif" ||
        ds === "video_metadata" ||
        ds === "current_date"
            ? ds
            : "file_modified";
    const ft = r.type;
    const type: FileMetadata["type"] =
        ft === "image" || ft === "video" || ft === "ai" || ft === "other" ? ft : "other";
    const dateTime =
        r.dateTime != null && (typeof r.dateTime === "string" || typeof r.dateTime === "number")
            ? parseIsoDate(r.dateTime)
            : undefined;

    let gpsInfo: FileMetadata["gpsInfo"];
    const g = r.gpsInfo;
    if (g && typeof g === "object" && !Array.isArray(g)) {
        const o = g as Record<string, unknown>;
        const lat = Number(o.latitude);
        const lon = Number(o.longitude);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            const alt = o.altitude;
            gpsInfo = {
                latitude: lat,
                longitude: lon,
                altitude:
                    alt === null || alt === undefined
                        ? null
                        : Number.isNaN(Number(alt))
                          ? null
                          : Number(alt),
            };
        }
    }

    let cameraInfo: FileMetadata["cameraInfo"];
    const c = r.cameraInfo;
    if (c && typeof c === "object" && !Array.isArray(c)) {
        const o = c as Record<string, unknown>;
        const mk = (x: unknown) => (x == null ? null : String(x));
        const num = (x: unknown) =>
            x == null || x === "" ? null : Number.isNaN(Number(x)) ? null : Number(x);
        cameraInfo = {
            make: mk(o.make),
            model: mk(o.model),
            lens: mk(o.lens),
            iso: num(o.iso),
            focalLength: num(o.focalLength),
            aperture: num(o.aperture),
            shutterSpeed: num(o.shutterSpeed),
        };
    }

    const rawMeta = r.rawMetadata;
    const rawMetadata =
        rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
            ? (rawMeta as Record<string, unknown>)
            : undefined;

    const res = r.resolution;
    const resolution =
        res && typeof res === "object" && !Array.isArray(res)
            ? {
                  width: Number((res as Record<string, unknown>).width ?? 0),
                  height: Number((res as Record<string, unknown>).height ?? 0),
              }
            : undefined;

    return {
        path: String(r.path ?? ""),
        name: String(r.name ?? ""),
        size: Number(r.size ?? 0),
        type,
        modifiedTime: parseIsoDate(r.modifiedTime),
        createdTime: parseIsoDate(r.createdTime),
        dateSource,
        format: typeof r.format === "string" ? r.format : undefined,
        width: typeof r.width === "number" ? r.width : undefined,
        height: typeof r.height === "number" ? r.height : undefined,
        duration: typeof r.duration === "number" ? r.duration : undefined,
        codec: typeof r.codec === "string" ? r.codec : undefined,
        resolution:
            resolution &&
            resolution.width > 0 &&
            resolution.height > 0 &&
            !Number.isNaN(resolution.width) &&
            !Number.isNaN(resolution.height)
                ? resolution
                : undefined,
        dateTime,
        gpsInfo,
        cameraInfo,
        rawMetadata,
    };
}

/**
 * 构建扁平 window.api（与 legacy.ts 同形）
 */
export function createLegacyApi(): Record<string, unknown> {
    return {
        // ---------- 监听与导入 ----------
        startWatching: (config: unknown, callback: unknown) => {
            if (!isTauri())
                return (window as any).electronAPI?.api?.startWatching?.(config, callback);
            (async () => {
                const invoke = await ensureInvoke();
                const c = config as { paths?: string[]; recursive?: boolean };
                await invoke("start_file_watch", {
                    config: { paths: c?.paths ?? [], recursive: c?.recursive ?? true },
                });
                if (typeof callback === "function") {
                    const { listen } = await import("@tauri-apps/api/event");
                    const unlistens: Array<() => void> = [];
                    for (const name of [
                        "picasa:file-add",
                        "picasa:file-add-dir",
                        "picasa:file-change",
                        "picasa:file-unlink",
                        "picasa:file-unlink-dir",
                    ]) {
                        const un = await listen(name, (e) =>
                            (callback as (arg: unknown) => void)(e.payload),
                        );
                        unlistens.push(un);
                    }
                    (window as any).__offFileWatch = () => unlistens.forEach((u) => u());
                }
            })();
            return undefined;
        },
        stopWatching: () => {
            if (!isTauri()) return (window as any).electronAPI?.api?.stopWatching?.();
            (window as any).__offFileWatch?.();
            return ensureInvoke().then((invoke) => invoke("stop_file_watch"));
        },
        importPhotos: (paths: string[], target: string, callback: (arg: any) => void) => {
            if (!isTauri())
                return (window as any).electronAPI?.api?.importPhotos?.(paths, target, callback);
            // RFC 0093：复制与遍历在 Rust `import_photos_legacy`；此处仅 invoke + 事件转发
            void (async () => {
                try {
                    const invoke = await ensureInvoke();
                    const { listen } = await import("@tauri-apps/api/event");
                    const sessionId = await invoke<string>("import_photos_legacy", {
                        folders: paths,
                        target,
                    });
                    const unlisten = await listen<{
                        sessionId: string;
                        type: string;
                        error?: string | null;
                        action: unknown;
                    }>(IMPORT_PHOTOS_LEGACY_EVENT, (event) => {
                        const payload = event.payload;
                        if (payload.sessionId !== sessionId) return;
                        if (payload.type === "next") {
                            callback({
                                type: "next",
                                error: null,
                                action: normalizeImportPhotosActionFromRust(payload.action),
                            });
                        } else if (payload.type === "error") {
                            callback({
                                type: "error",
                                error: payload.error ?? "unknown",
                                action: {},
                            });
                        } else if (payload.type === "complete") {
                            callback({ type: "complete", error: null, action: {} });
                            unlisten();
                            const subs = getImportUnsubs();
                            const ix = subs.lastIndexOf(unlisten);
                            if (ix >= 0) subs.splice(ix, 1);
                        }
                    });
                    getImportUnsubs().push(unlisten);
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    callback({ type: "error", error: msg, action: {} });
                }
            })();
            return undefined;
        },

        // ---------- 扫描 ----------
        scanPhotos: (scan: ScanAction): Promise<ScanResult> => {
            if (!isTauri())
                return (window as any).electronAPI?.api?.scanPhotos?.(scan) ?? stubAsync();
            const requestId = `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            return new Promise<ScanResult>((resolve, reject) => {
                scanResolveMap.set(requestId, resolve);
                (async () => {
                    try {
                        const unlisten = await api.scan.onScanResult((result) => {
                            if (result.requestId === requestId && result.type === "complete") {
                                const r = scanResolveMap.get(requestId);
                                scanResolveMap.delete(requestId);
                                if (r) r(result);
                                unlisten();
                            }
                        });
                        await api.scan.scanPhotos(requestId, scan);
                    } catch (e) {
                        scanResolveMap.delete(requestId);
                        reject(e);
                    }
                })();
            });
        },

        // ---------- 目录与配置 ----------
        chooseDirectory: () => {
            if (!isTauri()) return (window as any).electronAPI?.api?.chooseDirectory?.();
            return (async () => {
                const { open } = await import("@tauri-apps/plugin-dialog");
                const selected = await open({ directory: true, multiple: false });
                const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
                return { filePaths: paths };
            })();
        },
        getDirectory: (name: string) => {
            if (!isTauri()) return (window as any).electronAPI?.api?.getDirectory?.(name);
            return ensureInvoke().then((invoke) =>
                invoke<string | null>("get_directory", { name }),
            );
        },

        // ---------- 缩略图 ----------
        createThumbnail: (request: ThumbnailRequest) => api.thumbnail.create(request),
        removeThumbnail: (request: ThumbnailRequest) => api.thumbnail.remove(request),
        getImageType: (path: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<string>("get_image_type", { path }))
                : stubAsync(),
        getFileMetadata: (path: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) =>
                      invoke("get_file_metadata", {
                          path: webviewMediaUrlToAbsolutePath(path),
                      }),
                  )
                : stubAsync(),
        fileUrlFromPath: (path: string) =>
            isTauri()
                ? Promise.resolve(toWebviewMediaUrl(webviewMediaUrlToAbsolutePath(path)))
                : Promise.resolve(path.startsWith("/") ? `file://${path}` : `file:///${path}`),

        // ---------- 配置内容级 (RFC 0077-0081) ----------
        addToPhotoList: (photoPath: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke("add_to_photo_list", { photoPath }))
                : stubAsync(),
        removeFromPhotoList: (photoPath: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke("remove_from_photo_list", { photoPath }))
                : stubAsync(),
        getPhotasaConfig: (folder: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke("get_photasa_config", { folder }))
                : stubAsync(),
        scanSubfolders: (folderPath: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<string[]>("sub_folders", { folderPath }))
                : stubAsync(),
        checkPhotasaConfig: (folderPath: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) =>
                      invoke<boolean>("check_photasa_config", { folderPath }),
                  )
                : stubAsync(),
        fixPhotasaConfig: (folder: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke("fix_photasa_config", { folder }))
                : stubAsync(),
        resetPhotasaConfig: (folder: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke("reset_photasa_config", { folder }))
                : stubAsync(),

        // ---------- 路径与工具 ----------
        isFileUnderFolder: (file: string, folder: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) =>
                      invoke<boolean>("is_file_under_folder", { file, folder }),
                  )
                : Promise.resolve(
                      Boolean((window as any).electronAPI?.api?.isFileUnderFolder?.(file, folder)),
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
        // Electron `query-config.cleanupScanQueue` 为空实现，Tauri 对齐为同步空操作
        cleanupScanQueue: (_folderPath: string) => undefined,
        mergePath: (left: string, right = "") =>
            isTauri() && right
                ? ensureInvoke().then((invoke) => invoke<string>("merge_path", { left, right }))
                : right
                  ? `${left.replace(/[/\\]+$/, "")}/${right.replace(/^[/\\]+/, "")}`
                  : left,
        splitPath: (path: string) => path.split(/[/\\]/).filter(Boolean),
        joinPath: (...parts: string[]) => parts.filter(Boolean).join("/"),
        getSeparator: () =>
            isTauri() ? ensureInvoke().then((invoke) => invoke<string>("get_separator")) : "/",
        normalizePath: (path: string) =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<string>("normalize_path", { path }))
                : Promise.resolve(path?.replace(/\\/g, "/").replace(/\/+/g, "/") ?? ""),
        isMac: async () => {
            if (!isTauri()) return (window as any).electronAPI?.api?.isMac?.() ?? false;
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
        /** RFC 0099：Tauri 调 Rust `reload_window`；Electron 无 preload 项时用 `location.reload` */
        reloadWindow: () => {
            if (!isTauri()) {
                const elApi = (
                    window as { electronAPI?: { api?: { reloadWindow?: () => Promise<void> } } }
                ).electronAPI?.api;
                if (typeof elApi?.reloadWindow === "function") return elApi.reloadWindow();
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
                : ((window as any).electronAPI?.api?.checkForUpdates?.() ?? stubAsync()),
        downloadUpdate: () =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<void>("download_update"))
                : ((window as any).electronAPI?.api?.downloadUpdate?.() ?? stubAsync()),
        installUpdate: () =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<void>("install_update"))
                : ((window as any).electronAPI?.api?.installUpdate?.() ?? stubAsync()),
        getUpdateStatus: () =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke("get_update_status"))
                : ((window as any).electronAPI?.api?.getUpdateStatus?.() ?? stubAsync()),
        getAppVersion: () =>
            isTauri()
                ? ensureInvoke().then((invoke) => invoke<string>("get_app_version"))
                : ((window as any).electronAPI?.api?.getAppVersion?.() ?? Promise.resolve("")),
        updateAutoUpdateConfig: (config: unknown) =>
            isTauri()
                ? ensureInvoke().then((invoke) =>
                      invoke<boolean>("update_auto_update_config", { patch: config }),
                  )
                : ((window as any).electronAPI?.api?.updateAutoUpdateConfig?.(config) ??
                  stubAsync()),
        onUpdateProgress: (cb: (progress: number) => void) => {
            if (!isTauri()) {
                return (window as any).electronAPI?.api?.onUpdateProgress?.(cb) ?? noopListener();
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
                return (window as any).electronAPI?.api?.onUpdateDownloaded?.(cb) ?? noopListener();
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
                return (window as any).electronAPI?.api?.onUpdateError?.(cb) ?? noopListener();
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
                return (window as any).electronAPI?.api?.onUpdateAvailable?.(cb) ?? noopListener();
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
                return (window as any).electronAPI?.api?.onStatusChanged?.(cb) ?? noopListener();
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
                (window as any).electronAPI?.api?.removeAllUpdateListeners?.();
                return;
            }
            const subs = getUpdateUnsubs();
            while (subs.length) {
                subs.pop()?.();
            }
        },

        // ---------- 导入增强 ----------
        scanDirectories: (paths: string[], filters?: unknown) =>
            isTauri()
                ? ensureInvoke().then((invoke) =>
                      invoke("scan_directories", { paths, filters: filters ?? null }),
                  )
                : ((window as any).electronAPI?.api?.scanDirectories?.(paths, filters) ??
                  stubAsync()),
        previewImport: (config: unknown) =>
            isTauri()
                ? (async () => {
                      const invoke = await ensureInvoke();
                      return await invoke<ImportPreview>("preview_import", { config });
                  })()
                : ((window as any).electronAPI?.api?.previewImport?.(config) ?? stubAsync()),
        executeImport: (config: ImportConfig): Promise<{ importId: string }> =>
            api.import.execute(config as ImportConfig).then((id) => ({ importId: id })),
        onImportProgress: (callback: (progress: ImportProgress) => void) => {
            if (!isTauri()) {
                return (
                    (window as any).electronAPI?.api?.onImportProgress?.(callback) ?? noopListener()
                );
            }
            void api.import.onProgress(callback).then((un) => {
                getImportUnsubs().push(un);
            });
            return () => {
                /* 单次清理由 removeImportListeners 统一处理 */
            };
        },
        onPreviewProgress: (cb: (progress: unknown, files?: unknown[]) => void) => {
            if (!isTauri()) {
                return (window as any).electronAPI?.api?.onPreviewProgress?.(cb) ?? noopListener();
            }
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen(EVENT_IMPORT_PREVIEW_PROGRESS, (e) => {
                    const payload = e.payload as {
                        progress?: unknown;
                        files?: unknown[];
                    };
                    if (payload && typeof payload === "object" && "progress" in payload) {
                        cb(payload.progress, payload.files);
                    } else {
                        cb(e.payload, undefined);
                    }
                }).then((un) => getImportUnsubs().push(un));
            });
            return () => {};
        },
        onImportComplete: (cb: (result: any) => void) => {
            if (!isTauri()) {
                return (window as any).electronAPI?.api?.onImportComplete?.(cb) ?? noopListener();
            }
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen("import:complete", (e) => cb(e.payload)).then((un) =>
                    getImportUnsubs().push(un),
                );
            });
            return () => {};
        },
        onImportError: (cb: (error: any) => void) => {
            if (!isTauri()) {
                return (window as any).electronAPI?.api?.onImportError?.(cb) ?? noopListener();
            }
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen("import:error", (e) => cb(e.payload)).then((un) =>
                    getImportUnsubs().push(un),
                );
            });
            return () => {};
        },
        removeImportListeners: () => {
            if (!isTauri()) {
                (window as any).electronAPI?.api?.removeImportListeners?.();
                return;
            }
            const subs = getImportUnsubs();
            while (subs.length) {
                subs.pop()?.();
            }
        },
        cancelImport: (importId: string) => api.import.cancel(importId).then(() => true),
        pauseImport: (importId: string) => api.import.pause(importId).then(() => true),
        resumeImport: (importId: string) => api.import.resume(importId),
        getImportHistory: (limit?: number) =>
            isTauri()
                ? (async () => {
                      const invoke = await ensureInvoke();
                      const rows = await invoke<ImportHistory[]>("get_import_history", { limit });
                      return Array.isArray(rows) ? rows : [];
                  })()
                : ((window as any).electronAPI?.api?.getImportHistory?.(limit) ?? stubAsync()),
        getImportDetails: (historyId: string) =>
            isTauri()
                ? (async () => {
                      const invoke = await ensureInvoke();
                      const row = await invoke<ImportHistory | null>("get_import_details", {
                          historyId,
                      });
                      return row ?? null;
                  })()
                : ((window as any).electronAPI?.api?.getImportDetails?.(historyId) ?? stubAsync()),
        previewUndo: (historyId: string) =>
            isTauri()
                ? (async () => {
                      const invoke = await ensureInvoke();
                      const raw = await invoke<unknown>("preview_undo_import", { historyId });
                      return normalizeUndoPreviewFromRust(raw, historyId);
                  })()
                : ((window as any).electronAPI?.api?.previewUndo?.(historyId) ?? stubAsync()),
        undoImport: (historyId: string) =>
            isTauri()
                ? (async () => {
                      const invoke = await ensureInvoke();
                      const raw = await invoke<unknown>("undo_import_execute", { historyId });
                      return normalizeUndoResultFromRust(raw);
                  })()
                : ((window as any).electronAPI?.api?.undoImport?.(historyId) ?? stubAsync()),
        getImportProgress: (importId: string) =>
            isTauri()
                ? (async () => {
                      const invoke = await ensureInvoke();
                      const raw = await invoke<unknown>("get_import_progress", { importId });
                      return normalizeImportProgressPayload(raw);
                  })()
                : ((window as any).electronAPI?.api?.getImportProgress?.(importId) ?? stubAsync()),
        getRecoverableImports: () =>
            isTauri()
                ? (async () => {
                      const invoke = await ensureInvoke();
                      const rows = await invoke<unknown[]>("get_recoverable_imports");
                      return Array.isArray(rows) ? rows.map(normalizeRecoverableImport) : [];
                  })()
                : ((window as any).electronAPI?.api?.getRecoverableImports?.() ??
                  Promise.resolve([])),
        cleanupRecoverableImport: (importId: string) =>
            isTauri()
                ? (async () => {
                      const invoke = await ensureInvoke();
                      const raw = await invoke<unknown>("cleanup_recoverable_import", { importId });
                      return normalizeRecoverableImportActionResult(raw);
                  })()
                : ((window as any).electronAPI?.api?.cleanupRecoverableImport?.(importId) ??
                  stubAsync()),
        keepRecoverableImport: (importId: string) =>
            isTauri()
                ? (async () => {
                      const invoke = await ensureInvoke();
                      const raw = await invoke<unknown>("keep_recoverable_import", { importId });
                      return normalizeRecoverableImportActionResult(raw);
                  })()
                : ((window as any).electronAPI?.api?.keepRecoverableImport?.(importId) ??
                  stubAsync()),
        chooseDirectories: (multiSelect = true) => api.import.chooseDirectories(multiSelect),
        extractMetadata: (request: unknown) =>
            isTauri()
                ? (async () => {
                      const invoke = await ensureInvoke();
                      const raw = await invoke<unknown>("extract_metadata", { request });
                      return normalizeFileMetadataFromRust(raw);
                  })()
                : ((window as any).electronAPI?.api?.extractMetadata?.(request) ?? stubAsync()),
        onScanQueueAdd: (cb: (operations: unknown[]) => void) => {
            if (!isTauri()) {
                return (window as any).electronAPI?.api?.onScanQueueAdd?.(cb) ?? noopListener();
            }
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen(EVENT_SCAN_QUEUE_ADD, (e) => cb((e.payload as unknown[]) ?? [])).then((un) =>
                    getImportUnsubs().push(un),
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
                    : ((window as any).electronAPI?.api?.log?.viewerOpen?.() ?? stubAsync()),
            viewerClose: () =>
                isTauri()
                    ? ensureInvoke().then((invoke) =>
                          invoke<{ success: boolean; message: string }>("log_viewer_close"),
                      )
                    : ((window as any).electronAPI?.api?.log?.viewerClose?.() ?? stubAsync()),
            onEntry: (callback: (entry: unknown) => void) => {
                if (!isTauri()) {
                    return (
                        (window as any).electronAPI?.api?.log?.onEntry?.(callback) ?? noopListener()
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
                        (window as any).electronAPI?.api?.log?.onToggleViewer?.(callback) ??
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
            const normalized = path.replace(/\\/g, "/");
            if (normalized.startsWith("/")) {
                return Promise.resolve("/");
            }
            const m = /^([A-Za-z]:)(\/|$)/.exec(normalized);
            if (m) {
                return Promise.resolve(m[2] === "/" ? `${m[1]}/` : m[1]);
            }
            return Promise.resolve("");
        },
    };
}
