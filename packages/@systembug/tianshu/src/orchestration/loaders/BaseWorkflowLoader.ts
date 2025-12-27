/**
 * 驺吾工作流加载器基类
 *
 * 提供平台中立的工作流解析和验证逻辑
 */

import { IWorkflowLoader, Logger } from "../../types/runtime-interfaces";
import { WorkflowParser, WorkflowDefinition } from "@zouwu-wf/workflow";

/**
 * 工作流数据接口 (Alias to Zouwu type)
 */
export type WorkflowData = WorkflowDefinition;

/**
 * 基于抽象类的加载器实现
 */
export abstract class BaseWorkflowLoader implements IWorkflowLoader {
    protected logger?: Logger;
    private parser: WorkflowParser;

    constructor(logger?: Logger) {
        this.logger = logger;
        this.parser = new WorkflowParser();
    }

    /**
     * 从内容加载工作流
     */
    async loadFromContent(content: string | object): Promise<WorkflowData> {
        try {
            const workflow = this.parser.parse(content);
            this.logger?.debug?.(`Loaded workflow: ${workflow.id || workflow.name}`);
            return workflow;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger?.error?.(`Failed to load workflow: ${msg}`);
            throw new Error(`Workflow loading failed: ${msg}`);
        }
    }

    /**
     * 从URL/路径加载 (由子类实现具体IO)
     */
    abstract load(source: string): Promise<WorkflowData>;
}
