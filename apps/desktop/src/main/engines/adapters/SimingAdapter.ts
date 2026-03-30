/**
 * 司命引擎适配器
 * RFC 0042 Step 2.5: 实现太乙@Adapter模式，包装SimingEngine为标准适配器接口
 *
 * 职责：
 * 1. 管理appState持久化（folderTree + currentFolder等）
 * 2. 提供appState的CRUD操作
 * 3. 存储位置：~/.photasa/appState/
 *
 * 历史背景：
 * 司命，道教神祇，主管生命寿算，负责记录和管理人间寿命
 * 在架构中负责管理和持久化应用运行时状态
 */

import { Adapter, AdapterPriority, IAdapter } from "@photasa/taiyi";
import { SimingEngine, type AppState } from "@photasa/siming";
import type { FolderNode } from "@photasa/common";
import { loggers } from "@photasa/common";

const logger = loggers.siming;

/**
 * 司命引擎适配器
 * 使用@Adapter装饰器注册到太乙注册中心
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
@Adapter({
    name: "siming",
    displayName: "司命appState管理适配器",
    priority: AdapterPriority.High,
    description: "管理appState持久化的适配器，负责folderTree和其他应用状态的存储和恢复",
    engineType: "appstate",
    dependencies: [], // 司命引擎不依赖其他引擎
    retryOnFailure: true,
    maxRetries: 3,
})
export class SimingAdapter implements IAdapter {
    readonly name = "siming";
    private engine: SimingEngine;

    constructor() {
        this.engine = new SimingEngine();
    }

    /**
     * 初始化适配器
     */
    async initialize(): Promise<void> {
        await this.engine.initialize();
        logger.info("🌌 司命星君归位，掌管应用状态");
    }

    /**
     * 关闭适配器
     */
    async shutdown(): Promise<void> {
        await this.engine.shutdown();
        logger.info("🌌 司命星君归隐，应用状态封存");
    }

    /**
     * ✅ RFC 0042 Step 2.5: 持久化文件夹树
     * 委托给司命引擎的persistFolderTree方法
     */
    async persistFolderTree(tree: FolderNode[]): Promise<void> {
        return this.engine.persistFolderTree(tree);
    }

    /**
     * ✅ RFC 0042 Step 2.5: 恢复文件夹树
     * 委托给司命引擎的restoreFolderTree方法
     */
    async restoreFolderTree(): Promise<FolderNode[]> {
        return this.engine.restoreFolderTree();
    }

    /**
     * ✅ RFC 0042 Step 2.5: 清空文件夹树
     * 委托给司命引擎的clearFolderTree方法
     */
    async clearFolderTree(): Promise<void> {
        return this.engine.clearFolderTree();
    }

    /**
     * ✅ RFC 0042 Step 2.5: 恢复完整应用状态
     * 委托给司命引擎的restoreAppState方法
     */
    async restoreAppState(): Promise<AppState> {
        return this.engine.restoreAppState();
    }

    /**
     * 检查适配器是否就绪
     */
    isReady(): boolean {
        return true; // SimingEngine初始化后即就绪
    }
}
