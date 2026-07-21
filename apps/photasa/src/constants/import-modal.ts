/** RFC 0118 — ImportProgressModal 模式常量 */

export const IMPORT_MODAL_MODE_START = "start" as const;
export const IMPORT_MODAL_MODE_REATTACH = "reattach" as const;

export type ImportModalMode = typeof IMPORT_MODAL_MODE_START | typeof IMPORT_MODAL_MODE_REATTACH;
