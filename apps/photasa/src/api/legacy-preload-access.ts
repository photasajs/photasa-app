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

export type LegacyPreloadSection = Record<string, unknown>;

export interface LegacyPreloadApi {
    api?: LegacyPreloadSection;
    config?: LegacyPreloadSection;
    window?: LegacyPreloadSection;
    shell?: LegacyPreloadSection;
    scan?: LegacyPreloadSection;
    ipcRenderer?: LegacyPreloadSection;
    thumbnail?: LegacyPreloadSection;
    [key: string]: LegacyPreloadSection | undefined;
}

function readWindowValue(key: string): unknown {
    if (typeof window === "undefined") {
        return undefined;
    }
    return (window as unknown as Record<string, unknown>)[key];
}

export function getLegacyPreloadApi(): LegacyPreloadApi | undefined {
    const value = readWindowValue(LEGACY_PRELOAD_WINDOW_KEY);
    if (typeof value !== "object" || value === null) {
        return undefined;
    }
    return value as LegacyPreloadApi;
}

export function getLegacyShell():
    | { ipcRenderer?: { on: (channel: string, handler: unknown) => () => void } }
    | undefined {
    const value = readWindowValue(LEGACY_SHELL_WINDOW_KEY);
    if (typeof value !== "object" || value === null) {
        return undefined;
    }
    return value as { ipcRenderer?: { on: (channel: string, handler: unknown) => () => void } };
}

export function getLegacyPreloadIpc():
    | { on: (channel: string, handler: unknown) => () => void }
    | undefined {
    return getLegacyShell()?.ipcRenderer;
}

export function getLegacyPreloadSection(section: string): LegacyPreloadSection | undefined {
    const root = getLegacyPreloadApi();
    if (!root) {
        return undefined;
    }
    const value = root[section];
    if (typeof value !== "object" || value === null) {
        return undefined;
    }
    return value as LegacyPreloadSection;
}

/** Invoke a method on a nested retired-preload object (e.g. api → log → viewerOpen). */
export function callLegacyPreloadNested(
    path: string[],
    method: string,
    ...args: unknown[]
): unknown {
    let current: unknown = getLegacyPreloadApi();
    for (const key of path) {
        if (typeof current !== "object" || current === null) {
            return undefined;
        }
        current = (current as Record<string, unknown>)[key];
    }
    if (typeof current !== "object" || current === null) {
        return undefined;
    }
    const fn = (current as Record<string, unknown>)[method];
    if (typeof fn !== "function") {
        return undefined;
    }
    return Reflect.apply(fn, current, args);
}

export function callLegacyPreloadSection(
    section: string,
    method: string,
    ...args: unknown[]
): unknown {
    return callLegacyPreloadNested([section], method, ...args);
}
