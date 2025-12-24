import { defineStore } from "pinia";
import type { NotifyPayload } from "@common/types";

export interface StatusBarState {
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
            this.currentTask = payload.task;
            this.status = payload.status;
            this.error = payload.error;
            this.timestamp = payload.timestamp;
            this.data = payload.data;
            // 进度可选从 data 结构中提取
            if (
                payload.data &&
                typeof payload.data === "object" &&
                payload.data !== null &&
                "progress" in payload.data &&
                typeof (payload.data as { progress?: number }).progress === "number"
            ) {
                this.progress = (payload.data as { progress: number }).progress;
            } else {
                this.progress = undefined;
            }
            this.history.unshift(payload);
            if (this.history.length > 50) this.history.length = 50;
        },
        clear() {
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
