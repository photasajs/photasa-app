/**
 * 工作流加载器
 * 负责YAML工作流文件的加载、解析、验证和缓存
 */

import * as fs from "fs-extra";
import * as path from "path";
import * as yaml from "js-yaml";
import { WorkflowDefinition } from "../types/workflows";
import { loggers } from "@common/logger";

const logger = loggers.tianshu;

/**
 * 工作流加载器配置
 */
export interface WorkflowLoaderConfig {
    /** 是否启用热重载 */
    enableHotReload: boolean;
    /** 缓存过期时间（毫秒） */
    cacheTimeout?: number;
    /** 文件监控间隔（毫秒） */
    watchInterval?: number;
}

/**
 * 工作流缓存项
 */
interface WorkflowCacheItem {
    /** 工作流定义 */
    workflow: WorkflowDefinition;
    /** 文件路径 */
    filePath: string;
    /** 最后修改时间 */
    lastModified: number;
    /** 缓存时间 */
    cachedAt: number;
}

/**
 * 工作流加载器
 */
export class WorkflowLoader {
    private workflowDir: string;
    private config: WorkflowLoaderConfig;
    private cache = new Map<string, WorkflowCacheItem>();
    private watchers = new Map<string, fs.FSWatcher>();
    private isInitialized = false;

    constructor(workflowDir: string, config: WorkflowLoaderConfig) {
        this.workflowDir = workflowDir;
        this.config = {
            cacheTimeout: 300000, // 5分钟
            watchInterval: 1000,
            ...config,
        };
    }

    /**
     * 初始化加载器
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // 确保工作流目录存在
            await fs.ensureDir(this.workflowDir);

            // 扫描并加载所有工作流
            await this.scanAndLoadWorkflows();

            // 如果启用热重载，设置文件监控
            if (this.config.enableHotReload) {
                await this.setupFileWatchers();
            }

            this.isInitialized = true;
            logger.info(`[WorkflowLoader] Initialized with ${this.cache.size} workflows`);
        } catch (error) {
            logger.error("[WorkflowLoader] Failed to initialize:", error);
            throw error;
        }
    }

    /**
     * 加载工作流
     */
    async loadWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
        logger.info("🌌 加载工作流", { workflowId });

        if (!this.isInitialized) {
            throw new Error("WorkflowLoader not initialized");
        }

        // 检查缓存
        const cached = this.cache.get(workflowId);
        if (cached && this.isCacheValid(cached)) {
            logger.info("🌌 从缓存加载工作流", { workflowId });
            return cached.workflow;
        }

        // 从文件系统加载
        const workflow = await this.loadWorkflowFromFile(workflowId);
        if (workflow) {
            logger.info("🌌 缓存工作流", { workflowId });
            this.cacheWorkflow(workflowId, workflow);
        }
        logger.info("🌌 加载工作流完成", { workflowId });
        return workflow;
    }

    /**
     * 获取所有工作流
     */
    async getAllWorkflows(): Promise<WorkflowDefinition[]> {
        if (!this.isInitialized) {
            throw new Error("WorkflowLoader not initialized");
        }

        const workflows: WorkflowDefinition[] = [];
        for (const [workflowId, cached] of Array.from(this.cache.entries())) {
            if (this.isCacheValid(cached)) {
                workflows.push(cached.workflow);
            } else {
                // 重新加载过期的工作流
                const workflow = await this.loadWorkflowFromFile(workflowId);
                if (workflow) {
                    this.cacheWorkflow(workflowId, workflow);
                    workflows.push(workflow);
                }
            }
        }

        return workflows;
    }

    /**
     * 重新加载工作流
     */
    async reloadWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
        this.cache.delete(workflowId);
        return await this.loadWorkflow(workflowId);
    }

    /**
     * 清理资源
     */
    async cleanup(): Promise<void> {
        // 关闭所有文件监控
        for (const watcher of Array.from(this.watchers.values())) {
            watcher.close();
        }
        this.watchers.clear();

        // 清空缓存
        this.cache.clear();

        this.isInitialized = false;
        logger.info("[WorkflowLoader] Cleaned up");
    }

    /**
     * 扫描并加载所有工作流
     */
    private async scanAndLoadWorkflows(): Promise<void> {
        try {
            const files = await this.findWorkflowFiles();

            for (const filePath of files) {
                const workflowId = this.getWorkflowIdFromPath(filePath);
                if (workflowId) {
                    try {
                        const workflow = await this.loadWorkflowFromFile(workflowId);
                        if (workflow) {
                            this.cacheWorkflow(workflowId, workflow);
                        }
                    } catch (error) {
                        logger.warn(
                            `[WorkflowLoader] Failed to load workflow ${workflowId}:`,
                            error,
                        );
                    }
                }
            }
        } catch (error) {
            logger.error("[WorkflowLoader] Failed to scan workflows:", error);
            throw error;
        }
    }

    /**
     * 查找工作流文件
     */
    private async findWorkflowFiles(): Promise<string[]> {
        const files: string[] = [];

        const scanDir = async (dir: string): Promise<void> => {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    await scanDir(fullPath);
                } else if (
                    entry.isFile() &&
                    (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))
                ) {
                    files.push(fullPath);
                }
            }
        };

        await scanDir(this.workflowDir);
        return files;
    }

    /**
     * 从文件加载工作流
     */
    private async loadWorkflowFromFile(workflowId: string): Promise<WorkflowDefinition | null> {
        try {
            const filePath = this.getWorkflowFilePath(workflowId);

            if (!(await fs.pathExists(filePath))) {
                return null;
            }

            const content = await fs.readFile(filePath, "utf8");
            const data = yaml.load(content) as any;

            // 验证工作流定义
            const workflow = this.validateWorkflowDefinition(data);
            if (!workflow) {
                throw new Error("Invalid workflow definition");
            }

            return workflow;
        } catch (error) {
            logger.error(`[WorkflowLoader] Failed to load workflow ${workflowId}:`, error);
            return null;
        }
    }

    /**
     * 获取工作流文件路径
     */
    private getWorkflowFilePath(workflowId: string): string {
        return path.join(this.workflowDir, `${workflowId}.yml`);
    }

    /**
     * 从文件路径获取工作流ID
     */
    private getWorkflowIdFromPath(filePath: string): string | null {
        const relativePath = path.relative(this.workflowDir, filePath);
        const workflowId = relativePath.replace(/\.(yml|yaml)$/, "");
        return workflowId || null;
    }

    /**
     * 验证工作流定义
     */
    private validateWorkflowDefinition(data: any): WorkflowDefinition | null {
        try {
            // 基本验证
            if (!data || typeof data !== "object") {
                return null;
            }

            if (!data.id || !data.name || !data.version || !Array.isArray(data.steps)) {
                return null;
            }

            // 构建工作流定义
            const workflow: WorkflowDefinition = {
                id: data.id,
                name: data.name,
                description: data.description,
                version: data.version,
                author: data.author,
                createdAt: data.createdAt || Date.now(),
                updatedAt: data.updatedAt || Date.now(),
                steps: data.steps,
                inputSchema: data.inputSchema,
                outputSchema: data.outputSchema,
                variables: data.variables,
                tags: data.tags,
                enabled: data.enabled !== false,
                timeout: data.timeout,
                retry: data.retry,
            };

            return workflow;
        } catch (error) {
            logger.error("[WorkflowLoader] Invalid workflow definition:", error);
            return null;
        }
    }

    /**
     * 缓存工作流
     */
    private cacheWorkflow(workflowId: string, workflow: WorkflowDefinition): void {
        const filePath = this.getWorkflowFilePath(workflowId);
        const stats = fs.statSync(filePath);

        this.cache.set(workflowId, {
            workflow,
            filePath,
            lastModified: stats.mtimeMs,
            cachedAt: Date.now(),
        });
    }

    /**
     * 检查缓存是否有效
     */
    private isCacheValid(cached: WorkflowCacheItem): boolean {
        const now = Date.now();
        const cacheAge = now - cached.cachedAt;

        // 检查缓存是否过期
        if (cacheAge > (this.config.cacheTimeout || 300000)) {
            return false;
        }

        // 如果启用热重载，检查文件是否被修改
        if (this.config.enableHotReload) {
            try {
                const stats = fs.statSync(cached.filePath);
                return stats.mtimeMs <= cached.lastModified;
            } catch {
                return false;
            }
        }

        return true;
    }

    /**
     * 设置文件监控
     */
    private async setupFileWatchers(): Promise<void> {
        try {
            const files = await this.findWorkflowFiles();

            for (const filePath of files) {
                const workflowId = this.getWorkflowIdFromPath(filePath);
                if (workflowId) {
                    const watcher = fs.watch(filePath, async (eventType) => {
                        if (eventType === "change") {
                            logger.info(`[WorkflowLoader] Workflow file changed: ${workflowId}`);
                            await this.reloadWorkflow(workflowId);
                        }
                    });

                    this.watchers.set(workflowId, watcher);
                }
            }
        } catch (error) {
            logger.error("[WorkflowLoader] Failed to setup file watchers:", error);
        }
    }
}
