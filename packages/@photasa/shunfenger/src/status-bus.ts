import { EventEmitter } from "events";
import type { EngineEventListener, ShunfengerEngineEvent } from "./types";

const EVENT_NAME = "shunfenger:event";

export class StatusBus {
    private readonly emitter = new EventEmitter();

    emit(event: ShunfengerEngineEvent): void {
        this.emitter.emit(EVENT_NAME, event);
    }

    on(listener: EngineEventListener): () => void {
        this.emitter.on(EVENT_NAME, listener);
        return () => {
            this.emitter.off(EVENT_NAME, listener);
        };
    }

    once(listener: EngineEventListener): void {
        this.emitter.once(EVENT_NAME, listener);
    }

    remove(listener: EngineEventListener): void {
        this.emitter.off(EVENT_NAME, listener);
    }

    removeAll(): void {
        this.emitter.removeAllListeners(EVENT_NAME);
    }
}
