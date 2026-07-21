import type { ConfigResponse } from "@photasa/common";

/** `handleWorkerMessage` 纯路由结果，供主进程只负责 IPC */
export type ConfigRoutedAction =
    | { kind: "heartbeat" }
    | { kind: "query-result"; payload: ConfigResponse }
    | { kind: "add-finished"; queueId: number | undefined }
    | { kind: "remove-result"; payload: ConfigResponse }
    | { kind: "engine-status"; payload: ConfigResponse }
    | { kind: "unknown"; payload: ConfigResponse };

/**
 * 将 config worker 的 JSON 解析结果路由为结构化动作，无 contract reference、无副作用。
 * 分支顺序与原先 `config-service.handleWorkerMessage` 一致。
 */
export function routeConfigResponse(data: ConfigResponse): ConfigRoutedAction {
    if (data.action === "heartbeat") {
        return { kind: "heartbeat" };
    }

    if (data.from === "query") {
        return { kind: "query-result", payload: data };
    }

    if (data.from === "add" && (data.action === "complete" || data.action === "error")) {
        return { kind: "add-finished", queueId: data.queueId };
    }

    if (data.from === "remove") {
        return { kind: "remove-result", payload: data };
    }

    if (data.action === "engine-status") {
        return { kind: "engine-status", payload: data };
    }

    return { kind: "unknown", payload: data };
}
