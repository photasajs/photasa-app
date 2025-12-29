const path = require("path");
const fs = require("fs");

async function run() {
    try {
        // Try to require the module
        let createHeifModule;
        try {
            createHeifModule = require("@saschazar/wasm-heif");
        } catch (e) {
            console.error("Failed to require @saschazar/wasm-heif:", e);
            // Try explicit path if in pnpm strict node_modules
            // This part might need adjustment based on where it's installed
            return;
        }

        console.log("Module loaded.");

        // Find WASM
        const wasmPath = path.join(
            path.dirname(require.resolve("@saschazar/wasm-heif/package.json")),
            "wasm_heif.wasm",
        );
        console.log("WASM Path:", wasmPath);

        if (!fs.existsSync(wasmPath)) {
            console.error("WASM file not found at calculated path.");
            return;
        }

        const wasmBinary = fs.readFileSync(wasmPath);

        const module = await createHeifModule({ wasmBinary });
        console.log("WASM Module initialized.");

        const heicPath = path.join(__dirname, "../src/__tests__/images/test.heic");
        console.log("HEIC Path:", heicPath);
        const buffer = fs.readFileSync(heicPath);

        console.log("Decoding...");
        const result = module.decode(buffer, buffer.length, false);
        console.log("Result type:", typeof result);
        console.log("Is Array:", Array.isArray(result));

        if (result) {
            if (Array.isArray(result)) {
                if (result.length > 0) {
                    console.log("Array[0] keys:", Object.keys(result[0]));
                    console.log("Array[0] w/h:", result[0].width, result[0].height);
                    console.log("Array[0] channels:", result[0].channels);
                } else {
                    console.log("Empty array");
                }
            } else {
                console.log("Result keys:", Object.keys(result));
                console.log("Result w/h:", result.width, result.height);
                console.log("Result channels:", result.channels);
            }
        } else {
            console.log("Result is null/undefined");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
