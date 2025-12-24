import { Page, ElectronApplication } from "@playwright/test";
import { BasePage } from "./base-page";

export class MainPageSimple extends BasePage {
    // 基于实际DOM结构的页面选择器
    private readonly selectors = {
        // 主要布局元素
        appLayout: ".app-layout",
        titlebarContainer: "header.titlebar-container",
        appHeader: ".app-header",
        appTitle: ".app-title",
        contentContainer: ".content.app-container",

        // 导航元素
        breadcrumb: "nav.base-breadcrumb",
        settingHeader: ".setting-header",
        systemIcon: ".system-icon",

        // 主内容区域
        mainContent: ".content",
    };

    constructor(page: Page, app: ElectronApplication) {
        super(page, app);
    }

    // 页面验证
    async verifyPageLoaded(): Promise<void> {
        await this.verifyElementExists(this.selectors.contentContainer);
        const title = await this.page.title();
        console.log(`页面标题: ${title}`);
        await this.waitForAppReady();
    }

    async verifyMainLayoutExists(): Promise<void> {
        await this.verifyElementExists(this.selectors.appLayout);
        await this.verifyElementExists(this.selectors.titlebarContainer);
        await this.verifyElementExists(this.selectors.appHeader);
        await this.verifyElementExists(this.selectors.contentContainer);
    }

    // 应用标题和基本信息
    async getAppTitle(): Promise<string> {
        const titleElement = await this.waitForSelector(this.selectors.appTitle);
        return (await titleElement.textContent()) || "";
    }

    async verifyAppTitleVisible(): Promise<void> {
        await this.verifyElementExists(this.selectors.appTitle);
        const title = await this.getAppTitle();
        console.log(`应用标题: ${title}`);
    }

    // 系统图标操作（设置区域的图标）
    async getSystemIcons(): Promise<number> {
        const icons = this.page.locator(this.selectors.systemIcon);
        return await icons.count();
    }

    async clickSystemIcon(index: number): Promise<void> {
        const icons = this.page.locator(this.selectors.systemIcon);
        await icons.nth(index).click();
    }

    // 面包屑导航
    async getBreadcrumbCount(): Promise<number> {
        const breadcrumbs = this.page.locator(this.selectors.breadcrumb);
        return await breadcrumbs.count();
    }

    // 基本交互测试
    async testBasicInteraction(): Promise<void> {
        // 点击应用标题
        await this.clickElement(this.selectors.appTitle);
        console.log("应用标题点击测试完成");

        // 如果有系统图标，测试点击
        const iconCount = await this.getSystemIcons();
        if (iconCount > 0) {
            console.log(`发现 ${iconCount} 个系统图标，测试第一个`);
            // 注意：实际测试中小心点击，可能会触发实际操作
        }
    }
}
