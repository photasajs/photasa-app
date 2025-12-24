import { PhotasaLogger } from "@common/logger";

/**
 * 照片动作
 */
export interface PhotoAction {
    action: string;
    params: Record<string, object>;
    previous: string;
}

/**
 * 照片
 */
export interface Photo {
    path: string; // relative path
    thumbnail: string;
    isVideo: boolean;
    history?: PhotoAction[];
}

/**
 * Photasa 配置
 */
export interface PhotasaConfig {
    version: string;
    photoList: Photo[];
    lastModified: number;
}

/**
 * Photasa 配置结果
 */
export interface PhotasaConfigResult {
    path: string | undefined;
    config: PhotasaConfig;
}

export type ConfigAction = "query" | "add" | "remove";

export interface ConfigRequest {
    action: ConfigAction;
    queueId?: number;
    paths?: string[];
    from?: "query" | "add" | "remove";
}

export interface ConfigResponse extends PhotasaConfigResult {
    action: "next" | "complete" | "error" | "heartbeat" | "engine-status";
    queueId?: number;
    from?: "query" | "add" | "remove";
    paths?: string[];
    error?: string;
    err?: Error;
    timestamp?: number;
    status?: string;
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
