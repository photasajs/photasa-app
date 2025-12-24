import { Page, ElectronApplication } from "@playwright/test";
import { BasePage } from "./base-page";

export class MainPage extends BasePage {
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
        folderView: ".folder-view", // 可能的类名
        photoGrid: ".photo-grid", // 可能的类名

        // 通用元素
        button: "button",
        link: "a",
        input: "input",

        // 可能存在的照片相关元素
        photoItem: ".photo-item, .image-item, .file-item",
        thumbnail: ".thumbnail, .thumb, .preview",

        // 可能存在的文件夹相关元素
        folderItem: ".folder-item, .directory-item",
        folderList: ".folder-list, .directory-list",
    };

    constructor(page: Page, app: ElectronApplication) {
        super(page, app);
    }

    // 页面验证
    async verifyPageLoaded(): Promise<void> {
        await this.verifyElementExists(this.selectors.mainContent);
        await this.verifyPageTitle("Photasa");
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

    // 文件夹树操作
    async expandFolder(folderName: string): Promise<void> {
        const folderSelector = `${this.selectors.folderItem}[data-folder-name="${folderName}"]`;
        await this.clickElement(folderSelector);
    }

    async selectFolder(folderName: string): Promise<void> {
        const folderSelector = `${this.selectors.folderItem}[data-folder-name="${folderName}"]`;
        await this.clickElement(folderSelector);

        // 等待照片加载
        await this.waitForLoadingToComplete();
    }

    async getFolderCount(): Promise<number> {
        const folders = this.page.locator(this.selectors.folderItem);
        return await folders.count();
    }

    // 照片网格操作
    async getPhotoCount(): Promise<number> {
        const photos = this.page.locator(this.selectors.photoItem);
        await photos
            .first()
            .waitFor({ timeout: 5000 })
            .catch(() => {
                // 没有照片时不报错
            });
        return await photos.count();
    }

    async clickPhoto(index: number): Promise<void> {
        const photos = this.page.locator(this.selectors.photoItem);
        await photos.nth(index).click();
    }

    async doubleClickPhoto(index: number): Promise<void> {
        const photos = this.page.locator(this.selectors.photoItem);
        await photos.nth(index).dblclick();
    }

    async getPhotoName(index: number): Promise<string> {
        const photos = this.page.locator(this.selectors.photoName);
        const photoName = photos.nth(index);
        return (await photoName.textContent()) || "";
    }

    async verifyPhotoExists(photoName: string): Promise<void> {
        const photoSelector = `${this.selectors.photoItem}:has(${this.selectors.photoName}:has-text("${photoName}"))`;
        await this.verifyElementExists(photoSelector);
    }

    // 搜索功能
    async searchPhotos(query: string): Promise<void> {
        await this.fillInput(this.selectors.searchInput, query);
        await this.clickElement(this.selectors.searchButton);

        // 等待搜索结果
        await this.waitForLoadingToComplete();
    }

    async clearSearch(): Promise<void> {
        await this.fillInput(this.selectors.searchInput, "");
        await this.page.keyboard.press("Enter");
        await this.waitForLoadingToComplete();
    }

    // 工具栏操作
    async changeViewMode(): Promise<void> {
        await this.clickElement(this.selectors.viewModeButton);
    }

    async clickSortButton(): Promise<void> {
        await this.clickElement(this.selectors.sortButton);
    }

    // 状态信息
    async getPhotoCountFromStatusBar(): Promise<string> {
        const countElement = await this.waitForSelector(this.selectors.photoCount);
        return (await countElement.textContent()) || "0";
    }

    // 菜单操作
    async openFileMenu(): Promise<void> {
        await this.clickElement(this.selectors.fileMenu);
    }

    async openEditMenu(): Promise<void> {
        await this.clickElement(this.selectors.editMenu);
    }

    async openViewMenu(): Promise<void> {
        await this.clickElement(this.selectors.viewMenu);
    }

    // 键盘快捷键
    async pressCtrlA(): Promise<void> {
        await this.page.keyboard.press("Control+a");
    }

    async pressDelete(): Promise<void> {
        await this.page.keyboard.press("Delete");
    }

    async pressF5(): Promise<void> {
        await this.page.keyboard.press("F5");
        await this.waitForLoadingToComplete();
    }

    // 拖拽操作
    async dragPhotoToFolder(photoIndex: number, folderName: string): Promise<void> {
        const photo = this.page.locator(this.selectors.photoItem).nth(photoIndex);
        const targetFolder = this.page.locator(
            `${this.selectors.folderItem}[data-folder-name="${folderName}"]`,
        );

        await photo.dragTo(targetFolder);

        // 等待操作完成
        await this.waitForLoadingToComplete();
    }

    // 右键菜单
    async rightClickPhoto(index: number): Promise<void> {
        const photos = this.page.locator(this.selectors.photoItem);
        await photos.nth(index).click({ button: "right" });
    }

    async rightClickFolder(folderName: string): Promise<void> {
        const folderSelector = `${this.selectors.folderItem}[data-folder-name="${folderName}"]`;
        await this.page.locator(folderSelector).click({ button: "right" });
    }

    // 批量选择
    async selectMultiplePhotos(indices: number[]): Promise<void> {
        if (indices.length === 0) return;

        // 点击第一张照片
        const photos = this.page.locator(this.selectors.photoItem);
        await photos.nth(indices[0]).click();

        // 按住 Ctrl 点击其他照片
        for (let i = 1; i < indices.length; i++) {
            await photos.nth(indices[i]).click({ modifiers: ["Control"] });
        }
    }

    // 等待特定状态
    async waitForPhotosToLoad(expectedCount?: number): Promise<void> {
        await this.waitForLoadingToComplete();

        if (expectedCount !== undefined) {
            await this.page.waitForFunction(
                (count) => {
                    const photos = document.querySelectorAll('[data-testid="photo-item"]');
                    return photos.length === count;
                },
                expectedCount,
                { timeout: 10000 },
            );
        }
    }

    async waitForEmptyState(): Promise<void> {
        await this.page.waitForFunction(
            () => {
                const photos = document.querySelectorAll('[data-testid="photo-item"]');
                return photos.length === 0;
            },
            { timeout: 5000 },
        );
    }
}
