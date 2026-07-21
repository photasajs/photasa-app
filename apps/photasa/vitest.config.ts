import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";
import yaml from "@rollup/plugin-yaml";

export default defineConfig({
    plugins: [vue(), yaml()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@renderer": path.resolve(__dirname, "./src"),
            "@photasa/common": path.resolve(
                __dirname,
                "../../packages/@photasa/common/src/index.ts",
            ),
            "@photasa/common/types": path.resolve(
                __dirname,
                "../../packages/@photasa/common/src/types.ts",
            ),
        },
    },
    test: {
        environment: "happy-dom",
        include: ["src/**/*.test.ts"],
        passWithNoTests: true,
        globals: true,
        coverage: {
            provider: "v8",
            include: ["src/api/watch-event.ts"],
            thresholds: {
                lines: 100,
                functions: 100,
                branches: 100,
                statements: 100,
            },
        },
    },
});
