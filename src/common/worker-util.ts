import { v4 as uuidv4 } from "uuid";
import type { WorkerMessage, WorkerResponse } from "@common/types";
/**
 * 确保主进程与 worker 端通过 WorkerMessage 和 WorkerResponse 进行通信
 * 请求与响应通过一一对应，用于 invoke/handle 模式通过Promise保持同步
 */

// 任务ID到Promise的映射
const pendingTasks = new Map<
    string,
    { resolve: (value: any) => void; reject: (reason?: any) => void } // value and reason can be of any type
>();

// 任务ID到进度回调的映射
const progressCallbacks = new Map<string, (progress: any) => void>();

// Worker 泛型类型，主进程与 worker 端类型安全通信
export interface Worker<T, R> {
    on: (event: string, callback: (message: WorkerResponse<R>) => void) => void;
    postMessage: (message: WorkerMessage<T>) => void;
    terminate: () => void;
}

/**
 * 发送任务到worker，自动管理ID与Promise
 */
export function sendWorkerTask<W extends Worker<T, R>, T, R>(
    worker: W,
    action: string,
    payload: T,
    onProgress?: (progress: any) => void,
): Promise<R> {
    const id = uuidv4();
    const message: WorkerMessage<T> = { id, action, payload };
    return new Promise<R>((resolve, reject) => {
        pendingTasks.set(id, { resolve, reject });

        // 存储进度回调
        if (onProgress) {
            progressCallbacks.set(id, onProgress);
        }

        worker.postMessage(message);
    });
}

// 监听worker响应，主进程需在worker.on('message', onWorkerResponse)注册
export function onWorkerResponse<R>(response: WorkerResponse<R>) {
    const { id, result, error } = response;
    const task = pendingTasks.get(id);
    if (!task) return;
    if (error) {
        task.reject(new Error(error));
    } else {
        task.resolve(result);
    }
    pendingTasks.delete(id);
    progressCallbacks.delete(id); // 清理进度回调
}

// 处理预览进度事件
export function onPreviewProgressEvent(event: PreviewProgressEvent) {
    const callback = progressCallbacks.get(event.taskId);
    if (callback) {
        callback(event.data);
    }
}

/**
 * 创建响应消息
 * @param message - 消息
 * @param result - 结果
 * @returns 响应消息
 */
export function createResponse<T, R>(message: WorkerMessage<T>, result: R): WorkerResponse<R> {
    return {
        id: message.id,
        result,
    } as WorkerResponse<R>; // Type assertion to ensure compatibility
}

/**
 * 进度事件接口
 */
export interface ProgressEvent {
    type: "progress";
    taskId: string;
    data: {
        processedFiles: number;
        totalFiles: number;
        successfulFiles: number;
        skippedFiles: number;
        errorFiles: number;
        currentFile: string;
        speed: number;
        estimatedTimeRemaining: number;
        errors?: any[];
        warnings?: any[];
    };
}

/**
 * 预览进度事件接口
 */
export interface PreviewProgressEvent {
    type: "preview_progress";
    taskId: string;
    data: any; // PreviewProgress类型，避免循环依赖
}

/**
 * 创建进度事件对象 (用于worker端构造进度消息)
 */
export function createProgressEvent(
    taskId: string,
    progressData: ProgressEvent["data"],
): ProgressEvent {
    return {
        type: "progress",
        taskId,
        data: progressData,
    };
}

/**
 * 创建预览进度事件对象
 */
export function createPreviewProgressEvent(
    taskId: string,
    progressData: any, // PreviewProgress类型
): PreviewProgressEvent {
    return {
        type: "preview_progress",
        taskId,
        data: progressData,
    };
}
