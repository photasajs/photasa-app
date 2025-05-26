import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./src/e2e",
    use: {
        headless: false,
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        video: "on-first-retry",
    },
    projects: [
        {
            name: "electron",
            testMatch: /.*\.test\.ts/,
        },
    ],
});
