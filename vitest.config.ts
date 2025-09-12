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
        testTimeout: 10000, // 10 seconds max per test
        hookTimeout: 5000, // 5 seconds for hooks
        teardownTimeout: 5000, // 5 seconds for teardown
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
