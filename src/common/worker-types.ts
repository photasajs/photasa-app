export type WorkerAction = "query" | "add" | "remove";

export interface WorkerMessage {
    action: WorkerAction;
    queueId?: number;
    paths?: string[];
    from?: "query" | "add" | "remove";
}

export interface WorkerResponse {
    action: "next" | "complete" | "error";
    queueId?: number;
    from?: "query" | "add" | "remove";
    path?: string;
    paths?: string[];
    config?: any;
    error?: string;
    err?: Error;
}

export interface WorkerHandler {
    (result: WorkerMessage, postMessage: (message: string) => void, logger: any): void;
}

export interface WorkerHandlers {
    query: WorkerHandler;
    add: WorkerHandler;
    remove: WorkerHandler;
}
