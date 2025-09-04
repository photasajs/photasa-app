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

    // 使用项目resources目录中的WASM文件（会被Electron打包）
    const possiblePaths = [
        // 开发环境：相对于编译后的代码位置
        path.join(__dirname, "../../../resources/wasm_heif.wasm"),
        // 生产环境：相对于app路径
        path.join(appPath, "resources", "wasm_heif.wasm"),
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

    // 如果resources目录方法失败，则尝试默认初始化作为最后的后备
    try {
        const module = await createHeifModule();
        heifState = { module, initialized: true };
        logger.info("HEIF module initialized successfully (default fallback method)");
        return module;
    } catch (defaultError) {
        logger.warn("Default HEIF module initialization also failed", defaultError);
    }

    throw new Error("HEIF WASM module not found in any expected location");
}

/** Reset module (useful for tests) */
export function resetHeifModule(): void {
    heifState = { module: null, initialized: false };
}
