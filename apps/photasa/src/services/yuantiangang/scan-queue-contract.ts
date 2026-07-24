/**
 * 扫描队列 IPC 契约常量（RFC 0162）
 *
 * @see .spec/rfc/completed/0162-scan-queue-nonblocking-ipc.md
 */
export const SCAN_QUEUE_PERSIST_DEBOUNCE_MS = 300;

/** Renderer：scan_directory_discovered 批量入队窗口 */
export const SCAN_QUEUE_DISCOVERED_BATCH_MS = 250;

/** 突变 command 返回值；禁止期望全量 queue */
export interface ScanQueueAck {
    queueLen: number;
    revision: number;
}
