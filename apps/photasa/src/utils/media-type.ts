const VIDEO_EXTS = new Set([
    "mp4",
    "mov",
    "avi",
    "mkv",
    "m4v",
    "3gp",
    "wmv",
    "flv",
    "webm",
    "mpg",
    "mpeg",
    "m2v",
    "mts",
    "m2ts",
    "ts",
    "vob",
    "rmvb",
    "rm",
]);

export function isVideoPath(path: string): boolean {
    const fileName = path.replace(/\\/g, "/").split("/").pop() ?? "";
    const dot = fileName.lastIndexOf(".");
    if (dot <= 0 || dot === fileName.length - 1) {
        return false;
    }
    return VIDEO_EXTS.has(fileName.slice(dot + 1).toLowerCase());
}
