import { v4 as uuidv4 } from "uuid";
import type { WorkerMessage, WorkerResponse } from "@common/types";

// 任务ID到Promise的映射
const pendingTasks = new Map<
    string,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
>();

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
): Promise<R> {
    const id = uuidv4();
    const message: WorkerMessage<T> = { id, action, payload };
    return new Promise<R>((resolve, reject) => {
        pendingTasks.set(id, { resolve, reject });
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
    } as WorkerResponse<R>;
}
