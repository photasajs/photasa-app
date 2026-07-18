import { defineConfig } from "vite";
import path from "path";
import { builtinModules } from "module";

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "PhotasaCLI",
            fileName: () => "index.js",
            formats: ["es"],
        },
        rollupOptions: {
            external: [
                ...builtinModules,
                /^node:/,
                "@photasa/common",
                "@photasa/maliang-bundle",
                "@saschazar/wasm-heif",
                "ffmpeg-static",
                "ffprobe-static",
            ],
        },
        outDir: "dist",
        target: "node18",
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
});
