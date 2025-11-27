/**
 * RFC 0018: 扫描文件夹优先级排序测试
 */

import { describe, test, expect } from "vitest";
import type { FileOperationInput } from "@common/scan-types";
import {
    PRIORITY_RULES,
    calculatePriority,
    createScanAction,
    sortScanningFolders,
    updateScanActionPriority,
    shouldUpdateScanAction,
    getPriorityDescription,
} from "../scan-priority";

describe("scan-priority utilities", () => {
    describe("calculatePriority", () => {
        test("should calculate correct priority for different actions", () => {
            expect(calculatePriority("current", "user")).toBe(1); // 1 + 0
            expect(calculatePriority("rescan", "user")).toBe(2); // 2 + 0
            expect(calculatePriority("scan", "user")).toBe(3); // 3 + 0
        });

        test("should add source bonus correctly", () => {
            expect(calculatePriority("scan", "user")).toBe(3); // 3 + 0
            expect(calculatePriority("scan", "auto")).toBe(13); // 3 + 10
        });

        test("should prioritize user over auto for same action", () => {
            const userPriority = calculatePriority("scan", "user");
            const autoPriority = calculatePriority("scan", "auto");
            expect(userPriority).toBeLessThan(autoPriority);
        });
    });

    describe("createScanAction", () => {
        test("should create scan action with correct priority and timestamp", () => {
            const baseScanAction = {
                path: "/test/path",
                action: "scan" as const,
                thumbnailSize: 200,
                operationType: "directory" as const,
            };

            const result = createScanAction(baseScanAction, "user");

            expect(result.path).toBe("/test/path");
            expect(result.action).toBe("scan");
            expect(result.source).toBe("user");
            expect(result.priority).toBe(3); // scan + user = 3 + 0
            expect(result.timestamp).toBeTypeOf("number");
            expect(result.timestamp).toBeGreaterThan(Date.now() - 1000);
        });

        test("should default source to user", () => {
            const baseScanAction = {
                path: "/test/path",
                action: "scan" as const,
                thumbnailSize: 200,
                operationType: "directory" as const,
            };

            const result = createScanAction(baseScanAction);
            expect(result.source).toBe("user");
        });
    });

    describe("sortScanningFolders", () => {
        test("should prioritize current over rescan over scan", () => {
            const folders: FileOperationInput[] = [
                createScanAction({ path: "/path1", action: "scan", thumbnailSize: 200, operationType: "directory" }, "user"),
                createScanAction({ path: "/path2", action: "rescan", thumbnailSize: 200, operationType: "directory" }, "user"),
                createScanAction({ path: "/path3", action: "current", thumbnailSize: 200, operationType: "directory" }, "user"),
            ];

            const sorted = sortScanningFolders(folders);

            expect(sorted[0].action).toBe("current");
            expect(sorted[1].action).toBe("rescan");
            expect(sorted[2].action).toBe("scan");
        });

        test("should prioritize user over auto source", () => {
            const folders: FileOperationInput[] = [
                createScanAction({ path: "/path1", action: "scan", thumbnailSize: 200, operationType: "directory" }, "auto"),
                createScanAction({ path: "/path2", action: "scan", thumbnailSize: 200, operationType: "directory" }, "user"),
            ];

            const sorted = sortScanningFolders(folders);

            expect(sorted[0].source).toBe("user");
            expect(sorted[1].source).toBe("auto");
        });

        test("should sort by path when priority is same", () => {
            const folders: FileOperationInput[] = [
                createScanAction({ path: "/z-path", action: "scan", thumbnailSize: 200, operationType: "directory" }, "user"),
                createScanAction({ path: "/a-path", action: "scan", thumbnailSize: 200, operationType: "directory" }, "user"),
            ];

            const sorted = sortScanningFolders(folders);

            expect(sorted[0].path).toBe("/a-path");
            expect(sorted[1].path).toBe("/z-path");
        });

        test("should sort by timestamp when path and priority are same", () => {
            const baseAction = { path: "/same-path", action: "scan" as const, thumbnailSize: 200, operationType: "directory" as const };

            const older = createScanAction(baseAction, "user");
            // Simulate newer timestamp
            const newer = { ...createScanAction(baseAction, "user"), timestamp: Date.now() + 1000 };

            const folders = [older, newer];
            const sorted = sortScanningFolders(folders);

            // Newer should come first for same path/priority
            expect(sorted[0].timestamp).toBeTypeOf("number");
            expect(sorted[1].timestamp).toBeTypeOf("number");
            expect(sorted[0].timestamp as number).toBeGreaterThan(sorted[1].timestamp as number);
        });

        test("should not mutate original array", () => {
            const folders: FileOperationInput[] = [
                createScanAction({ path: "/path2", action: "scan", thumbnailSize: 200, operationType: "directory" }, "user"),
                createScanAction({ path: "/path1", action: "current", thumbnailSize: 200, operationType: "directory" }, "user"),
            ];
            const originalOrder = folders.map((f) => f.path);

            sortScanningFolders(folders);

            // Original array should remain unchanged
            expect(folders.map((f) => f.path)).toEqual(originalOrder);
        });
    });

    describe("updateScanActionPriority", () => {
        test("should update action and recalculate priority", () => {
            const original = createScanAction(
                { path: "/test", action: "scan", thumbnailSize: 200, operationType: "directory" },
                "user",
            );

            const updated = updateScanActionPriority(original, "current", "user");

            expect(updated.action).toBe("current");
            expect(updated.priority).toBe(1); // current + user
            expect(updated.timestamp).toBe(original.timestamp); // Should preserve timestamp
        });

        test("should update source and recalculate priority", () => {
            const original = createScanAction(
                { path: "/test", action: "scan", thumbnailSize: 200, operationType: "directory" },
                "auto",
            );

            const updated = updateScanActionPriority(original, undefined, "user");

            expect(updated.source).toBe("user");
            expect(updated.priority).toBe(3); // scan + user
        });

        test("should use existing values when not provided", () => {
            const original = createScanAction(
                { path: "/test", action: "rescan", thumbnailSize: 200, operationType: "directory" },
                "user",
            );

            const updated = updateScanActionPriority(original);

            expect(updated.action).toBe("rescan");
            expect(updated.source).toBe("user");
            expect(updated.priority).toBe(2); // rescan + user
        });
    });

    describe("shouldUpdateScanAction", () => {
        test("should return true when new priority is higher (lower number)", () => {
            const existing = createScanAction(
                { path: "/test", action: "scan", thumbnailSize: 200, operationType: "directory" },
                "user",
            );

            const shouldUpdate = shouldUpdateScanAction(existing, "current", "user");

            expect(shouldUpdate).toBe(true); // current(1) < scan(3)
        });

        test("should return false when new priority is lower (higher number)", () => {
            const existing = createScanAction(
                { path: "/test", action: "current", thumbnailSize: 200, operationType: "directory" },
                "user",
            );

            const shouldUpdate = shouldUpdateScanAction(existing, "scan", "user");

            expect(shouldUpdate).toBe(false); // scan(3) > current(1)
        });

        test("should return false when priority is equal", () => {
            const existing = createScanAction(
                { path: "/test", action: "scan", thumbnailSize: 200, operationType: "directory" },
                "user",
            );

            const shouldUpdate = shouldUpdateScanAction(existing, "scan", "user");

            expect(shouldUpdate).toBe(false); // scan(3) === scan(3)
        });

        test("should consider source in priority calculation", () => {
            const existing = createScanAction(
                { path: "/test", action: "scan", thumbnailSize: 200, operationType: "directory" },
                "auto",
            );

            const shouldUpdate = shouldUpdateScanAction(existing, "scan", "user");

            expect(shouldUpdate).toBe(true); // user(3) < auto(13)
        });
    });

    describe("getPriorityDescription", () => {
        test("should return readable description for scan action", () => {
            const scanAction = createScanAction(
                { path: "/test", action: "scan", thumbnailSize: 200, operationType: "directory" },
                "user",
            );

            const description = getPriorityDescription(scanAction);

            expect(description).toBe("scan(user) priority:3");
        });

        test("should return readable description for current action", () => {
            const scanAction = createScanAction(
                { path: "/test", action: "current", thumbnailSize: 200, operationType: "directory" },
                "auto",
            );

            const description = getPriorityDescription(scanAction);

            expect(description).toBe("current(auto) priority:11");
        });

        test("should return readable description for rescan action", () => {
            const scanAction = createScanAction(
                { path: "/test", action: "rescan", thumbnailSize: 200, operationType: "directory" },
                "user",
            );

            const description = getPriorityDescription(scanAction);

            expect(description).toBe("rescan(user) priority:2");
        });
    });

    describe("PRIORITY_RULES", () => {
        test("should have correct action priorities", () => {
            expect(PRIORITY_RULES.action.current).toBe(1);
            expect(PRIORITY_RULES.action.rescan).toBe(2);
            expect(PRIORITY_RULES.action.scan).toBe(3);
        });

        test("should have correct source bonuses", () => {
            expect(PRIORITY_RULES.source.user).toBe(0);
            expect(PRIORITY_RULES.source.auto).toBe(10);
        });

        test("should ensure current has highest priority", () => {
            expect(PRIORITY_RULES.action.current).toBeLessThan(PRIORITY_RULES.action.rescan);
            expect(PRIORITY_RULES.action.rescan).toBeLessThan(PRIORITY_RULES.action.scan);
        });

        test("should ensure user has priority over auto", () => {
            expect(PRIORITY_RULES.source.user).toBeLessThan(PRIORITY_RULES.source.auto);
        });
    });
});

describe("integration scenarios", () => {
    test("complex priority sorting scenario", () => {
        const folders: FileOperationInput[] = [
            createScanAction({ path: "/path-d", action: "scan", thumbnailSize: 200, operationType: "directory" }, "auto"), // priority: 13
            createScanAction({ path: "/path-c", action: "scan", thumbnailSize: 200, operationType: "directory" }, "user"), // priority: 3
            createScanAction({ path: "/path-b", action: "rescan", thumbnailSize: 200, operationType: "directory" }, "auto"), // priority: 12
            createScanAction({ path: "/path-a", action: "current", thumbnailSize: 200, operationType: "directory" }, "user"), // priority: 1
            createScanAction({ path: "/path-e", action: "current", thumbnailSize: 200, operationType: "directory" }, "auto"), // priority: 11
        ];

        const sorted = sortScanningFolders(folders);

        // Expected order:
        // 1. current+user (1)
        // 2. scan+user (3)
        // 3. current+auto (11)
        // 4. rescan+auto (12)
        // 5. scan+auto (13)

        expect(sorted[0].path).toBe("/path-a"); // current+user
        expect(sorted[1].path).toBe("/path-c"); // scan+user
        expect(sorted[2].path).toBe("/path-e"); // current+auto
        expect(sorted[3].path).toBe("/path-b"); // rescan+auto
        expect(sorted[4].path).toBe("/path-d"); // scan+auto
    });

    test("updating existing action with higher priority", () => {
        const existing = createScanAction(
            { path: "/test", action: "scan", thumbnailSize: 200, operationType: "directory" },
            "auto",
        );

        expect(shouldUpdateScanAction(existing, "current", "user")).toBe(true);

        const updated = updateScanActionPriority(existing, "current", "user");
        expect(updated.priority).toBe(1); // Much higher priority
        expect(updated.action).toBe("current");
        expect(updated.source).toBe("user");
    });
});
