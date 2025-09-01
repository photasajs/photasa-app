import fs from "fs-extra";
import path from "path";
import createHeifModule from "@saschazar/wasm-heif";

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
 * Strategy: try default init first; fallback to explicit wasmBinary under resources.
 */
export async function initializeHeifModule(): Promise<any> {
    if (heifState.initialized && heifState.module) return heifState.module;

    try {
        const module = await createHeifModule();
        heifState = { module, initialized: true };
        return module;
    } catch {
        // fallback to resources/wasm_heif.wasm
        const wasmPath = path.join(__dirname, "../../../resources/wasm_heif.wasm");
        if (!(await fs.pathExists(wasmPath))) {
            throw new Error("HEIF WASM module not found and default initialization failed");
        }
        const wasmBinary = await fs.readFile(wasmPath);
        const module = await createHeifModule({ wasmBinary } as any);
        heifState = { module, initialized: true };
        return module;
    }
}

/** Reset module (useful for tests) */
export function resetHeifModule(): void {
    heifState = { module: null, initialized: false };
}
