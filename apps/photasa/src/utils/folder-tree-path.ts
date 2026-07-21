/** 仅接受 string；其它类型返回空串，避免 path.replace 在启动对齐时抛错 */
export function canonicalFolderPath(path: unknown): string {
    if (typeof path !== "string") {
        return "";
    }
    const trimmed = path.trim();
    if (!trimmed) {
        return "";
    }
    const normalized = trimmed.replace(/\\/g, "/").replace(/\/+/g, "/");
    if (normalized.length > 1 && normalized.endsWith("/")) {
        return normalized.slice(0, -1);
    }
    return normalized;
}

/** 同步拼接目录段（禁止走 window.api.mergePath — Tauri 下会返回 Promise，破坏去重） */
export function joinFolderSegment(parentPath: string, segment: string): string {
    const base = canonicalFolderPath(parentPath);
    const part =
        typeof segment === "string"
            ? segment
                  .trim()
                  .replace(/^[/\\]+/, "")
                  .replace(/[/\\]+$/, "")
            : "";
    if (!base || !part) {
        return base;
    }
    return canonicalFolderPath(`${base}/${part}`);
}

/** 由根路径 + 段列表拼出完整目录 key */
export function buildFolderKey(rootPath: string, segments: readonly string[]): string {
    let current = canonicalFolderPath(rootPath);
    for (const segment of segments) {
        current = joinFolderSegment(current, segment);
    }
    return current;
}

const INVALID_FOLDER_KEY_STRINGS = new Set(["[object Object]", "[object Promise]"]);

function isUsableFolderKeyString(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 && !INVALID_FOLDER_KEY_STRINGS.has(trimmed);
}

/**
 * 将树节点 key 解析为父目录下的完整路径。
 * 修复历史脏数据：key 为 Promise 序列化 `{}`、仅段名 `2018`、或缺失时用 title 恢复。
 */
export function resolveFolderNodeKey(
    parentKey: string,
    node: { key: unknown; title?: unknown },
): string | null {
    const parent = canonicalFolderPath(parentKey);
    if (!parent) {
        return null;
    }

    if (isUsableFolderKeyString(node.key)) {
        const normalized = canonicalFolderPath(node.key);
        if (normalized === parent || normalized.startsWith(`${parent}/`)) {
            return normalized;
        }
        if (!normalized.includes("/")) {
            return joinFolderSegment(parent, normalized);
        }
        return normalized;
    }

    if (typeof node.title === "string" && node.title.trim()) {
        return joinFolderSegment(parent, node.title);
    }

    return null;
}

export function isPathUnderRoot(childPath: string, rootPath: string): boolean {
    const child = canonicalFolderPath(childPath);
    const root = canonicalFolderPath(rootPath);
    if (!child || !root) {
        return false;
    }
    return child === root || child.startsWith(`${root}/`);
}

/** 在多个根节点中选取最长前缀匹配（避免 `/Volumes/SUCAI` 抢在 `/Volumes/SUCAI/Test` 前） */
export function findLongestRootKey(
    candidatePath: string,
    rootKeys: readonly string[],
): string | null {
    const child = canonicalFolderPath(candidatePath);
    let best: string | null = null;

    for (const key of rootKeys) {
        const root = canonicalFolderPath(key);
        if (!isPathUnderRoot(child, root)) {
            continue;
        }
        if (!best || root.length > best.length) {
            best = root;
        }
    }

    return best;
}

/** 取 folderPath 相对 rootPath 的路径段（folderPath 为目录本身） */
export function folderSegmentsUnderRoot(folderPath: string, rootPath: string): string[] {
    const child = canonicalFolderPath(folderPath);
    const root = canonicalFolderPath(rootPath);
    if (!isPathUnderRoot(child, root) || child === root) {
        return [];
    }
    return child
        .slice(root.length + 1)
        .split("/")
        .filter(Boolean);
}
