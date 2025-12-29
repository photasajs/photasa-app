import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@main": resolve("src/main/"),
            "@renderer": resolve("src/renderer/src"),
            "@preload": resolve("src/preload/"),
            "@shared": resolve("src/shared/"),
            "@maliang": resolve("src/engines/maliang/"),
            "@shunfenger": resolve("src/engines/shunfenger/"),
            "@sibu": resolve("src/engines/sibu/"),
            "@engines/common/*": resolve("src/engines/common/*"),
            "@photasa/ffmpeg": resolve("../../packages/@photasa/ffmpeg/src/index.ts"),
        },
    },
    test: {
        globals: true,
        environment: "node", // 使用node环境而不是jsdom
        setupFiles: ["./test/setup.main.ts"],
        testTimeout: 30000,
        hookTimeout: 15000,
        teardownTimeout: 10000,
        pool: "forks",
        // poolOptions removed in v4, using defaults
        maxConcurrency: 4,
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
            "src/main/**/*.test.{js,ts,jsx,tsx}",
            "src/main/**/__tests__/**/*.test.{js,ts,jsx,tsx}",
            "src/engines/**/*.test.{js,ts,jsx,tsx}",
        ],
        server: {
            deps: {
                inline: [/@vue/, /@vueuse/, /@ant-design/, /radash/],
            },
        },
    },
});
