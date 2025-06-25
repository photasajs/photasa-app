import { PhotasaLogger } from "./logger";

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
    config?: unknown;
    error?: string;
    err?: Error;
}

export interface WorkerHandler {
    (result: WorkerMessage, postMessage: (message: string) => void, logger: PhotasaLogger): void;
}

export interface WorkerHandlers {
    query: WorkerHandler;
    add: WorkerHandler;
    remove: WorkerHandler;
}
