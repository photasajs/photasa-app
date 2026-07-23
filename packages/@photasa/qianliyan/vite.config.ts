/// <reference types="vitest" />
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import path from "path";
import { builtinModules } from "module";

export default defineConfig({
    plugins: [
        dts({
            include: ["src/**/*.ts", "src/**/*.d.ts"],
            exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/__tests__/**"],
            outDir: "dist",
            rollupTypes: true,
        }),
    ],
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "Qianliyan",
            fileName: (format) => {
                if (format === "es") return "index.mjs";
                return "index.js";
            },
            formats: ["es", "cjs"],
        },
        rollupOptions: {
            external: [
                ...builtinModules,
                ...builtinModules.map((m) => `node:${m}`),
                "events",
                "fs",
                "path",
                "os",
                "@photasa/common",
                "@photasa/taiyi",
            ],
            output: {
                preserveModules: false,
                exports: "named",
            },
        },
        sourcemap: true,
        target: "node18",
        minify: false,
    },
});
