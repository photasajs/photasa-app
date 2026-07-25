/** 遥测事件名（RFC 0163）：仅行为元数据，不含路径/照片内容 */

export const TELEMETRY_EVENTS = {
    SETTINGS_OPENED: "settings_opened",
    IMPORT_COMPLETED: "import_completed",
    IMPORT_FAILED: "import_failed",
} as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[keyof typeof TELEMETRY_EVENTS];
