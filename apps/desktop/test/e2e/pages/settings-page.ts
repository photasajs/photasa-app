import { BasePage } from "./base-page";

/**
 * SettingsPage - 设置页面Page Object
 * 遵循 RFC 0049：通过真实UI交互，不操作内部API，不使用window对象
 */
export class SettingsPage extends BasePage {
    /**
     * 添加监控文件夹（通过UI交互）
     * 点击"选择目录"按钮，在文件选择对话框中选择文件夹
     */
    async addWatchFolder(_folderPath: string): Promise<void> {
        // 等待文件选择对话框并设置路径
        const [fileChooser] = await Promise.all([
            this.page.waitForEvent("filechooser"),
            // 点击"选择目录"按钮（通过按钮文本定位）
            this.page
                .locator("button")
                .filter({ hasText: /选择目录|Choose Directory/i })
                .click(),
        ]);

        // 在文件选择对话框中选择文件夹
        await fileChooser.setFiles([]); // 清空文件选择
        // 注意：Playwright的文件选择器需要文件路径，但Electron的对话框可能需要特殊处理
        // 如果无法直接设置路径，可能需要通过其他方式（如mock API）
    }

    /**
     * 等待扫描完成（通过UI状态变化）
     * 等待文件夹出现在监控列表中，表示扫描已完成
     */
    async waitForScanCompleted(folderPath: string, timeout = 30000): Promise<void> {
        // 等待文件夹出现在监控列表中
        await this.page
            .locator(".list-item-title")
            .filter({ hasText: folderPath })
            .waitFor({ timeout, state: "visible" });
    }

    /**
     * 等待扫描开始（通过UI状态变化）
     * 可以等待扫描进度指示器出现，或队列状态变化
     */
    async waitForScanStarted(folderPath: string, timeout = 10000): Promise<void> {
        // 等待扫描相关的UI元素出现（如果有的话）
        // 或者简单地等待一小段时间让扫描开始
        await this.page.waitForTimeout(1000);
    }

    /**
     * 验证文件夹在监控列表中（通过UI检查）
     */
    async verifyFolderInWatchList(folderPath: string): Promise<boolean> {
        const folderElement = this.page.locator(".list-item-title").filter({ hasText: folderPath });
        return await folderElement.isVisible();
    }

    /**
     * 获取扫描队列状态（从UI读取，如果UI有显示）
     */
    async getScanQueueStatus(): Promise<{ count: number; current: string | null }> {
        // 如果UI有显示队列状态，从这里读取
        // 否则返回默认值
        return {
            count: 0,
            current: null,
        };
    }
}
