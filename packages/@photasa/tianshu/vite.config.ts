/// <reference types="vitest" />
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import path from "path";
import { builtinModules } from "module";

export default defineConfig({
    plugins: [
        dts({
            include: ["src/**/*.ts", "src/**/*.d.ts"],
            exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/__tests__/**"],
            outDir: "dist",
            rollupTypes: true,
        }),
    ],
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "Tianshu",
            fileName: (format) => {
                if (format === "es") return "index.mjs";
                return "index.js";
            },
            formats: ["es", "cjs"],
        },
        rollupOptions: {
            // Make sure to externalize deps that shouldn't be bundled
            external: [
                ...builtinModules,
                ...builtinModules.map((m) => `node:${m}`),
                "events",
                "fs",
                "path",
                "fs-extra",
                "js-yaml",
                "glob",
                "lodash",
                "@systembug/diting",
                "@zouwu-wf/workflow",
                "@zouwu-wf/expression-parser",
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
