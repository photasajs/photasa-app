import fs from "fs-extra";
import path from "path";
import createHeifModule from "@saschazar/wasm-heif";
import { getLogger } from "@common/logger";
import { app } from "electron";

const logger = getLogger("heif-module");

interface HeifModuleState {
    module: any;
    initialized: boolean;
}

let heifState: HeifModuleState = {
    module: null,
    initialized: false,
};

/**
 * 获取应用程序路径（兼容worker线程）
 */
function getAppPath(): string {
    try {
        // 尝试从electron获取（主进程）
        return app.getAppPath();
    } catch {
        // 在worker线程中，使用环境变量或进程路径
        if (process.env.APP_PATH) {
            return process.env.APP_PATH;
        }
        // 回退到进程执行路径
        return process.cwd();
    }
}

/**
 * Initialize and cache the HEIF WASM module.
 * Strategy: try default init first; fallback to explicit wasmBinary under resources.
 */
export async function initializeHeifModule(): Promise<any> {
    if (heifState.initialized && heifState.module) return heifState.module;

    try {
        // 首先尝试默认初始化

        const module = await createHeifModule();
        heifState = { module, initialized: true };
        logger.info("HEIF module initialized successfully (default method)");
        return module;
    } catch (defaultError) {
        logger.warn("Default HEIF module initialization failed, trying fallback", defaultError);

        const appPath = getAppPath();

        // 尝试多个可能的WASM文件位置
        const possiblePaths = [
            // 在生产环境中，资源通常在app.getAppPath()下
            path.join(appPath, "resources", "wasm_heif.wasm"),
            // 开发环境中的路径
            path.join(__dirname, "../../../resources/wasm_heif.wasm"),
            // 编译后可能的路径（out目录）
            path.join(appPath, "..", "..", "resources", "wasm_heif.wasm"),
            // 直接在项目根目录下
            path.join(process.cwd(), "resources", "wasm_heif.wasm"),
            // ASAR解压路径
            path.join(appPath, "..", "app.asar.unpacked", "resources", "wasm_heif.wasm"),
        ];

        for (const wasmPath of possiblePaths) {
            if (await fs.pathExists(wasmPath)) {
                try {
                    const wasmBinary = await fs.readFile(wasmPath);

                    const module = await createHeifModule({ wasmBinary } as any);
                    heifState = { module, initialized: true };
                    logger.info(`HEIF module initialized successfully from ${wasmPath}`);
                    return module;
                } catch (loadError) {
                    logger.error(`Failed to load HEIF module from ${wasmPath}:`, loadError);
                }
            }
        }

        // 列出可能的目录内容以帮助调试
        const checkDirs = [appPath, path.join(appPath, ".."), process.cwd()];
        for (const dir of checkDirs) {
            try {
                await fs.readdir(dir);
            } catch {}
        }

        throw new Error("HEIF WASM module not found in any expected location");
    }
}

/** Reset module (useful for tests) */
export function resetHeifModule(): void {
    heifState = { module: null, initialized: false };
}
