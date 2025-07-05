/**
 * 判断是否为 Mac 系统
 * @returns 是否为 Mac 系统
 */
export function isMac() {
    return process.platform === "darwin";
}

/**
 * 判断是否为 Windows 系统
 * @returns 是否为 Windows 系统
 */
export function isWin() {
    return process.platform === "win32";
}

/**
 * 判断是否为 Linux 系统
 * @returns 是否为 Linux 系统
 */
export function isLinux() {
    return process.platform === "linux";
}
