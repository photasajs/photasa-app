import path from "path";
import fs from "fs-extra";
import { Page } from "@playwright/test";

export class TestHelpers {
    /**
     * 创建测试照片文件
     */
    static async createTestPhotoFiles(count = 5): Promise<string[]> {
        const testDataDir = path.join(__dirname, "../test-data/sample-photos");
        await fs.ensureDir(testDataDir);

        const photoFiles: string[] = [];

        for (let i = 1; i <= count; i++) {
            const fileName = `test-photo-${i.toString().padStart(3, "0")}.jpg`;
            const filePath = path.join(testDataDir, fileName);

            // 创建一个简单的测试图片文件（实际项目中可以使用真实的测试图片）
            await fs.writeFile(filePath, Buffer.from("fake-jpg-content"));
            photoFiles.push(filePath);
        }

        return photoFiles;
    }

    /**
     * 清理测试照片文件
     */
    static async cleanupTestPhotoFiles(): Promise<void> {
        const testDataDir = path.join(__dirname, "../test-data/sample-photos");
        try {
            if (await fs.pathExists(testDataDir)) {
                await fs.emptyDir(testDataDir);
            }
        } catch (error) {
            console.warn("Warning: Could not cleanup test photo files:", error);
        }
    }

    /**
     * 等待文件系统操作完成
     */
    static async waitForFileOperation(
        filePath: string,
        operation: "create" | "delete",
        timeout = 5000,
    ): Promise<void> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const exists = await fs.pathExists(filePath);

            if (operation === "create" && exists) return;
            if (operation === "delete" && !exists) return;

            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        throw new Error(`Timeout waiting for file ${operation}: ${filePath}`);
    }

    /**
     * 生成随机字符串
     */
    static generateRandomString(length = 8): string {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * 等待页面中的元素数量达到预期
     */
    static async waitForElementCount(
        page: Page,
        selector: string,
        expectedCount: number,
        timeout = 10000,
    ): Promise<void> {
        await page.waitForFunction(
            ({ selector, count }) => {
                const elements = document.querySelectorAll(selector);
                return elements.length === count;
            },
            { selector, count: expectedCount },
            { timeout },
        );
    }

    /**
     * 模拟键盘组合键
     */
    static async pressKeyboardShortcut(page: Page, shortcut: string): Promise<void> {
        const keys = shortcut.split("+").map((key) => key.trim());

        if (keys.length === 1) {
            await page.keyboard.press(keys[0]);
        } else {
            // 处理组合键
            const modifiers = keys.slice(0, -1);
            const mainKey = keys[keys.length - 1];

            // 按下修饰键
            for (const modifier of modifiers) {
                await page.keyboard.down(modifier);
            }

            // 按下主键
            await page.keyboard.press(mainKey);

            // 释放修饰键
            for (const modifier of modifiers.reverse()) {
                await page.keyboard.up(modifier);
            }
        }
    }

    /**
     * 获取元素的计算样式
     */
    static async getComputedStyle(page: Page, selector: string, property: string): Promise<string> {
        return await page.evaluate(
            ({ selector, property }) => {
                const element = document.querySelector(selector);
                if (!element) throw new Error(`Element not found: ${selector}`);
                return window.getComputedStyle(element).getPropertyValue(property);
            },
            { selector, property },
        );
    }

    /**
     * 等待网络空闲
     */
    static async waitForNetworkIdle(page: Page, timeout = 5000): Promise<void> {
        await page.waitForLoadState("networkidle", { timeout });
    }

    /**
     * 模拟文件拖拽
     */
    static async simulateFileDrop(
        page: Page,
        targetSelector: string,
        files: string[],
    ): Promise<void> {
        await page.evaluate(
            ({ selector, files }) => {
                const element = document.querySelector(selector);
                if (!element) throw new Error(`Target element not found: ${selector}`);

                const dataTransfer = new DataTransfer();

                files.forEach((filePath) => {
                    // 创建模拟文件对象
                    const file = new File([""], filePath, { type: "image/jpeg" });
                    dataTransfer.items.add(file);
                });

                const dragEvent = new DragEvent("drop", {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer,
                });

                element.dispatchEvent(dragEvent);
            },
            { selector: targetSelector, files },
        );
    }

    /**
     * 截屏并保存到指定路径
     */
    static async takeScreenshot(
        page: Page,
        name: string,
        options: { fullPage?: boolean } = {},
    ): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `${name}-${timestamp}.png`;
        const screenshotPath = path.join("test-results", "screenshots", fileName);

        await fs.ensureDir(path.dirname(screenshotPath));
        await page.screenshot({
            path: screenshotPath,
            fullPage: options.fullPage ?? true,
        });

        return screenshotPath;
    }

    /**
     * 等待动画完成
     */
    static async waitForAnimation(page: Page, selector?: string, timeout = 2000): Promise<void> {
        if (selector) {
            // 等待特定元素的动画完成
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    if (!element) return true;

                    const animations = element.getAnimations();
                    return animations.every((animation) => animation.playState === "finished");
                },
                selector,
                { timeout },
            );
        } else {
            // 通用等待时间
            await page.waitForTimeout(timeout);
        }
    }

    /**
     * 检查控制台错误
     */
    static setupConsoleErrorTracking(page: Page): string[] {
        const errors: string[] = [];

        page.on("console", (msg) => {
            if (msg.type() === "error") {
                errors.push(msg.text());
            }
        });

        page.on("pageerror", (error) => {
            errors.push(error.message);
        });

        return errors;
    }

    /**
     * 滚动到元素
     */
    static async scrollToElement(page: Page, selector: string): Promise<void> {
        await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, selector);

        // 等待滚动完成
        await this.waitForAnimation(page);
    }

    /**
     * 获取本地存储数据
     */
    static async getLocalStorageItem(page: Page, key: string): Promise<string | null> {
        return await page.evaluate((key) => {
            return localStorage.getItem(key);
        }, key);
    }

    /**
     * 设置本地存储数据
     */
    static async setLocalStorageItem(page: Page, key: string, value: string): Promise<void> {
        await page.evaluate(
            ({ key, value }) => {
                localStorage.setItem(key, value);
            },
            { key, value },
        );
    }

    /**
     * 创建临时目录
     */
    static async createTempDirectory(prefix = "test-"): Promise<string> {
        const tempDir = path.join(
            __dirname,
            "../test-data",
            `${prefix}${this.generateRandomString()}`,
        );
        await fs.ensureDir(tempDir);
        return tempDir;
    }

    /**
     * 清理临时目录
     */
    static async cleanupTempDirectory(dirPath: string): Promise<void> {
        try {
            if (await fs.pathExists(dirPath)) {
                await fs.remove(dirPath);
            }
        } catch (error) {
            console.warn(`Warning: Could not cleanup temp directory ${dirPath}:`, error);
        }
    }
}
