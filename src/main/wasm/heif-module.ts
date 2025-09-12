import fs from "fs-extra";
import path from "path";
import createHeifModule from "@saschazar/wasm-heif";
import { getLogger } from "@common/logger";
import { getAppPath } from "@shared/path-util";
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
 * Initialize and cache the HEIF WASM module.
 * Strategy: Use resources directory approach directly to avoid URL parsing issues.
 */
export async function initializeHeifModule(): Promise<any> {
    if (heifState.initialized && heifState.module) {
        return heifState.module;
    }

    const appPath = getAppPath(app);
    logger.debug(`App path: ${appPath}`);
    logger.debug(`__dirname: ${__dirname}`);
    logger.debug(`process.cwd(): ${process.cwd()}`);
    logger.debug(`process.resourcesPath: ${process.resourcesPath}`);

    // 使用项目resources目录中的WASM文件（会被Electron打包）
    const possiblePaths = [
        // 优先：使用process.resourcesPath（Electron标准方式）
        ...(process.resourcesPath ? [path.join(process.resourcesPath, "wasm_heif.wasm")] : []),
        // 开发环境：相对于编译后的代码位置
        path.join(__dirname, "../../../resources/wasm_heif.wasm"),
        // 开发环境：相对于项目根目录
        path.join(process.cwd(), "resources", "wasm_heif.wasm"),
        // 生产环境：相对于app路径
        path.join(appPath, "resources", "wasm_heif.wasm"),
        // ASAR解压路径
        path.join(appPath, "..", "app.asar.unpacked", "resources", "wasm_heif.wasm"),
        // 备用：相对于当前工作目录
        path.resolve("resources", "wasm_heif.wasm"),
    ];

    logger.debug(`Checking ${possiblePaths.length} possible paths for WASM file`);

    for (const wasmPath of possiblePaths) {
        logger.debug(`Checking path: ${wasmPath}`);
        if (await fs.pathExists(wasmPath)) {
            logger.info(`Found WASM file at: ${wasmPath}`);
            try {
                const wasmBinary = await fs.readFile(wasmPath);
                logger.debug(`WASM file size: ${wasmBinary.length} bytes`);
                const module = await createHeifModule({ wasmBinary } as any);
                heifState = { module, initialized: true };
                logger.info(`HEIF module initialized successfully from ${wasmPath}`);
                return module;
            } catch (loadError) {
                logger.error(`Failed to load HEIF module from ${wasmPath}:`, loadError);
            }
        } else {
            logger.debug(`Path does not exist: ${wasmPath}`);
        }
    }

    // 如果resources目录方法失败，则尝试默认初始化作为最后的后备
    logger.warn("No WASM file found in any expected location, attempting default initialization");
    try {
        const module = await createHeifModule();
        heifState = { module, initialized: true };
        logger.info("HEIF module initialized successfully (default fallback method)");
        return module;
    } catch (defaultError) {
        logger.error("Default HEIF module initialization also failed", defaultError);
    }

    throw new Error("HEIF WASM module not found in any expected location");
}

/** Reset module (useful for tests) */
export function resetHeifModule(): void {
    heifState = { module: null, initialized: false };
}
