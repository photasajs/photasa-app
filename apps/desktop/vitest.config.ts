import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import svgLoader from "vite-svg-loader";
import yaml from "@rollup/plugin-yaml";

export default defineConfig({
    plugins: [vue(), svgLoader(), yaml()],
    resolve: {
        alias: {
            "@main": resolve("src/main/"),
            "@renderer": resolve("src/renderer/src"),
            "@preload": resolve("src/preload/"),
            "@photasa/common": resolve("../../packages/common/src/index.ts"),
            "@photasa/common/*": resolve("../../packages/common/src/*"),
            "@photasa/tianshu": resolve("../../packages/@photasa/tianshu/src/index.ts"),
            "@photasa/tianshu/*": resolve("../../packages/@photasa/tianshu/src/*"),
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./test/setup.renderer.ts"],
        testTimeout: 15000,
        hookTimeout: 8000,
        teardownTimeout: 5000,
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: true,
                maxForks: 1,
                isolate: true,
            },
        },
        maxConcurrency: 1,
        isolate: true,
        passWithNoTests: true,
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "node_modules/",
                "src/renderer/src/main.ts",
                "src/renderer/src/background.ts",
                "**/*.d.ts",
                "**/*.config.ts",
                "**/*.config.js",
                "src/renderer/src/test/**/*",
            ],
        },
        include: [
            "src/renderer/src/**/*.test.{js,ts,jsx,tsx}",
            "src/common/**/*.test.{js,ts,jsx,tsx}",
        ],
        server: {
            deps: {
                inline: [/@vue/, /@vueuse/, /@ant-design/, /radash/],
            },
        },
        environmentOptions: {
            jsdom: {
                url: "http://localhost:3000",
                pretendToBeVisual: true,
                resources: "usable",
            },
        },
    },
});
