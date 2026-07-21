/**
 * 扫描任务辅助函数测试（纯函数测试）
 *
 * @description
 * 测试 task-helpers.ts 中的所有纯函数
 * 纯函数测试应该覆盖所有边界情况和正常情况
 *
 * @since RFC 0056
 */

import { describe, it, expect } from "vitest";
import {
    HOURS_IN_MILLISECONDS,
    FAILED_TASK_TTL,
    calculateTaskAge,
    calculateHoursAgo,
    shouldDeleteFailedTaskByTTL,
    shouldRetryFailedTask,
    getFailedTaskAction,
    calculateNextRetryCount,
    getTaskStatusDisplayText,
} from "../task-helpers";
import type { ScanQueueItem } from "@renderer/stores/scanning-types";

describe("task-helpers 纯函数测试", () => {
    describe("calculateTaskAge", () => {
        it("应该正确计算任务年龄", () => {
            const now = 1000000;
            const createdAt = 500000;
            expect(calculateTaskAge(now, createdAt)).toBe(500000);
        });

        it("应该处理负数年龄（未来时间）", () => {
            const now = 500000;
            const createdAt = 1000000;
            expect(calculateTaskAge(now, createdAt)).toBe(-500000);
        });
    });

    describe("calculateHoursAgo", () => {
        it("应该正确计算小时数（四舍五入）", () => {
            const taskAge = 2 * HOURS_IN_MILLISECONDS; // 2小时
            expect(calculateHoursAgo(taskAge)).toBe(2);
        });

        it("应该正确四舍五入", () => {
            const taskAge = 1.5 * HOURS_IN_MILLISECONDS; // 1.5小时
            expect(calculateHoursAgo(taskAge)).toBe(2);
        });

        it("应该处理0小时", () => {
            const taskAge = 0;
            expect(calculateHoursAgo(taskAge)).toBe(0);
        });
    });

    describe("shouldDeleteFailedTaskByTTL", () => {
        it("应该返回true当任务年龄超过TTL", () => {
            const taskAge = FAILED_TASK_TTL + 1;
            expect(shouldDeleteFailedTaskByTTL(taskAge)).toBe(true);
        });

        it("应该返回false当任务年龄未超过TTL", () => {
            const taskAge = FAILED_TASK_TTL - 1;
            expect(shouldDeleteFailedTaskByTTL(taskAge)).toBe(false);
        });

        it("应该返回false当任务年龄等于TTL", () => {
            const taskAge = FAILED_TASK_TTL;
            expect(shouldDeleteFailedTaskByTTL(taskAge)).toBe(false);
        });

        it("应该支持自定义TTL", () => {
            const customTTL = 1000;
            expect(shouldDeleteFailedTaskByTTL(1001, customTTL)).toBe(true);
            expect(shouldDeleteFailedTaskByTTL(999, customTTL)).toBe(false);
        });
    });

    describe("shouldRetryFailedTask", () => {
        it("应该返回true当重试次数小于最大重试次数", () => {
            expect(shouldRetryFailedTask(0, 3)).toBe(true);
            expect(shouldRetryFailedTask(1, 3)).toBe(true);
            expect(shouldRetryFailedTask(2, 3)).toBe(true);
        });

        it("应该返回false当重试次数等于最大重试次数", () => {
            expect(shouldRetryFailedTask(3, 3)).toBe(false);
        });

        it("应该返回false当重试次数大于最大重试次数", () => {
            expect(shouldRetryFailedTask(4, 3)).toBe(false);
        });
    });

    describe("getFailedTaskAction", () => {
        it("应该返回 'delete-ttl' 当任务超过TTL", () => {
            const taskAge = FAILED_TASK_TTL + 1;
            expect(getFailedTaskAction(taskAge, 0, 3)).toBe("delete-ttl");
        });

        it("应该返回 'retry' 当任务未超过TTL且未达到重试上限", () => {
            const taskAge = FAILED_TASK_TTL - 1;
            expect(getFailedTaskAction(taskAge, 0, 3)).toBe("retry");
            expect(getFailedTaskAction(taskAge, 1, 3)).toBe("retry");
            expect(getFailedTaskAction(taskAge, 2, 3)).toBe("retry");
        });

        it("应该返回 'delete-max-retries' 当任务达到重试上限", () => {
            const taskAge = FAILED_TASK_TTL - 1;
            expect(getFailedTaskAction(taskAge, 3, 3)).toBe("delete-max-retries");
        });

        it("应该优先考虑TTL而不是重试次数", () => {
            const taskAge = FAILED_TASK_TTL + 1;
            // 即使重试次数未达到上限，也应该删除（因为超过TTL）
            expect(getFailedTaskAction(taskAge, 0, 3)).toBe("delete-ttl");
        });

        it("应该支持自定义TTL", () => {
            const customTTL = 1000;
            expect(getFailedTaskAction(1001, 0, 3, customTTL)).toBe("delete-ttl");
            expect(getFailedTaskAction(999, 0, 3, customTTL)).toBe("retry");
        });
    });

    describe("calculateNextRetryCount", () => {
        it("应该正确计算下一次重试次数", () => {
            expect(calculateNextRetryCount(0)).toBe(1);
            expect(calculateNextRetryCount(1)).toBe(2);
            expect(calculateNextRetryCount(2)).toBe(3);
        });
    });

    describe("getTaskStatusDisplayText", () => {
        it("应该返回任务状态", () => {
            const task: ScanQueueItem = {
                path: "/test",
                action: "scan",
                operationType: "directory",
                status: "pending",
                createdAt: Date.now(),
                retryCount: 0,
                maxRetries: 3,
                source: "user",
                thumbnailSize: 150,
            };
            expect(getTaskStatusDisplayText(task)).toBe("pending");
        });

        it("应该返回 'legacy-pending' 当状态为undefined", () => {
            const task: Partial<ScanQueueItem> & {
                path: string;
                action: "scan";
                operationType: "directory";
                createdAt: number;
                retryCount: number;
                maxRetries: number;
                source: "user";
                thumbnailSize: number;
            } = {
                path: "/test",
                action: "scan",
                operationType: "directory",
                status: undefined,
                createdAt: Date.now(),
                retryCount: 0,
                maxRetries: 3,
                source: "user",
                thumbnailSize: 150,
            };
            expect(getTaskStatusDisplayText(task as ScanQueueItem)).toBe("legacy-pending");
        });

        it("应该处理所有状态类型", () => {
            const statuses: Array<"pending" | "processing" | "failed"> = [
                "pending",
                "processing",
                "failed",
            ];
            statuses.forEach((status) => {
                const task: ScanQueueItem = {
                    path: "/test",
                    action: "scan",
                    operationType: "directory",
                    status,
                    createdAt: Date.now(),
                    retryCount: 0,
                    maxRetries: 3,
                    source: "user",
                    thumbnailSize: 150,
                };
                expect(getTaskStatusDisplayText(task)).toBe(status);
            });
        });
    });
});
