import { test as base, ElectronApplication, Page, _electron as electron } from "@playwright/test";
import path from "path";
import fs from "fs-extra";

export interface ElectronFixtures {
    electronApp: ElectronApplication;
    page: Page;
}

export interface LaunchOptions {
    headless?: boolean;
    slowMo?: number;
    args?: string[];
    env?: Record<string, string>;
    executablePath?: string;
}

export class ElectronAppManager {
    private app: ElectronApplication | null = null;
    private page: Page | null = null;
    private testDataDir: string;

    constructor() {
        this.testDataDir = path.join(__dirname, "../test-data");
    }

    async launch(options: LaunchOptions = {}): Promise<{ app: ElectronApplication; page: Page }> {
        // 准备测试环境
        await this.prepareTestEnvironment();

        // 检查构建是否存在
        const mainPath = path.join(process.cwd(), "out/main/index.js");
        const preloadPath = path.join(process.cwd(), "out/preload/index.js");
        const rendererPath = path.join(process.cwd(), "out/renderer/index.html");

        const mainExists = await fs.pathExists(mainPath);
        const preloadExists = await fs.pathExists(preloadPath);
        const rendererExists = await fs.pathExists(rendererPath);

        if (!mainExists || !preloadExists || !rendererExists) {
            throw new Error(
                `Electron app not fully built. Run 'npm run build' first.\n` +
                    `Missing files:\n` +
                    `- Main: ${mainExists ? "✓" : "✗"} ${mainPath}\n` +
                    `- Preload: ${preloadExists ? "✓" : "✗"} ${preloadPath}\n` +
                    `- Renderer: ${rendererExists ? "✓" : "✗"} ${rendererPath}`,
            );
        }

        // 启动 Electron 应用 - 使用项目根目录作为应用路径
        const appPath = process.cwd();

        this.app = await electron.launch({
            args: [appPath, ...(options.args || [])],
            env: {
                ...process.env,
                NODE_ENV: "test",
                ELECTRON_IS_DEV: "false",
                // 确保不使用开发服务器
                ELECTRON_RENDERER_URL: undefined,
                ...options.env,
            },
            timeout: 30000,
            ...options,
        });

        // 等待所有窗口创建（包括启动画面和主窗口）
        // 应用启动流程：先创建启动画面，再创建主窗口
        await this.waitForAllWindows();

        // 获取主窗口（不是启动画面窗口）
        this.page = await this.getMainWindowPage();

        // 等待应用初始化完成
        await this.waitForAppReady();

        return { app: this.app, page: this.page };
    }

    private async prepareTestEnvironment(): Promise<void> {
        // 确保测试数据目录存在
        await fs.ensureDir(this.testDataDir);

        // 创建测试配置文件（如果需要）
        const testConfig = {
            dataPath: path.join(this.testDataDir, "temp-db"),
            logLevel: "error",
            enableDevTools: false,
        };

        await fs.writeJson(
            path.join(this.testDataDir, "test-configs", "app-config.json"),
            testConfig,
            { spaces: 2 },
        );
    }

    /**
     * 等待主窗口创建完成
     * 应用启动流程：先创建启动画面，再创建主窗口
     * 我们需要等待主窗口（有 #app 元素的窗口）创建完成
     */
    private async waitForAllWindows(): Promise<void> {
        if (!this.app) throw new Error("App not initialized");

        let attempts = 0;
        const maxAttempts = 60; // 最多等待30秒（60 * 500ms）

        while (attempts < maxAttempts) {
            const windows = this.app.windows();

            // 检查是否有主窗口（有 #app 元素的窗口）
            for (const window of windows) {
                try {
                    // 检查窗口是否已加载
                    const url = window.url();

                    // 跳过启动画面窗口（URL 包含 splash）
                    if (url.includes("splash")) {
                        continue;
                    }

                    // 尝试检查是否有 #app 元素（主窗口标识）
                    const hasApp = await window
                        .evaluate(() => {
                            return !!document.getElementById("app");
                        })
                        .catch(() => false);

                    if (hasApp) {
                        // 找到主窗口，可以继续
                        return;
                    }
                } catch {
                    // 窗口可能还在加载，继续检查下一个窗口
                    continue;
                }
            }

            // 等待一下再重试
            await new Promise((resolve) => setTimeout(resolve, 500));
            attempts++;
        }

        // 如果超时，至少确保有窗口
        const windows = this.app.windows();
        if (windows.length === 0) {
            throw new Error("No windows created after timeout");
        }
    }

    /**
     * 获取主窗口页面（不是启动画面窗口）
     * 通过 URL 和 #app 元素来识别主窗口
     */
    private async getMainWindowPage(): Promise<Page> {
        if (!this.app) throw new Error("App not initialized");

        const windows = this.app.windows();

        // 优先查找主窗口（有 #app 元素且 URL 不包含 splash）
        for (const window of windows) {
            try {
                const url = window.url();

                // 跳过启动画面窗口
                if (url.includes("splash")) {
                    continue;
                }

                // 检查是否有 #app 元素
                const hasApp = await window
                    .evaluate(() => {
                        return !!document.getElementById("app");
                    })
                    .catch(() => false);

                if (hasApp) {
                    return window;
                }
            } catch {
                // 窗口可能还在加载，继续查找下一个
                continue;
            }
        }

        // Fallback: 返回第一个非启动画面窗口
        for (const window of windows) {
            try {
                const url = window.url();
                if (!url.includes("splash")) {
                    return window;
                }
            } catch {
                continue;
            }
        }

        // 最后的 fallback: 返回第一个窗口
        if (windows.length > 0) {
            return windows[0];
        }

        throw new Error("No windows available");
    }

    private async waitForAppReady(): Promise<void> {
        if (!this.page) throw new Error("Page not initialized");

        // 等待 DOM 准备就绪
        await this.page.waitForLoadState("domcontentloaded");

        // 等待页面完全加载
        try {
            await this.page.waitForFunction(() => document.readyState === "complete", {
                timeout: 15000,
            });
        } catch (error) {
            console.warn("⚠️ Warning: Document ready state check failed:", error);
            throw error;
        }

        // 等待 Vue 应用挂载（检查是否有 #app 元素且有内容）
        try {
            await this.page.waitForFunction(
                () => {
                    const app = document.getElementById("app");
                    return app && app.children.length > 0;
                },
                { timeout: 10000 },
            );
        } catch (error) {
            console.warn("⚠️ Warning: Vue app mount check failed:", error);
        }

        // 最后等待一小段时间确保所有初始化完成
        // 检查页面是否仍然有效，避免在页面关闭后调用 waitForTimeout
        try {
            if (this.page && !this.page.isClosed()) {
                await this.page.waitForTimeout(2000);
            }
        } catch (error) {
            // 如果页面已关闭，记录警告但不抛出错误
            // 因为前面的检查已经确保应用基本就绪
            console.warn("⚠️ Warning: Page closed during final wait:", error);
        }
    }

    async getMainWindow(): Promise<Page> {
        if (!this.page) {
            throw new Error("App not launched. Call launch() first.");
        }
        return this.page;
    }

    async getAllWindows(): Promise<Page[]> {
        if (!this.app) {
            throw new Error("App not launched. Call launch() first.");
        }
        return this.app.windows();
    }

    async waitForWindow(timeout = 10000): Promise<Page> {
        if (!this.app) {
            throw new Error("App not launched. Call launch() first.");
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error("Timeout waiting for new window"));
            }, timeout);

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.app!.on("window", (window) => {
                clearTimeout(timer);
                resolve(window);
            });
        });
    }

    async takeScreenshot(name: string): Promise<void> {
        if (!this.page) return;

        const screenshotPath = path.join(
            "test-results",
            "screenshots",
            `${name}-${Date.now()}.png`,
        );
        await fs.ensureDir(path.dirname(screenshotPath));
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
    }

    async cleanup(): Promise<void> {
        try {
            // 关闭所有窗口
            if (this.app) {
                const windows = this.app.windows();
                for (const window of windows) {
                    if (!window.isClosed()) {
                        await window.close();
                    }
                }

                // 关闭应用
                await this.app.close();
            }
        } catch (error) {
            console.warn("⚠️ Warning during cleanup:", error);
        } finally {
            this.app = null;
            this.page = null;
        }
    }

    async restart(options: LaunchOptions = {}): Promise<{ app: ElectronApplication; page: Page }> {
        await this.cleanup();
        return this.launch(options);
    }
}

// Playwright 测试固件
export const test = base.extend<ElectronFixtures>({
    electronApp: async ({}, use) => {
        const manager = new ElectronAppManager();
        const { app } = await manager.launch();
        await use(app);
        await manager.cleanup();
    },

    page: async ({ electronApp }, use) => {
        const page = await electronApp.firstWindow();
        await use(page);
    },
});

export { expect } from "@playwright/test";
