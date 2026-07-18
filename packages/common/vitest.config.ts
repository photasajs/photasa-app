import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/*.d.ts",
                "src/**/__tests__/**",
                "src/index.ts",
                "src/types.ts",
                "src/**/*-types.ts",
                "src/**/config.ts", // Config is tested but essentially static
            ],
        },
    },
});
