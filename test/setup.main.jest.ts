/**
 * Jest setup file for main process tests
 * 为main进程测试提供Jest环境设置
 */

// 不再mock Sharp - 让真实的图像处理库正常工作
// Sharp是标准的Node.js图像处理库，在测试环境中应该正常工作

// Mock electron module
jest.mock("electron", () => ({
    app: {
        getPath: jest.fn().mockReturnValue("/mock/path"),
        getName: jest.fn().mockReturnValue("Photasa"),
        getVersion: jest.fn().mockReturnValue("1.0.0"),
        isReady: jest.fn().mockReturnValue(true),
        whenReady: jest.fn().mockResolvedValue(undefined),
    },
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
        loadFile: jest.fn(),
        loadURL: jest.fn(),
        webContents: {
            send: jest.fn(),
            on: jest.fn(),
        },
        on: jest.fn(),
        close: jest.fn(),
        destroy: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        minimize: jest.fn(),
        maximize: jest.fn(),
        unmaximize: jest.fn(),
        isMinimized: jest.fn().mockReturnValue(false),
        isMaximized: jest.fn().mockReturnValue(false),
        isVisible: jest.fn().mockReturnValue(true),
        setMenuBarVisibility: jest.fn(),
        setAutoHideMenuBar: jest.fn(),
    })),
    Menu: {
        buildFromTemplate: jest.fn(),
        setApplicationMenu: jest.fn(),
    },
    dialog: {
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn(),
        showMessageBox: jest.fn(),
    },
    shell: {
        openExternal: jest.fn(),
        showItemInFolder: jest.fn(),
    },
    nativeImage: {
        createFromPath: jest.fn(),
        createFromBuffer: jest.fn(),
    },
}));

// 不再mock fs - 让文件系统操作正常工作
// fs mock已移除，测试将使用真实的文件系统

// 不再mock fs-extra - 让扩展文件操作正常工作
// fs-extra mock已移除，测试将使用真实的文件系统操作

// 不再mock Jimp - 让真实的图像处理库正常工作
// Jimp是我们BmpBrush的核心功能，应该测试真实的行为

// Mock worker_threads
jest.mock("worker_threads", () => ({
    Worker: jest.fn().mockImplementation(() => ({
        postMessage: jest.fn(),
        on: jest.fn(),
        terminate: jest.fn(),
        ref: jest.fn(),
        unref: jest.fn(),
    })),
    isMainThread: true,
    parentPort: null,
}));

// Mock process.resourcesPath for Electron
Object.defineProperty(process, "resourcesPath", {
    value: "/mock/resources/path",
    writable: true,
    configurable: true,
});

// Don't mock MaLiang - we want to test the real integration!

// Mock heif-module to avoid resourcesPath issues
jest.mock("../src/main/wasm/heif-module", () => ({
    initializeHeifModule: jest.fn().mockResolvedValue(undefined),
    resetHeifModule: jest.fn().mockResolvedValue(undefined),
}));

// 设置测试超时
jest.setTimeout(15000);
