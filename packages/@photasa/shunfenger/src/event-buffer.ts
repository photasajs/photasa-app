import { loggers } from "@photasa/common";
import { getDeduplicationWindow } from "@photasa/common";
import type { FileObservation, ObservationListener, WatchEventKind } from "./types";

const logger = loggers.shunfenger;

export interface EventBufferOptions {
    debounceMs: number;
    maxBatchSize: number;
}

export class EventBuffer {
    private readonly options: EventBufferOptions;
    private readonly pending = new Map<string, FileObservation>();
    private timer: NodeJS.Timeout | null = null;
    private listener: ObservationListener | null = null;

    constructor(options: EventBufferOptions) {
        this.options = options;
    }

    setListener(listener: ObservationListener): void {
        this.listener = listener;
    }

    enqueue(observation: FileObservation): void {
        const key = this.getKey(observation.kind, observation.path);
        const existing = this.pending.get(key);
        if (existing) {
            const dedupWindow = getDeduplicationWindow(observation.kind);
            const now = Date.now();
            if (now - existing.detectedAt < dedupWindow) {
                this.pending.set(key, {
                    ...existing,
                    ...observation,
                    detectedAt: now,
                });
            } else {
                this.pending.set(key, observation);
            }
        } else {
            this.pending.set(key, observation);
        }
        logger.debug("[EventBuffer] queued", observation.kind, observation.path);
        this.scheduleFlush();
    }

    forceFlush(): void {
        this.flush();
    }

    clear(): void {
        this.pending.clear();
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private flush(): void {
        if (!this.listener) {
            this.pending.clear();
            return;
        }
        const items = Array.from(this.pending.values());
        this.pending.clear();
        items.forEach((item) => this.listener?.(item));
    }

    private scheduleFlush(): void {
        if (this.timer) {
            return;
        }
        this.timer = setTimeout(() => {
            this.timer = null;
            this.flush();
        }, this.options.debounceMs);
    }

    private getKey(kind: WatchEventKind, p: string): string {
        return `${kind}:${p}`;
    }
}
