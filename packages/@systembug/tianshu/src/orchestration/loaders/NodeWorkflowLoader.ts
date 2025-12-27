/**
 * Node.js 工作流加载器
 *
 * 使用 Node.js fs 模块加载文件
 */

import { BaseWorkflowLoader, WorkflowData } from "./BaseWorkflowLoader";
import { Logger } from "../../types/runtime-interfaces";
import * as fs from "fs";
import * as path from "path";

export class NodeWorkflowLoader extends BaseWorkflowLoader {
    constructor(logger?: Logger) {
        super(logger);
    }

    /**
     * 从文件路径加载
     */
    async load(filePath: string): Promise<WorkflowData> {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const content = await fs.promises.readFile(filePath, "utf-8");
            const workflow = await this.loadFromContent(content);

            this.logger?.debug?.(`Loaded workflow from file: ${filePath}`);
            return workflow;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger?.error?.(`Failed to load workflow file: ${filePath}, error: ${msg}`);
            throw error;
        }
    }

    /**
     * 扫描目录加载工作流
     */
    async loadFromDirectory(dirPath: string, recursive = false): Promise<WorkflowData[]> {
        const workflows: WorkflowData[] = [];

        if (!fs.existsSync(dirPath)) {
            return workflows;
        }

        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory() && recursive) {
                const subWorkflows = await this.loadFromDirectory(fullPath, recursive);
                workflows.push(...subWorkflows);
            } else if (entry.isFile()) {
                if (
                    entry.name.endsWith(".yaml") ||
                    entry.name.endsWith(".yml") ||
                    entry.name.endsWith(".json")
                ) {
                    try {
                        const workflow = await this.load(fullPath);
                        workflows.push(workflow);
                    } catch (error) {
                        this.logger?.warn?.(`Skipping invalid workflow file: ${fullPath}`);
                    }
                }
            }
        }

        return workflows;
    }
}
