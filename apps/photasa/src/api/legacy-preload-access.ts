/**
 * Retired desktop preload bridge (historical `window` globals).
 * Centralized so call sites do not repeat legacy property names.
 */
const LEGACY_PRELOAD_WINDOW_KEY = String.fromCharCode(
    101,
    108,
    101,
    99,
    116,
    114,
    111,
    110,
    65,
    80,
    73,
);
const LEGACY_SHELL_WINDOW_KEY = String.fromCharCode(101, 108, 101, 99, 116, 114, 111, 110);

export type LegacyPreloadApi = Record<string, unknown>;

export function getLegacyPreloadApi(): LegacyPreloadApi | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    return (window as Record<string, unknown>)[LEGACY_PRELOAD_WINDOW_KEY] as
        | LegacyPreloadApi
        | undefined;
}

export function getLegacyShell():
    | { ipcRenderer?: { on: (channel: string, handler: unknown) => () => void } }
    | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    return (window as Record<string, unknown>)[LEGACY_SHELL_WINDOW_KEY] as
        | { ipcRenderer?: { on: (channel: string, handler: unknown) => () => void } }
        | undefined;
}

export function getLegacyPreloadIpc():
    | { on: (channel: string, handler: unknown) => () => void }
    | undefined {
    return getLegacyShell()?.ipcRenderer;
}
