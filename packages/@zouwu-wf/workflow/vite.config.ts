import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, "src/index.ts"),
            },
            formats: ["es", "cjs"],
            fileName: (format, entryName) => {
                if (format === "es") {
                    return `${entryName}.mjs`;
                }
                return `${entryName}.cjs`;
            },
        },
        rollupOptions: {
            external: [
                "ajv",
                "ajv-formats",
                "js-yaml",
                "@zouwu-wf/expression-parser",
                "events",
            ],
            output: {
                preserveModules: false,
                exports: "named",
            },
        },
        sourcemap: true,
        target: "es2020",
        minify: false,
    },
    plugins: [
        dts({
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.test.ts", "src/**/__tests__/**"],
            outDir: "dist",
            rollupTypes: true,
        }) as any,
    ],
});
