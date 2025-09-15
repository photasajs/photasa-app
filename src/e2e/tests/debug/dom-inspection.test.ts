import { test } from "../../fixtures/electron-app";

test.describe("DOM 结构检查", () => {
    test("检查实际 DOM 结构", async ({ page }) => {
        // 等待页面加载
        await page.waitForLoadState("networkidle");

        // 获取页面的HTML结构
        const bodyHTML = await page.locator("body").innerHTML();
        console.log("=== Body HTML 结构 ===");
        console.log(bodyHTML.substring(0, 2000) + "...");

        // 获取所有主要元素
        const appElement = await page.locator("#app").innerHTML();
        console.log("\n=== App 元素内容 ===");
        console.log(appElement.substring(0, 1000) + "...");

        // 查找所有 data-testid 属性
        const testIds = await page.evaluate(() => {
            const elements = document.querySelectorAll("[data-testid]");
            return Array.from(elements).map((el) => ({
                testId: el.getAttribute("data-testid"),
                tagName: el.tagName,
                className: el.className,
                text: el.textContent?.substring(0, 50) || "",
            }));
        });

        console.log("\n=== 现有的 data-testid 元素 ===");
        testIds.forEach((item) => {
            console.log(`- ${item.testId}: <${item.tagName.toLowerCase()}> "${item.text}"`);
        });

        // 查找主要的导航和布局元素
        const majorElements = await page.evaluate(() => {
            const selectors = [
                "nav",
                "aside",
                "main",
                "header",
                "footer",
                ".sidebar",
                ".navigation",
                ".content",
                ".toolbar",
                '[class*="nav"]',
                '[class*="side"]',
                '[class*="main"]',
            ];

            const found = [];
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach((el) => {
                    found.push({
                        selector,
                        tagName: el.tagName,
                        className: el.className,
                        id: el.id,
                    });
                });
            }
            return found;
        });

        console.log("\n=== 主要布局元素 ===");
        majorElements.forEach((item) => {
            console.log(
                `- ${item.selector}: <${item.tagName.toLowerCase()}> id="${item.id}" class="${item.className}"`,
            );
        });

        // 截图用于调试
        await page.screenshot({
            path: "test-results/dom-inspection.png",
            fullPage: true,
        });
        console.log("\n=== 截图已保存到 test-results/dom-inspection.png ===");
    });
});
