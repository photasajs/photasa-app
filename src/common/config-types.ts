import { PhotasaLogger } from "./logger";

export type WorkerAction = "query" | "add" | "remove";

export interface ConfigRequest {
    action: WorkerAction;
    queueId?: number;
    paths?: string[];
    from?: "query" | "add" | "remove";
}

export interface ConfigResponse {
    action: "next" | "complete" | "error";
    queueId?: number;
    from?: "query" | "add" | "remove";
    path?: string;
    paths?: string[];
    config?: unknown;
    error?: string;
    err?: Error;
}

export interface ConfigHandler {
    (result: ConfigRequest, postMessage: (message: string) => void, logger: PhotasaLogger): void;
}

export interface ConfigHandlers {
    query: ConfigHandler;
    add: ConfigHandler;
    remove: ConfigHandler;
}
