import type { ImportConfig, ImportConfigWorkerMessage } from "@photasa/common";

export type { ImportConfigWorkerMessage } from "@photasa/common";

/**
 * 主进程发往 import worker 前将配置中的 Date 转为 ISO 字符串（与原先 import-service 一致）。
 */
export function serializeImportConfigForWorker(config: ImportConfig): ImportConfigWorkerMessage {
    const filters = config.filters ?? {
        fileTypes: [],
        sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
        dateRange: { start: new Date(0), end: new Date() },
        includeSubfolders: true,
    };
    return {
        ...config,
        filters: {
            ...filters,
            dateRange: {
                start:
                    filters.dateRange.start instanceof Date
                        ? filters.dateRange.start.toISOString()
                        : String(filters.dateRange.start),
                end:
                    filters.dateRange.end instanceof Date
                        ? filters.dateRange.end.toISOString()
                        : String(filters.dateRange.end),
            },
        },
    };
}
