import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "ZouwuExpressionParser",
            fileName: (format) => (format === "es" ? "index.mjs" : "index.cjs"),
            formats: ["es", "cjs"],
        },
        rollupOptions: {
            external: ["peggy"],
        },
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
