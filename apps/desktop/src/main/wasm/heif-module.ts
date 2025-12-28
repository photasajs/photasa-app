import fs from "fs-extra";
import path from "path";
import createHeifModule from "@saschazar/wasm-heif";
import { getLogger } from "@photasa/common";

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

    // 使用环境变量获取APP_PATH，如果没有则使用当前工作目录
    const appPath = process.env.APP_PATH || process.cwd();
    const isMac = process.platform === "darwin";
    const isWindows = process.platform === "win32";
    const isLinux = process.platform === "linux";
    const isProduction = !process.env.NODE_ENV || process.env.NODE_ENV === "production";

    // 构建可能的WASM文件路径
    const possiblePaths: string[] = [];

    // 1. 优先：使用process.resourcesPath（Electron标准方式）
    if (process.resourcesPath) {
        possiblePaths.push(path.join(process.resourcesPath, "wasm_heif.wasm"));
    }

    // 2. 平台特定生产环境：ASAR解压路径
    if (isMac && isProduction) {
        // macOS: /Applications/Photasa.app/Contents/Resources/app.asar.unpacked/resources/
        possiblePaths.push(
            path.join(appPath, "..", "app.asar.unpacked", "resources", "wasm_heif.wasm"),
        );
        // 备用macOS路径
        possiblePaths.push(
            path.join(
                appPath,
                "Contents",
                "Resources",
                "app.asar.unpacked",
                "resources",
                "wasm_heif.wasm",
            ),
        );
    }

    if (isWindows && isProduction) {
        // Windows: C:\Users\Username\AppData\Local\Programs\Photasa\resources\app.asar.unpacked\resources\
        possiblePaths.push(
            path.join(appPath, "..", "app.asar.unpacked", "resources", "wasm_heif.wasm"),
        );
        // 备用Windows路径
        possiblePaths.push(
            path.join(appPath, "resources", "app.asar.unpacked", "resources", "wasm_heif.wasm"),
        );
        // Windows Program Files路径
        possiblePaths.push(
            path.join(appPath, "..", "..", "app.asar.unpacked", "resources", "wasm_heif.wasm"),
        );
    }

    if (isLinux && isProduction) {
        // Linux: /opt/Photasa/resources/app.asar.unpacked/resources/ 或 ~/.local/share/Photasa/resources/app.asar.unpacked/resources/
        possiblePaths.push(
            path.join(appPath, "..", "app.asar.unpacked", "resources", "wasm_heif.wasm"),
        );
        // 备用Linux路径
        possiblePaths.push(
            path.join(appPath, "resources", "app.asar.unpacked", "resources", "wasm_heif.wasm"),
        );
    }

    // 3. 通用ASAR解压路径
    possiblePaths.push(
        path.join(appPath, "..", "app.asar.unpacked", "resources", "wasm_heif.wasm"),
    );
    possiblePaths.push(
        path.join(appPath, "resources", "app.asar.unpacked", "resources", "wasm_heif.wasm"),
    );

    // 4. 开发环境路径
    possiblePaths.push(path.join(__dirname, "../../../resources/wasm_heif.wasm"));
    possiblePaths.push(path.join(process.cwd(), "resources", "wasm_heif.wasm"));

    // 5. 生产环境：相对于app路径
    possiblePaths.push(path.join(appPath, "resources", "wasm_heif.wasm"));

    // 6. 备用路径
    possiblePaths.push(path.resolve("resources", "wasm_heif.wasm"));
    possiblePaths.push(path.join(__dirname, "../../resources/wasm_heif.wasm"));
    possiblePaths.push(path.join(__dirname, "../resources/wasm_heif.wasm"));
    possiblePaths.push(path.join(__dirname, "./resources/wasm_heif.wasm"));

    // 7. 从node_modules中查找（最后的后备）
    possiblePaths.push(
        path.join(__dirname, "../../../node_modules/@saschazar/wasm-heif/wasm_heif.wasm"),
    );
    possiblePaths.push(
        path.join(process.cwd(), "node_modules/@saschazar/wasm-heif/wasm_heif.wasm"),
    );

    logger.debug(`Checking ${possiblePaths.length} possible paths for WASM file`);
    logger.debug(
        `Platform: ${process.platform}, Production: ${isProduction}, Mac: ${isMac}, Windows: ${isWindows}, Linux: ${isLinux}`,
    );
    logger.debug(`App path: ${appPath}`);
    logger.debug(`Resources path: ${process.resourcesPath}`);
    logger.debug(`Current working directory: ${process.cwd()}`);
    logger.debug(`__dirname: ${__dirname}`);

    for (const wasmPath of possiblePaths) {
        logger.debug(`Checking path: ${wasmPath}`);
        if (await fs.pathExists(wasmPath)) {
            logger.info(`Found WASM file at: ${wasmPath}`);
            try {
                const wasmBinary = await fs.readFile(wasmPath);
                logger.debug(`WASM file size: ${wasmBinary?.length || 0} bytes`);
                if (!wasmBinary || wasmBinary.length === 0) {
                    logger.warn(`WASM file at ${wasmPath} is empty or invalid`);
                    continue;
                }
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

    throw new Error(
        `HEIF WASM module not found in any expected location. Checked ${possiblePaths.length} paths. Please ensure wasm_heif.wasm is available in the resources directory.`,
    );
}

/** Reset module (useful for tests) */
export function resetHeifModule(): void {
    heifState = { module: null, initialized: false };
}
