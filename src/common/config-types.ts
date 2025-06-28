import { PhotasaLogger } from "./logger";
import { PhotasaConfigResult } from "./types";

export type ConfigAction = "query" | "add" | "remove";

export interface ConfigRequest {
    action: ConfigAction;
    queueId?: number;
    paths?: string[];
    from?: "query" | "add" | "remove";
}

export interface ConfigResponse extends PhotasaConfigResult {
    action: "next" | "complete" | "error";
    queueId?: number;
    from?: "query" | "add" | "remove";
    paths?: string[];
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

export type ConfigPostMessage = (message: ConfigResponse) => void;
