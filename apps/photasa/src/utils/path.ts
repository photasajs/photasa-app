import { normalizePathSync, mergePathSync } from "@renderer/utils/sync-path";

export function normalizePath(path: string): string {
    return normalizePathSync(path);
}

export function mergePath(left: string, right = ""): string {
    return mergePathSync(left, right);
}
