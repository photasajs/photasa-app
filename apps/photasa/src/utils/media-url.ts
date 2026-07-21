/**
 * 本地媒体 → WebView 可加载 URL（Tauri asset 协议）
 *
 * Tauri WebView 禁止 `<img src="file://...">`（CSP + 引擎限制）。
 * 正确链路：磁盘路径 → `convertFileSrc()` → `asset://localhost/...`（macOS/Linux）
 * 或 `http(s)://asset.localhost/...`（Windows/Android），并由 `tauri.conf.json` 的
 * `security.assetProtocol.scope` 授权路径。
 */
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

const ASSET_HTTP_HOSTS = ["https://asset.localhost", "http://asset.localhost"] as const;
const ASSET_SCHEME_PREFIX = "asset://";

/** 文件夹 + 相对路径 → 绝对文件系统路径（POSIX 斜杠，不 URL 编码） */
export function toAbsoluteMediaPath(currentFolder: string, file: string): string {
    const normalizedFolder = currentFolder.replace(/\\/g, "/");
    const normalizedFile = file.replace(/\\/g, "/");

    const cleanFolder = normalizedFolder.startsWith("/")
        ? normalizedFolder
        : `/${normalizedFolder}`;
    const trimmedFolder = cleanFolder.endsWith("/") ? cleanFolder.slice(0, -1) : cleanFolder;
    const cleanFile = normalizedFile.startsWith("/") ? normalizedFile.slice(1) : normalizedFile;

    return `${trimmedFolder}/${cleanFile}`;
}

/** 绝对路径 → file:// URL（contract reference / 纯 Vitest，非 Tauri WebView） */
export function toFileUrlFromAbsolutePath(absolutePath: string): string {
    const normalized = absolutePath.replace(/\\/g, "/");
    const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;

    const encoded = withLeadingSlash
        .split("/")
        .map((segment) => (segment === "" ? "" : encodeURIComponent(segment)))
        .join("/");

    return `file://${encoded}`;
}

function isTauriRuntime(): boolean {
    try {
        if (isTauri()) {
            return true;
        }
    } catch {
        /* 非浏览器环境 */
    }
    if (typeof window === "undefined") {
        return false;
    }
    const internals = (window as Window & { __TAURI_INTERNALS__?: { convertFileSrc?: unknown } })
        .__TAURI_INTERNALS__;
    return typeof internals?.convertFileSrc === "function";
}

/** 已是 Tauri asset / http(s) asset.localhost URL */
export function isAssetWebviewUrl(url: string): boolean {
    const trimmed = url.trim();
    return (
        trimmed.startsWith(ASSET_SCHEME_PREFIX) ||
        ASSET_HTTP_HOSTS.some((host) => trimmed.startsWith(host))
    );
}

/** 从 Tauri asset URL 解码出磁盘绝对路径（与 convertFileSrc 编码方式对称） */
export function parseAssetWebviewUrl(url: string): string {
    const trimmed = url.trim();

    if (trimmed.startsWith(ASSET_SCHEME_PREFIX)) {
        const slash = trimmed.indexOf("/", ASSET_SCHEME_PREFIX.length);
        const encoded = slash >= 0 ? trimmed.slice(slash + 1) : "";
        return decodeURIComponent(encoded);
    }

    for (const host of ASSET_HTTP_HOSTS) {
        if (trimmed.startsWith(host)) {
            const encoded = trimmed.slice(host.length + 1);
            return decodeURIComponent(encoded);
        }
    }

    return trimmed;
}

/** WebView URL（asset / file）或磁盘路径 → 磁盘绝对路径，供 Rust invoke 使用 */
export function webviewMediaUrlToAbsolutePath(urlOrPath: string): string {
    const trimmed = urlOrPath.trim();
    if (!trimmed) {
        return trimmed;
    }

    if (isAssetWebviewUrl(trimmed)) {
        return parseAssetWebviewUrl(trimmed);
    }

    if (trimmed.startsWith("file://")) {
        try {
            return decodeURIComponent(new URL(trimmed).pathname);
        } catch {
            return trimmed.replace(/^file:\/\//, "");
        }
    }

    return trimmed;
}

/** 绝对路径 → 当前运行时 WebView 可加载的 src */
export function toWebviewMediaUrl(absolutePath: string): string {
    if (isTauriRuntime()) {
        return convertFileSrc(absolutePath);
    }
    return toFileUrlFromAbsolutePath(absolutePath);
}

/**
 * 任意输入 → WebView 可加载 URL。
 * 兼容遗留 `file://`、asset URL、磁盘绝对路径。
 */
export function ensureWebviewMediaUrl(urlOrPath: string): string {
    const trimmed = urlOrPath.trim();
    if (!trimmed) {
        return trimmed;
    }

    if (isTauriRuntime()) {
        if (isAssetWebviewUrl(trimmed)) {
            return trimmed;
        }
        const absolute = webviewMediaUrlToAbsolutePath(trimmed);
        return convertFileSrc(absolute);
    }

    if (trimmed.startsWith("file://") || isAssetWebviewUrl(trimmed)) {
        return trimmed;
    }

    if (trimmed.startsWith("/") || /^[A-Za-z]:[/\\]/.test(trimmed)) {
        return toFileUrlFromAbsolutePath(trimmed.replace(/\\/g, "/"));
    }

    return trimmed;
}

/** 源图绝对路径 → `.photasaoriginals/thumbnail-*.png` 绝对路径 */
export function absoluteThumbnailPathForSource(sourcePath: string): string {
    const absolute = webviewMediaUrlToAbsolutePath(sourcePath);
    const normalized = absolute.replace(/\\/g, "/");
    const slash = normalized.lastIndexOf("/");
    const folder = slash >= 0 ? normalized.slice(0, slash) : normalized;
    const fileName = slash >= 0 ? normalized.slice(slash + 1) : normalized;
    return `${folder}/.photasaoriginals/thumbnail-${fileName}.png`;
}
