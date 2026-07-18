import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["src/index.ts", "src/__tests__/**", "vite.config.ts", "dist/**"],
            all: true,
        },
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
});
