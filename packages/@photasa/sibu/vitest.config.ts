import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            reportsDirectory: "./coverage",
            include: ["src/**/*.ts"],
            exclude: [
                "src/types/**",
                "**/*.d.ts",
                "test/**",
                "vite.config.ts",
                "vitest.config.ts",
                "src/index.ts", // Optional: if index is just exports, but I should probably test it or ignore it.
            ],
            all: true,
            thresholds: {
                statements: 100,
                branches: 100,
                functions: 100,
                lines: 100,
            },
        },
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
});
