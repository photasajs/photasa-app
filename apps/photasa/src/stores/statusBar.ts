import { defineStore } from "pinia";
import type { NotifyPayload } from "@photasa/common";

export interface StatusBarState {
    type: string;
    currentTask: string;
    status: string;
    progress?: number;
    error?: string;
    timestamp: number;
    data?: unknown;
    history: NotifyPayload[];
}

export const useStatusBarStore = defineStore("statusBar", {
    state: (): StatusBarState => ({
        type: "",
        currentTask: "",
        status: "",
        progress: undefined,
        error: undefined,
        timestamp: 0,
        data: undefined,
        history: [],
    }),
    actions: {
        update(payload: NotifyPayload) {
            this.type = payload.type;
            this.currentTask = payload.task;
            this.status = payload.status;
            this.error = payload.error;
            this.timestamp = payload.timestamp;
            this.data = payload.data;
            // Rust uses processed; progress stays as legacy fallback.
            if (
                payload.data &&
                typeof payload.data === "object" &&
                payload.data !== null &&
                (typeof (payload.data as { processed?: number }).processed === "number" ||
                    typeof (payload.data as { progress?: number }).progress === "number")
            ) {
                const data = payload.data as { processed?: number; progress?: number };
                this.progress = data.processed ?? data.progress;
            } else {
                this.progress = undefined;
            }
            this.history.unshift(payload);
            if (this.history.length > 50) this.history.length = 50;
        },
        clear() {
            this.type = "";
            this.currentTask = "";
            this.status = "";
            this.progress = undefined;
            this.error = undefined;
            this.timestamp = 0;
            this.data = undefined;
            this.history = [];
        },
    },
});
