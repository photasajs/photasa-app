export function normalizePath(path: string): string {
    // regex to append slash to the end of the path
    return path.replace(/\/$/, "") + "/";
}
