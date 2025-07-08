// toolkit electronAPI 类型（可根据 @electron-toolkit/preload 类型声明导入）
declare global {
    interface Window {
        electron: typeof import("@electron-toolkit/preload").electronAPI;
        api: typeof import("@preload/index").api & {
            normalizePath: (p: string) => string;
            mergePath: (left: string, right?: string) => string;
            isMac: () => boolean;
        };
    }
}
export {};
