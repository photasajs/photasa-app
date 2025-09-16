import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import svgLoader from "vite-svg-loader";

export default defineConfig({
    plugins: [vue(), svgLoader()],
    resolve: {
        alias: {
            "@main": resolve("src/main/"),
            "@renderer": resolve("src/renderer/src"),
            "@preload": resolve("src/preload/"),
            "@common": resolve("src/common/"),
            "@shared": resolve("src/shared/"),
        },
    },
    test: {
        globals: true,
        environment: "happy-dom",
        setupFiles: ["./test/setup.ts"],
        testTimeout: 30000, // 30 seconds max per test
        hookTimeout: 15000, // 15 seconds for hooks
        teardownTimeout: 5000, // 5 seconds for teardown
        pool: "forks", // 使用fork模式减少内存压力
        poolOptions: {
            forks: {
                singleFork: true, // 使用单个fork减少内存使用
                maxForks: 1, // 限制为单个fork
            },
        },
        maxConcurrency: 1, // 限制并发测试数量
        isolate: false, // 禁用测试隔离以减少内存使用
        passWithNoTests: true, // 允许没有测试的文件通过
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
            "src/renderer/src/**/*.{test,spec}.{js,ts,jsx,tsx}",
            "src/main/**/*.{test,spec}.{js,ts,jsx,tsx}",
            "src/common/**/*.{test,spec}.{js,ts,jsx,tsx}",
            "src/shared/**/*.{test,spec}.{js,ts,jsx,tsx}",
            "src/preload/**/*.{test,spec}.{js,ts,jsx,tsx}",
        ],
        server: {
            deps: {
                inline: [/@vue/, /@vueuse/, /@ant-design/, /radash/],
            },
        },
        environmentOptions: {
            happyDOM: {
                settings: {
                    navigator: {
                        userAgent: "node",
                    },
                },
            },
        },
    },
});
