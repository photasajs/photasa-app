import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { WorkerSupervisor } from "../worker-supervisor";

describe("WorkerSupervisor", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("markReadyFromMessage 仅在 initializing 时切到 ready 并清零重启次数", () => {
        const onStatusChange = jest.fn();
        const s = new WorkerSupervisor({
            maxRestartAttempts: 3,
            sendHeartbeat: () => {},
            recreateWorker: () => {},
            onStatusChange,
        });
        s.markReadyFromMessage();
        expect(s.getStatus()).toBe("ready");
        expect(s.getRestartAttempts()).toBe(0);
        expect(onStatusChange).toHaveBeenCalledWith("ready");
    });

    it("达到 maxRestartAttempts 后不再调用 recreateWorker", () => {
        const recreateWorker = jest.fn((): void => {});
        const onMax = jest.fn();
        const s = new WorkerSupervisor({
            maxRestartAttempts: 2,
            sendHeartbeat: () => {},
            recreateWorker,
            onMaxRestartAttemptsReached: onMax,
        });
        s.notifyWorkerError();
        jest.advanceTimersByTime(5000);
        expect(recreateWorker).toHaveBeenCalledTimes(1);
        s.markInitializing();
        s.notifyWorkerError();
        jest.advanceTimersByTime(5000);
        expect(recreateWorker).toHaveBeenCalledTimes(2);
        s.markInitializing();
        s.notifyWorkerError();
        expect(onMax).toHaveBeenCalled();
        jest.advanceTimersByTime(5000);
        expect(recreateWorker).toHaveBeenCalledTimes(2);
    });

    it("notifyWorkerExit(0) 不触发重启", () => {
        const recreateWorker = jest.fn((): void => {});
        const s = new WorkerSupervisor({
            maxRestartAttempts: 3,
            sendHeartbeat: () => {},
            recreateWorker,
        });
        s.notifyWorkerExit(0);
        jest.runAllTimers();
        expect(recreateWorker).not.toHaveBeenCalled();
    });

    it("notifyWorkerExit(1) 触发延迟重启", () => {
        const recreateWorker = jest.fn((): void => {});
        const s = new WorkerSupervisor({
            maxRestartAttempts: 3,
            sendHeartbeat: () => {},
            recreateWorker,
        });
        s.notifyWorkerExit(1);
        expect(recreateWorker).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1000);
        expect(recreateWorker).toHaveBeenCalledTimes(1);
    });

    it("dispose 清除心跳与重启定时器", () => {
        const recreateWorker = jest.fn((): void => {});
        const s = new WorkerSupervisor({
            maxRestartAttempts: 3,
            sendHeartbeat: () => {},
            recreateWorker,
        });
        s.notifyWorkerError();
        s.dispose();
        jest.runAllTimers();
        expect(recreateWorker).not.toHaveBeenCalled();
    });

    it("心跳失败时触发重启", () => {
        const recreateWorker = jest.fn((): void => {});
        const sendHeartbeat = jest.fn((): void => {
            throw new Error("post failed");
        });
        const s = new WorkerSupervisor({
            maxRestartAttempts: 3,
            heartbeatIntervalMs: 10_000,
            sendHeartbeat,
            recreateWorker,
        });
        s.markReadyFromMessage();
        s.startHealthCheck();
        jest.advanceTimersByTime(10_000);
        expect(sendHeartbeat).toHaveBeenCalled();
        jest.advanceTimersByTime(1000);
        expect(recreateWorker).toHaveBeenCalled();
        s.dispose();
    });
});
