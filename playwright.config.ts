import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./src/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    timeout: 30 * 1000, // 30秒超时
    expect: {
        timeout: 10 * 1000, // 10秒断言超时
    },
    reporter: [
        ["html", { outputFolder: "test-results/reports/html" }],
        ["json", { outputFile: "test-results/reports/results.json" }],
        ["junit", { outputFile: "test-results/reports/junit.xml" }],
        process.env.CI ? ["github"] : ["list"],
    ],
    outputDir: "test-results/artifacts/",
    use: {
        headless: !!process.env.CI,
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        video: "retain-on-failure",
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "electron-dev",
            testMatch: /.*\.(test|spec)\.ts/,
            use: {
                ...devices["Desktop Chrome"],
            },
        },
        {
            name: "electron-prod",
            testMatch: /.*\.(test|spec)\.ts/,
            testIgnore: /.*\/dev-only\/.*\.ts/,
            use: {
                ...devices["Desktop Chrome"],
            },
        },
    ],
    globalSetup: "./src/e2e/fixtures/global-setup.ts",
    globalTeardown: "./src/e2e/fixtures/global-teardown.ts",
});
