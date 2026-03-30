import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/__tests__/**/*.test.ts"],
        exclude: ["src/**/__tests__/**/*.spec.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/**/*.ts"],
            exclude: ["src/**/__tests__/**", "src/**/index.ts"],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
            "@main/scan": path.resolve(__dirname, "src"),
            "@shared/path-util": path.resolve(__dirname, "src/utils/path-utils"),
        },
    },
});
