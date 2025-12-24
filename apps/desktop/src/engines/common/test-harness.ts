import EventEmitter from "events";

export interface MockEventBus<T> {
    publish(event: T): void;
    subscribe(listener: (event: T) => void): () => void;
    snapshot(): readonly T[];
    clear(): void;
}

export function createMockEventBus<T extends { timestamp?: number }>(
    defaultTimestamp = Date.now,
): MockEventBus<T> {
    const emitter = new EventEmitter();
    const events: T[] = [];

    return {
        publish(event: T) {
            const enriched: T =
                event.timestamp !== undefined
                    ? event
                    : ({ ...event, timestamp: defaultTimestamp() } as T);
            events.push(enriched);
            emitter.emit("event", enriched);
        },
        subscribe(listener: (event: T) => void) {
            emitter.on("event", listener);
            return () => emitter.off("event", listener);
        },
        snapshot() {
            return events;
        },
        clear() {
            events.length = 0;
        },
    };
}

export interface MockQueueSnapshot<T> {
    readonly size: number;
    readonly pending: readonly T[];
}

export interface MockTaskQueue<T> {
    enqueue(task: T): void;
    dequeue(): T | undefined;
    drain(): T[];
    snapshot(): MockQueueSnapshot<T>;
}

export function createInMemoryTaskQueue<T>(): MockTaskQueue<T> {
    const pending: T[] = [];

    return {
        enqueue(task: T) {
            pending.push(task);
        },
        dequeue() {
            return pending.shift();
        },
        drain() {
            const items = [...pending];
            pending.length = 0;
            return items;
        },
        snapshot() {
            return {
                size: pending.length,
                pending,
            };
        },
    };
}

export interface MockClock {
    now(): number;
    tick(ms: number): number;
}

export function createMockClock(start = 0): MockClock {
    let current = start;
    return {
        now() {
            return current;
        },
        tick(ms: number) {
            current += ms;
            return current;
        },
    };
}
