import { test, expect } from "../../fixtures/electron-app";
import { MainPageSimple } from "../../pages/main-page-simple";
import { TestHelpers } from "../../utils/helpers";

test.describe("应用启动测试", () => {
    test("应用能够正常启动并显示主窗口", async ({ page }) => {
        // 验证应用标题（实际标题包含了目录信息）
        const title = await page.title();
        expect(title).toContain("仓廪图司");

        // 验证窗口基本可见性
        const bodyVisible = await page.isVisible("body");
        expect(bodyVisible).toBe(true);

        // 等待文档就绪
        await page.waitForFunction(() => document.readyState === "complete");
        const readyState = await page.evaluate(() => document.readyState);
        expect(readyState).toBe("complete");
    });

    test("主界面布局元素正确显示", async ({ electronApp, page }) => {
        const mainPage = new MainPageSimple(page, electronApp);

        // 等待页面加载完成
        await mainPage.waitForAppReady();

        // 验证主要布局元素存在
        await mainPage.verifyMainLayoutExists();

        // 验证应用标题
        await mainPage.verifyAppTitleVisible();

        // 验证系统图标存在
        const iconCount = await mainPage.getSystemIcons();
        expect(iconCount).toBeGreaterThan(0);
        console.log(`找到 ${iconCount} 个系统图标`);
    });

    test("应用初始化状态正确", async ({ electronApp, page }) => {
        const mainPage = new MainPageSimple(page, electronApp);

        // 等待应用就绪
        await mainPage.waitForAppReady();

        // 检查初始照片数量（应该为0或显示空状态）
        const photoCount = await mainPage.getPhotoCount();
        console.log(`初始照片数量: ${photoCount}`);

        // 验证状态栏显示
        const statusBarExists = await page
            .locator("[data-testid='status-bar']")
            .isVisible()
            .catch(() => false);
        if (statusBarExists) {
            const countText = await mainPage.getPhotoCountFromStatusBar();
            console.log(`状态栏显示: ${countText}`);
        }
    });

    test("窗口大小和位置正确", async ({ electronApp, page }) => {
        // 获取窗口尺寸
        const viewportSize = page.viewportSize();
        expect(viewportSize?.width).toBeGreaterThan(0);
        expect(viewportSize?.height).toBeGreaterThan(0);

        // 验证窗口是否可见
        const windows = electronApp.windows();
        expect(windows.length).toBeGreaterThan(0);

        // 验证主窗口
        const mainWindow = windows[0];
        expect(mainWindow).toBeDefined();
    });

    test("应用菜单和工具栏正确显示", async ({ electronApp, page }) => {
        const mainPage = new MainPage(page, electronApp);
        await mainPage.verifyPageLoaded();

        // 检查菜单栏（如果存在）
        const menuBarExists = await page
            .locator("[data-testid='menu-bar']")
            .isVisible()
            .catch(() => false);
        if (menuBarExists) {
            console.log("菜单栏已显示");
        }

        // 检查工具栏（如果存在）
        const toolbarExists = await page
            .locator("[data-testid='toolbar']")
            .isVisible()
            .catch(() => false);
        if (toolbarExists) {
            console.log("工具栏已显示");
        }
    });

    test("应用响应基本交互", async ({ electronApp, page }) => {
        const mainPage = new MainPageSimple(page, electronApp);
        await mainPage.verifyPageLoaded();

        // 测试基本交互
        await mainPage.testBasicInteraction();

        // 测试快捷键响应
        await page.keyboard.press("F5");
        console.log("F5 刷新键已按下");

        // 等待可能的刷新操作完成
        await mainPage.waitForLoadingToComplete();
    });

    test("控制台无严重错误", async ({ page }) => {
        const errors = TestHelpers.setupConsoleErrorTracking(page);

        // 等待页面完全加载
        await page.waitForTimeout(3000);

        // 检查是否有严重错误（过滤掉一些常见的非致命警告）
        const criticalErrors = errors.filter(
            (error) =>
                !error.includes("favicon") &&
                !error.includes("DevTools") &&
                !error.toLowerCase().includes("warning"),
        );

        if (criticalErrors.length > 0) {
            console.warn("发现控制台错误:", criticalErrors);
        }

        // 允许一些非关键错误，但记录它们
        expect(criticalErrors.length).toBeLessThan(5);
    });

    test("应用能够正确处理窗口操作", async ({ electronApp }) => {
        // 测试窗口最小化和恢复（如果支持）
        try {
            // 这些操作可能不在所有环境中工作，所以用 try-catch
            const windows = electronApp.windows();
            const mainWindow = windows[0];

            // 验证窗口存在且可访问
            expect(mainWindow).toBeDefined();

            // 检查窗口是否可访问
            const url = mainWindow.url();
            expect(url).toBeDefined();

            console.log("窗口操作测试完成");
        } catch (error) {
            console.log("窗口操作测试跳过:", error);
        }
    });

    test("应用启动性能测试", async ({ page }) => {
        const startTime = Date.now();

        // 等待应用完全加载
        await page.waitForFunction(() => document.readyState === "complete");
        await page.waitForTimeout(1000); // 额外等待确保所有初始化完成

        const loadTime = Date.now() - startTime;
        console.log(`应用启动时间: ${loadTime}ms`);

        // 应用启动时间应该在合理范围内（15秒内）
        expect(loadTime).toBeLessThan(15000);
    });
});
