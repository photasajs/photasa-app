/**
 * Jest setup file for main process tests
 * 为main进程测试提供Jest环境设置
 */

// Mock sharp module to avoid platform-specific errors
jest.mock("sharp", () => ({
    default: jest.fn().mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({
            width: 100,
            height: 100,
            format: "jpeg",
        }),
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        png: jest.fn().mockReturnThis(),
        webp: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from("mock-image-data")),
    })),
}));

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

// Mock fs-extra
jest.mock("fs-extra", () => ({
    ensureDir: jest.fn().mockResolvedValue(undefined),
    pathExists: jest.fn().mockResolvedValue(true),
    readFile: jest.fn().mockResolvedValue("mock file content"),
    writeFile: jest.fn().mockResolvedValue(undefined),
    copyFile: jest.fn().mockResolvedValue(undefined),
    move: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date(),
    }),
    readdir: jest.fn().mockResolvedValue(["file1.jpg", "file2.png"]),
}));

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

// 设置测试超时
jest.setTimeout(15000);
