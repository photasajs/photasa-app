import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@photasa/common": path.resolve(__dirname, "../../packages/common/dist/index.mjs"),
        },
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        passWithNoTests: true,
    },
});
