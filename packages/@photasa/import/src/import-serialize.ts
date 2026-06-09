import type { ImportConfig } from "@photasa/common";

/** 经 postMessage 发往 worker 的配置（日期字段为 ISO 字符串） */
export type ImportConfigWorkerMessage = Omit<ImportConfig, "filters"> & {
    filters: Omit<ImportConfig["filters"], "dateRange"> & {
        dateRange: { start: string; end: string };
    };
};

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
