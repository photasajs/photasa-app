import type { ImportConfig } from "@photasa/common";

/** Worker 入参：dateRange 可能为 ISO 字符串（postMessage 反序列化后） */
export type ImportConfigWorkerInput = Omit<ImportConfig, "filters"> & {
    filters?: Omit<ImportConfig["filters"], "dateRange"> & {
        dateRange?: { start: Date | string; end: Date | string };
    };
};

/** 可 JSON 序列化到 worker 的错误摘要 */
export type SerializableWorkerError = {
    message: string;
    name?: string;
    stack?: string;
    code?: string;
};

/**
 * 与 import-worker 一致：统一日期为 `Date`。
 */
export function normalizeImportConfigDate(dateInput: Date | string): Date {
    return dateInput instanceof Date ? dateInput : new Date(dateInput);
}

/**
 * 与 import-worker 一致：默认过滤器工厂。
 */
export function createDefaultImportFilters(): NonNullable<ImportConfig["filters"]> {
    return {
        fileTypes: [],
        sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
        dateRange: { start: new Date(0), end: new Date() },
        includeSubfolders: true,
    };
}

/**
 * 规范化导入配置中的日期与 filters（供 worker 内逻辑使用）。
 */
export function processImportConfigForWorker(config: ImportConfigWorkerInput): ImportConfig {
    return {
        ...config,
        filters: config.filters
            ? {
                  ...config.filters,
                  dateRange: config.filters.dateRange
                      ? {
                            start: normalizeImportConfigDate(config.filters.dateRange.start),
                            end: normalizeImportConfigDate(config.filters.dateRange.end),
                        }
                      : { start: new Date(0), end: new Date() },
              }
            : createDefaultImportFilters(),
    };
}

/**
 * 构造可经 `JSON.stringify` / IPC 传递的错误描述。
 */
export function createSerializableWorkerError(error: unknown): SerializableWorkerError {
    if (error instanceof Error) {
        return {
            message: error.message,
            name: error.name,
            stack: error.stack,
            code: (error as { code?: string }).code,
        };
    }
    return { message: String(error) };
}
