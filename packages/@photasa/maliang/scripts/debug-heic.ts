import fs from "fs-extra";
import path from "path";
import { initializeHeifModule } from "@photasa/maliang";

async function run() {
    try {
        console.log("Initializing HEIF module...");
        const module = await initializeHeifModule();
        console.log("HEIF module initialized.");

        const inputPath = path.join(__dirname, "../src/__tests__/images/test.heic");
        console.log(`Reading file from ${inputPath}`);

        if (!fs.existsSync(inputPath)) {
            console.error("Input file not found!");
            return;
        }

        const buffer = await fs.readFile(inputPath);
        console.log(`File read, size: ${buffer.length} bytes`);

        console.log("Decoding...");
        const result = module.decode(buffer, buffer.length, false);
        console.log("Decode returned type:", typeof result);
        console.log("Is Array:", Array.isArray(result));

        if (result) {
            console.log("Keys:", Object.keys(result));
            if (Array.isArray(result)) {
                console.log("First element keys:", Object.keys(result[0]));
                console.log("First element width/height:", result[0].width, result[0].height);
            } else {
                console.log("Width/Height:", result.width, result.height);
                console.log("Data type:", typeof result.data);
                console.log("Data length:", result.data ? result.data.length : "undefined");
            }
        } else {
            console.log("Result is null/undefined");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

run();
