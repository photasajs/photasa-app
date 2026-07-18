import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@renderer": path.resolve(__dirname, "./src"),
            "@photasa/common": path.resolve(__dirname, "../../packages/common/dist/index.mjs"),
        },
    },
    test: {
        environment: "happy-dom",
        include: ["src/**/*.test.ts"],
        passWithNoTests: true,
        globals: true,
    },
});
