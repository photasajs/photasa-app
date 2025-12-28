import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@main": resolve("src/main/"),
            "@preload": resolve("src/preload/"),
            "@photasa/common": resolve("../../packages/common/src/index.ts"),
            "@photasa/common/*": resolve("../../packages/common/src/*"),
            "@shared": resolve("src/shared/"),
        },
    },
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["./test/setup.main.ts"], // Use same setup as main since both are node environment
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
        include: [
            "src/preload/**/*.{test,spec}.{js,ts,jsx,tsx}",
            "src/shared/**/*.{test,spec}.{js,ts,jsx,tsx}",
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["node_modules/", "**/*.d.ts", "**/*.config.ts", "**/*.config.js"],
        },
    },
});
