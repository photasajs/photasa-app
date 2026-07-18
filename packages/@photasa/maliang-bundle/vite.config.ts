/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import path from "path";
import { builtinModules } from "module";

export default defineConfig({
    plugins: [
        dts({
            entryRoot: "src",
            tsconfigPath: path.join(__dirname, "tsconfig.json"),
        }),
    ],
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "PhotasaMaliangBundle",
            fileName: "index",
            formats: ["es", "cjs"],
        },
        rollupOptions: {
            external: [
                ...builtinModules,
                ...builtinModules.map((m) => `node:${m}`),
                "@photasa/common",
                "@saschazar/wasm-heif",
                "fluent-ffmpeg",
                "ffmpeg-static",
                "ffprobe-static",
                "fs-extra",
            ],
        },
        sourcemap: true,
        emptyOutDir: true,
    },
    test: {
        globals: true,
        environment: "node",
    },
});
