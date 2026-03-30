export function normalizePath(path: string): string {
    return window.api.normalizePath(path);
}

export function mergePath(left: string, right = ""): string {
    return window.api.mergePath(left, right);
}
