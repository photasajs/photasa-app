import { _electron as electron, test, expect, ElectronApplication, Page } from "@playwright/test";

test.describe("Electron App E2E", () => {
    let app: ElectronApplication;
    let page: Page;

    test.beforeAll(async () => {
        // Launch the Electron app
        app = await electron.launch({
            args: ["."],
        });
        page = await app.firstWindow();
    });

    test.afterAll(async () => {
        await app?.close?.();
    });

    test("should have the correct window title", async () => {
        const title = await page.title();
        expect(title).toBe("Photasa");
    });

    test("should show the main window and load the page", async () => {
        // Check the <body> is visible
        const bodyVisible = await page.isVisible("body");
        expect(bodyVisible).toBe(true);

        // Wait for document.readyState to be 'complete'
        await page.waitForFunction(() => document.readyState === "complete");
        const readyState = await page.evaluate(() => document.readyState);
        expect(readyState).toBe("complete");
    });
});
