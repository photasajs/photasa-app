import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            "@renderer": resolve("src/renderer/src"),
            "@preload": resolve("src/preload/"),
            "@common": resolve("src/common/"),
        },
    },
    test: {
        globals: true,
        environment: "happy-dom",
        setupFiles: ["./src/renderer/src/test/setup.ts"],
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
        ],
        deps: {
            inline: [/@vue/, /@vueuse/, /@ant-design/],
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
