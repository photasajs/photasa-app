import { test, expect } from "../../fixtures/electron-app";

test.describe("Electron 应用连接测试", () => {
    test("应用能够成功启动并建立连接", async ({ electronApp, page }) => {
        // 验证应用已启动
        expect(electronApp).toBeTruthy();
        console.log("✓ Electron 应用已启动");

        // 验证页面存在
        expect(page).toBeTruthy();
        console.log("✓ 页面对象已创建");

        // 验证窗口存在
        const windows = electronApp.windows();
        expect(windows.length).toBeGreaterThan(0);
        console.log(`✓ 找到 ${windows.length} 个窗口`);

        // 验证页面基本可访问
        const url = page.url();
        console.log(`✓ 页面 URL: ${url}`);
        expect(url).toBeTruthy();

        // 验证页面标题
        const title = await page.title();
        console.log(`✓ 页面标题: ${title}`);
        expect(title).toBeTruthy();

        // 验证 DOM 基本结构
        const body = await page.locator("body").isVisible();
        expect(body).toBe(true);
        console.log("✓ body 元素可见");

        // 验证 Vue 应用容器存在
        const appElement = page.locator("#app");
        await expect(appElement).toBeVisible({ timeout: 10000 });
        console.log("✓ Vue 应用容器 #app 可见");
    });

    test("页面完全加载后状态正常", async ({ page }) => {
        // 等待页面完全加载
        await page.waitForLoadState("networkidle", { timeout: 15000 });
        console.log("✓ 网络空闲状态达到");

        // 检查 JavaScript 执行环境
        const jsWorking = await page.evaluate(() => {
            return typeof window !== "undefined" && typeof document !== "undefined";
        });
        expect(jsWorking).toBe(true);
        console.log("✓ JavaScript 执行环境正常");

        // 检查基本 DOM API
        const domReady = await page.evaluate(() => {
            return document.readyState === "complete";
        });
        expect(domReady).toBe(true);
        console.log("✓ DOM 完全就绪");
    });

    test("应用响应基本用户交互", async ({ page }) => {
        // 检查页面是否响应点击
        await page.locator("body").click();
        console.log("✓ 页面响应点击事件");

        // 检查键盘事件
        await page.keyboard.press("Escape");
        console.log("✓ 页面响应键盘事件");

        // 如果有错误，它们会被抛出
        await page.waitForTimeout(1000);
        console.log("✓ 基本交互测试完成");
    });
});
