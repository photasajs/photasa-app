import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            formats: ["es", "cjs"],
            fileName: (format) => (format === "es" ? "index.mjs" : "index.cjs"),
        },
        rollupOptions: {
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
