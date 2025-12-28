/**
 * 驺吾工作流运行时核心接口
 * 保持平台中立，不依赖Node.js或浏览器特定API
 */

import type { Logger } from "@systembug/diting";

/**
 * 工作流执行选项
 */
export interface WorkflowExecutionOptions {
    /** 是否异步执行 */
    async?: boolean;
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 全局变量 */
    variables?: Record<string, any>;
    /** 执行上下文元数据 */
    metadata?: Record<string, any>;
}

/**
 * 步骤执行结果
 */
export interface StepExecutionResult {
    /** 是否成功 */
    success: boolean;
    /** 返回数据 */
    data?: any;
    /** 错误信息 */
    error?: string;
    /** 元数据 */
    metadata?: {
        duration: number;
        engineName?: string;
        [key: string]: any;
    };
}

/**
 * 步骤执行器接口
 * 用于执行action和builtin类型的步骤
 * 由外部注入（如太乙引擎）
 */
export interface IStepExecutor {
    /**
     * 初始化执行器
     */
    initialize(): Promise<void>;

    /**
     * 执行步骤
     */
    executeAction(step: any, context: any): Promise<StepExecutionResult>;

    /**
     * 事件监听
     */
    on(event: string, callback: (data: any) => void): void;
    off(event: string, callback: (data: any) => void): void;
    once(event: string, callback: (data: any) => void): this;
    removeAllListeners(event?: string): void;
}

/**
 * 变量解析器接口
 */
export interface IVariableResolver {
    /**
     * 解析模板字符串中的变量
     * @param template 模板字符串，如 "{{inputs.name}}"
     * @param context 执行上下文
     */
    resolve(template: string, context: any): any;

    /**
     * 解析对象中的所有变量
     */
    resolveObject(obj: any, context: any): any;
}

/**
 * 工作流编排器接口
 */
export interface IWorkflowOrchestrator {
    /**
     * 初始化编排器
     */
    initialize(): Promise<void>;

    /**
     * 执行工作流
     */
    executeWorkflow(
        workflow: any,
        command: any,
        options?: WorkflowExecutionOptions,
    ): Promise<string>;

    /**
     * 取消工作流执行
     */
    cancelExecution(executionId: string): Promise<boolean>;

    /**
     * 获取执行上下文
     */
    getExecutionContext(executionId: string): any;

    /**
     * 清理资源
     */
    cleanup(): Promise<void>;
}

/**
 * 工作流加载器接口
 */
export interface IWorkflowLoader {
    /**
     * 从内容加载工作流
     */
    loadFromContent(content: string | object): Promise<any>;
}

// 导出Logger类型供使用
export type { Logger };
