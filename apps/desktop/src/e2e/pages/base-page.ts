import { Page, ElectronApplication, Locator, expect } from "@playwright/test";

export abstract class BasePage {
    protected readonly page: Page;
    protected readonly app: ElectronApplication;

    constructor(page: Page, app: ElectronApplication) {
        this.page = page;
        this.app = app;
    }

    // 通用等待方法
    async waitForPageLoad(): Promise<void> {
        await this.page.waitForLoadState("domcontentloaded");
        await this.page.waitForLoadState("networkidle");
    }

    async waitForSelector(selector: string, options?: { timeout?: number }): Promise<Locator> {
        const element = this.page.locator(selector);
        await element.waitFor(options);
        return element;
    }

    async waitForText(text: string, options?: { timeout?: number }): Promise<void> {
        await this.page.waitForFunction(
            (searchText) => document.body.innerText.includes(searchText),
            text,
            options,
        );
    }

    // 通用交互方法
    async clickElement(selector: string): Promise<void> {
        const element = await this.waitForSelector(selector);
        await element.click();
    }

    async fillInput(selector: string, value: string): Promise<void> {
        const element = await this.waitForSelector(selector);
        await element.fill(value);
    }

    async selectOption(selector: string, value: string): Promise<void> {
        const element = await this.waitForSelector(selector);
        await element.selectOption(value);
    }

    // 通用验证方法
    async verifyElementExists(selector: string): Promise<void> {
        const element = this.page.locator(selector);
        await expect(element).toBeVisible();
    }

    async verifyElementHasText(selector: string, expectedText: string): Promise<void> {
        const element = this.page.locator(selector);
        await expect(element).toHaveText(expectedText);
    }

    async verifyElementContainsText(selector: string, expectedText: string): Promise<void> {
        const element = this.page.locator(selector);
        await expect(element).toContainText(expectedText);
    }

    async verifyPageTitle(expectedTitle: string): Promise<void> {
        await expect(this.page).toHaveTitle(expectedTitle);
    }

    // 调试和截图方法
    async takeScreenshot(name?: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const screenshotName = name ? `${name}-${timestamp}` : `screenshot-${timestamp}`;
        const path = `test-results/screenshots/${screenshotName}.png`;

        await this.page.screenshot({ path, fullPage: true });
        return path;
    }

    async logPageContent(): Promise<void> {
        const title = await this.page.title();
        const url = this.page.url();
        console.log(`📄 Page Debug Info:`);
        console.log(`   Title: ${title}`);
        console.log(`   URL: ${url}`);

        try {
            const bodyText = await this.page.locator("body").textContent();
            console.log(`   Body Text Preview: ${bodyText?.substring(0, 200)}...`);
        } catch (error) {
            console.log(`   Could not get body text: ${error}`);
        }
    }

    // 窗口管理方法
    async getAllWindows(): Promise<Page[]> {
        return this.app.windows();
    }

    async switchToWindow(windowIndex: number): Promise<Page> {
        const windows = await this.getAllWindows();
        if (windowIndex >= windows.length) {
            throw new Error(
                `Window index ${windowIndex} out of range. Available windows: ${windows.length}`,
            );
        }
        return windows[windowIndex];
    }

    async waitForNewWindow(): Promise<Page> {
        return new Promise((resolve) => {
            this.app.on("window", (window) => {
                resolve(window);
            });
        });
    }

    // 应用状态方法
    async isAppReady(): Promise<boolean> {
        try {
            await this.page.waitForFunction(
                () => {
                    return document.readyState === "complete" && window.hasOwnProperty("electron");
                },
                { timeout: 5000 },
            );
            return true;
        } catch {
            return false;
        }
    }

    async waitForAppReady(): Promise<void> {
        const isReady = await this.isAppReady();
        if (!isReady) {
            throw new Error("Application failed to initialize properly");
        }
    }

    // 错误处理
    async handleError(error: Error, context: string): Promise<void> {
        console.error(`❌ Error in ${context}:`, error.message);

        // 截图用于调试
        await this.takeScreenshot(`error-${context}`);

        // 记录页面状态
        await this.logPageContent();

        throw error;
    }

    // 通用等待条件
    async waitForElementToDisappear(selector: string, timeout = 10000): Promise<void> {
        const element = this.page.locator(selector);
        await element.waitFor({ state: "detached", timeout });
    }

    async waitForLoadingToComplete(): Promise<void> {
        // 等待常见的加载指示器消失
        const loadingSelectors = [
            "[data-testid='loading-spinner']",
            ".loading",
            ".spinner",
            "[aria-label*='loading']",
            "[aria-label*='Loading']",
        ];

        for (const selector of loadingSelectors) {
            try {
                const element = this.page.locator(selector);
                if (await element.isVisible({ timeout: 1000 })) {
                    await element.waitFor({ state: "detached", timeout: 10000 });
                }
            } catch {
                // 继续检查下一个加载指示器
            }
        }
    }
}
