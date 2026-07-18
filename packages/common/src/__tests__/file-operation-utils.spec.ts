import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FileOperation } from "../scan-types";
import {
    getEventPriority,
    getDeduplicationWindow,
    generateOperationId,
    calculateDebounceTime,
    createFileOperation,
    shouldDeduplicateEvent,
    mapFileOperationToScanAction,
    isHighPriorityOperation,
    sortOperationsByPriority,
    filterOperationsByType,
    groupOperationsByPath,
} from "../file-operation-utils";
import {
    FileOperationPriorities,
    FileOperationDeduplicationWindows,
    DebounceTimeConfig,
} from "../constants";

describe("file-operation-utils pure functions", () => {
    describe("getEventPriority", () => {
        it("should return correct priority for delete operations", () => {
            expect(getEventPriority("delete")).toBe(FileOperationPriorities.Delete);
            expect(getEventPriority("deleteDir")).toBe(FileOperationPriorities.DeleteDir);
        });

        it("should return correct priority for change operations", () => {
            expect(getEventPriority("change")).toBe(FileOperationPriorities.Change);
        });

        it("should return correct priority for add operations", () => {
            expect(getEventPriority("add")).toBe(FileOperationPriorities.Add);
            expect(getEventPriority("addDir")).toBe(FileOperationPriorities.AddDir);
        });

        it("should return default priority for unknown types", () => {
            expect(getEventPriority("unknown")).toBe(FileOperationPriorities.Default);
            expect(getEventPriority("")).toBe(FileOperationPriorities.Default);
        });

        it("should be deterministic - same input produces same output", () => {
            const input = "add";
            const result1 = getEventPriority(input);
            const result2 = getEventPriority(input);
            expect(result1).toBe(result2);
        });
    });

    describe("getDeduplicationWindow", () => {
        it("should return correct window for add operations", () => {
            expect(getDeduplicationWindow("add")).toBe(FileOperationDeduplicationWindows.Add);
            expect(getDeduplicationWindow("addDir")).toBe(FileOperationDeduplicationWindows.AddDir);
        });

        it("should return correct window for change operations", () => {
            expect(getDeduplicationWindow("change")).toBe(FileOperationDeduplicationWindows.Change);
        });

        it("should return correct window for delete operations", () => {
            expect(getDeduplicationWindow("delete")).toBe(FileOperationDeduplicationWindows.Delete);
            expect(getDeduplicationWindow("deleteDir")).toBe(
                FileOperationDeduplicationWindows.DeleteDir,
            );
        });

        it("should return default window for unknown types", () => {
            expect(getDeduplicationWindow("unknown")).toBe(
                FileOperationDeduplicationWindows.Default,
            );
            expect(getDeduplicationWindow("")).toBe(FileOperationDeduplicationWindows.Default);
        });

        it("should be deterministic - same input produces same output", () => {
            const input = "change";
            const result1 = getDeduplicationWindow(input);
            const result2 = getDeduplicationWindow(input);
            expect(result1).toBe(result2);
        });
    });

    describe("generateOperationId", () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should generate unique IDs", () => {
            const id1 = generateOperationId();
            const id2 = generateOperationId();
            expect(id1).not.toBe(id2);
        });

        it("should generate IDs with correct format", () => {
            const id = generateOperationId();
            expect(id).toMatch(/^\d+-[a-z0-9]{9}$/);
        });

        it("should include timestamp in ID", () => {
            const beforeTime = Date.now();
            const id = generateOperationId();
            const afterTime = Date.now();

            const timestamp = parseInt(id.split("-")[0]);
            expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(timestamp).toBeLessThanOrEqual(afterTime);
        });

        it("should generate different IDs when called multiple times", () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(generateOperationId());
            }
            expect(ids.size).toBe(100);
        });
    });

    describe("calculateDebounceTime", () => {
        it("should return high load time for counts above high threshold", () => {
            const highCount = DebounceTimeConfig.HighLoadThreshold + 10;
            expect(calculateDebounceTime(highCount)).toBe(DebounceTimeConfig.HighLoad);
        });

        it("should return medium load time for counts above medium threshold", () => {
            const mediumCount = DebounceTimeConfig.MediumLoadThreshold + 5;
            expect(calculateDebounceTime(mediumCount)).toBe(DebounceTimeConfig.MediumLoad);
        });

        it("should return low load time for counts below medium threshold", () => {
            const lowCount = DebounceTimeConfig.MediumLoadThreshold - 5;
            expect(calculateDebounceTime(lowCount)).toBe(DebounceTimeConfig.LowLoad);
        });

        it("should handle edge case at exact thresholds", () => {
            expect(calculateDebounceTime(DebounceTimeConfig.HighLoadThreshold)).toBe(
                DebounceTimeConfig.MediumLoad,
            );
            expect(calculateDebounceTime(DebounceTimeConfig.MediumLoadThreshold)).toBe(
                DebounceTimeConfig.LowLoad,
            );
        });

        it("should handle zero and negative counts", () => {
            expect(calculateDebounceTime(0)).toBe(DebounceTimeConfig.LowLoad);
            expect(calculateDebounceTime(-1)).toBe(DebounceTimeConfig.LowLoad);
        });

        it("should be deterministic - same input produces same output", () => {
            const input = 100;
            const result1 = calculateDebounceTime(input);
            const result2 = calculateDebounceTime(input);
            expect(result1).toBe(result2);
        });
    });

    describe("createFileOperation", () => {
        it("should create file operation with all required properties", () => {
            const operation = createFileOperation("add", "/test/file.jpg", true, 150);

            expect(operation).toHaveProperty("id");
            expect(operation).toHaveProperty("type", "add");
            expect(operation).toHaveProperty("path", "/test/file.jpg");
            expect(operation).toHaveProperty("timestamp");
            expect(operation).toHaveProperty("priority");
            expect(operation).toHaveProperty("retryCount", 0);
            expect(operation).toHaveProperty("metadata");
        });

        it("should create operation with correct metadata", () => {
            const operation = createFileOperation("add", "/test/file.jpg", true, 150);

            expect(operation.metadata).toEqual({
                thumbnailSize: 150,
                isFile: true,
                lastModified: expect.any(Number),
            });
        });

        it("should set correct priority based on operation type", () => {
            const addOperation = createFileOperation("add", "/test/file.jpg", true, 150);
            const deleteOperation = createFileOperation("delete", "/test/file.jpg", true, 150);

            expect(addOperation.priority).toBe(getEventPriority("add"));
            expect(deleteOperation.priority).toBe(getEventPriority("delete"));
        });

        it("should generate unique IDs for multiple operations", () => {
            const op1 = createFileOperation("add", "/test/file1.jpg", true, 150);
            const op2 = createFileOperation("add", "/test/file2.jpg", true, 150);

            expect(op1.id).not.toBe(op2.id);
        });

        it("should handle directory operations", () => {
            const operation = createFileOperation("addDir", "/test/directory", false, 150);

            expect(operation.type).toBe("addDir");
            expect(operation.metadata?.isFile).toBe(false);
        });

        it("should set timestamp to current time", () => {
            const beforeTime = Date.now();
            const operation = createFileOperation("add", "/test/file.jpg", true, 150);
            const afterTime = Date.now();

            expect(operation.timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(operation.timestamp).toBeLessThanOrEqual(afterTime);
            expect(operation.metadata?.lastModified).toBeGreaterThanOrEqual(beforeTime);
            expect(operation.metadata?.lastModified).toBeLessThanOrEqual(afterTime);
        });
    });

    describe("shouldDeduplicateEvent", () => {
        it("should return false when no existing event", () => {
            expect(shouldDeduplicateEvent(undefined, Date.now(), 100)).toBe(false);
        });

        it("should return true when within deduplication window", () => {
            const now = Date.now();
            const existing: FileOperation = {
                id: "test-id",
                type: "add",
                path: "/test/file.jpg",
                timestamp: now - 50, // 50ms ago
                priority: 1,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: now - 50 },
            };

            expect(shouldDeduplicateEvent(existing, now, 100)).toBe(true);
        });

        it("should return false when outside deduplication window", () => {
            const now = Date.now();
            const existing: FileOperation = {
                id: "test-id",
                type: "add",
                path: "/test/file.jpg",
                timestamp: now - 150, // 150ms ago
                priority: 1,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: now - 150 },
            };

            expect(shouldDeduplicateEvent(existing, now, 100)).toBe(false);
        });

        it("should handle edge case at exact window boundary", () => {
            const now = Date.now();
            const existing: FileOperation = {
                id: "test-id",
                type: "add",
                path: "/test/file.jpg",
                timestamp: now - 100, // exactly 100ms ago
                priority: 1,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: now - 100 },
            };

            expect(shouldDeduplicateEvent(existing, now, 100)).toBe(false);
        });

        it("should be deterministic - same input produces same output", () => {
            const now = Date.now();
            const existing: FileOperation = {
                id: "test-id",
                type: "add",
                path: "/test/file.jpg",
                timestamp: now - 50,
                priority: 1,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: now - 50 },
            };

            const result1 = shouldDeduplicateEvent(existing, now, 100);
            const result2 = shouldDeduplicateEvent(existing, now, 100);
            expect(result1).toBe(result2);
        });
    });

    describe("mapFileOperationToScanAction", () => {
        it("should map add operations to scan action", () => {
            expect(mapFileOperationToScanAction("add")).toBe("scan");
            expect(mapFileOperationToScanAction("addDir")).toBe("scan");
        });

        it("should map change operations to rescan action", () => {
            expect(mapFileOperationToScanAction("change")).toBe("rescan");
        });

        it("should map delete operations to current action", () => {
            expect(mapFileOperationToScanAction("delete")).toBe("current");
            expect(mapFileOperationToScanAction("deleteDir")).toBe("current");
        });

        it("should map unknown operations to scan action", () => {
            expect(mapFileOperationToScanAction("unknown" as never)).toBe("scan");
        });

        it("should be deterministic - same input produces same output", () => {
            const input = "add" as const;
            const result1 = mapFileOperationToScanAction(input);
            const result2 = mapFileOperationToScanAction(input);
            expect(result1).toBe(result2);
        });
    });

    describe("isHighPriorityOperation", () => {
        it("should return true for delete operations", () => {
            const deleteOperation: FileOperation = {
                id: "test-id",
                type: "delete",
                path: "/test/file.jpg",
                timestamp: Date.now(),
                priority: 1,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: Date.now() },
            };

            expect(isHighPriorityOperation(deleteOperation)).toBe(true);
        });

        it("should return true for deleteDir operations", () => {
            const deleteDirOperation: FileOperation = {
                id: "test-id",
                type: "deleteDir",
                path: "/test/directory",
                timestamp: Date.now(),
                priority: 1,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: false, lastModified: Date.now() },
            };

            expect(isHighPriorityOperation(deleteDirOperation)).toBe(true);
        });

        it("should return false for non-delete operations", () => {
            const addOperation: FileOperation = {
                id: "test-id",
                type: "add",
                path: "/test/file.jpg",
                timestamp: Date.now(),
                priority: 3,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: Date.now() },
            };

            expect(isHighPriorityOperation(addOperation)).toBe(false);
        });

        it("should be deterministic - same input produces same output", () => {
            const operation: FileOperation = {
                id: "test-id",
                type: "delete",
                path: "/test/file.jpg",
                timestamp: Date.now(),
                priority: 1,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: Date.now() },
            };

            const result1 = isHighPriorityOperation(operation);
            const result2 = isHighPriorityOperation(operation);
            expect(result1).toBe(result2);
        });
    });

    describe("sortOperationsByPriority", () => {
        it("should sort operations by priority (lower number = higher priority)", () => {
            const operations: FileOperation[] = [
                {
                    id: "op-1",
                    type: "add",
                    path: "/test/file1.jpg",
                    timestamp: 1000,
                    priority: 3,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true, lastModified: 1000 },
                },
                {
                    id: "op-2",
                    type: "delete",
                    path: "/test/file2.jpg",
                    timestamp: 1001,
                    priority: 1,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true, lastModified: 1001 },
                },
                {
                    id: "op-3",
                    type: "change",
                    path: "/test/file3.jpg",
                    timestamp: 1002,
                    priority: 2,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true, lastModified: 1002 },
                },
            ];

            const sorted = sortOperationsByPriority(operations);

            expect(sorted[0].priority).toBe(1); // delete operation first
            expect(sorted[1].priority).toBe(2); // change operation second
            expect(sorted[2].priority).toBe(3); // add operation last
        });

        it("should sort by timestamp when priorities are equal", () => {
            const operations: FileOperation[] = [
                {
                    id: "op-1",
                    type: "add",
                    path: "/test/file1.jpg",
                    timestamp: 1002,
                    priority: 3,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true, lastModified: 1002 },
                },
                {
                    id: "op-2",
                    type: "addDir",
                    path: "/test/dir1",
                    timestamp: 1000,
                    priority: 3,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: false, lastModified: 1000 },
                },
                {
                    id: "op-3",
                    type: "add",
                    path: "/test/file2.jpg",
                    timestamp: 1001,
                    priority: 3,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true, lastModified: 1001 },
                },
            ];

            const sorted = sortOperationsByPriority(operations);

            expect(sorted[0].timestamp).toBe(1000); // oldest first
            expect(sorted[1].timestamp).toBe(1001);
            expect(sorted[2].timestamp).toBe(1002);
        });

        it("should not mutate original array", () => {
            const operations: FileOperation[] = [
                {
                    id: "op-1",
                    type: "add",
                    path: "/test/file1.jpg",
                    timestamp: 1000,
                    priority: 3,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true, lastModified: 1000 },
                },
                {
                    id: "op-2",
                    type: "delete",
                    path: "/test/file2.jpg",
                    timestamp: 1001,
                    priority: 1,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true, lastModified: 1001 },
                },
            ];

            const originalOrder = operations.map((op) => op.id);
            const sorted = sortOperationsByPriority(operations);
            const afterOrder = operations.map((op) => op.id);

            expect(originalOrder).toEqual(afterOrder); // Original array unchanged
            expect(sorted).not.toBe(operations); // Different array instance
        });

        it("should handle empty array", () => {
            const sorted = sortOperationsByPriority([]);
            expect(sorted).toEqual([]);
        });

        it("should be deterministic - same input produces same output", () => {
            const operations: FileOperation[] = [
                {
                    id: "op-1",
                    type: "add",
                    path: "/test/file1.jpg",
                    timestamp: 1000,
                    priority: 3,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true, lastModified: 1000 },
                },
                {
                    id: "op-2",
                    type: "delete",
                    path: "/test/file2.jpg",
                    timestamp: 1001,
                    priority: 1,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true, lastModified: 1001 },
                },
            ];

            const result1 = sortOperationsByPriority(operations);
            const result2 = sortOperationsByPriority(operations);

            expect(result1.map((op) => op.id)).toEqual(result2.map((op) => op.id));
        });
    });

    describe("filterOperationsByType", () => {
        const operations: FileOperation[] = [
            {
                id: "op-1",
                type: "add",
                path: "/test/file1.jpg",
                timestamp: 1000,
                priority: 3,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: 1000 },
            },
            {
                id: "op-2",
                type: "delete",
                path: "/test/file2.jpg",
                timestamp: 1001,
                priority: 1,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: 1001 },
            },
            {
                id: "op-3",
                type: "change",
                path: "/test/file3.jpg",
                timestamp: 1002,
                priority: 2,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: 1002 },
            },
            {
                id: "op-4",
                type: "addDir",
                path: "/test/dir1",
                timestamp: 1003,
                priority: 4,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: false, lastModified: 1003 },
            },
        ];

        it("should filter operations by single type", () => {
            const filtered = filterOperationsByType(operations, ["add"]);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].type).toBe("add");
            expect(filtered[0].id).toBe("op-1");
        });

        it("should filter operations by multiple types", () => {
            const filtered = filterOperationsByType(operations, ["add", "delete"]);

            expect(filtered).toHaveLength(2);
            expect(filtered.map((op) => op.type)).toEqual(["add", "delete"]);
            expect(filtered.map((op) => op.id)).toEqual(["op-1", "op-2"]);
        });

        it("should return empty array when no matches", () => {
            const filtered = filterOperationsByType(operations, ["unknown" as never]);
            expect(filtered).toEqual([]);
        });

        it("should return all operations when all types match", () => {
            const allTypes: FileOperation["type"][] = ["add", "delete", "change", "addDir"];
            const filtered = filterOperationsByType(operations, allTypes);

            expect(filtered).toHaveLength(4);
        });

        it("should not mutate original array", () => {
            const originalLength = operations.length;
            const filtered = filterOperationsByType(operations, ["add"]);

            expect(operations).toHaveLength(originalLength); // Original unchanged
            expect(filtered).not.toBe(operations); // Different array instance
        });

        it("should handle empty operations array", () => {
            const filtered = filterOperationsByType([], ["add"]);
            expect(filtered).toEqual([]);
        });

        it("should handle empty types array", () => {
            const filtered = filterOperationsByType(operations, []);
            expect(filtered).toEqual([]);
        });

        it("should be deterministic - same input produces same output", () => {
            const types: FileOperation["type"][] = ["add", "delete"];
            const result1 = filterOperationsByType(operations, types);
            const result2 = filterOperationsByType(operations, types);

            expect(result1.map((op) => op.id)).toEqual(result2.map((op) => op.id));
        });
    });

    describe("groupOperationsByPath", () => {
        const operations: FileOperation[] = [
            {
                id: "op-1",
                type: "add",
                path: "/test/file1.jpg",
                timestamp: 1000,
                priority: 3,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: 1000 },
            },
            {
                id: "op-2",
                type: "change",
                path: "/test/file1.jpg", // Same path as op-1
                timestamp: 1001,
                priority: 2,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: 1001 },
            },
            {
                id: "op-3",
                type: "delete",
                path: "/test/file2.jpg",
                timestamp: 1002,
                priority: 1,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: 1002 },
            },
            {
                id: "op-4",
                type: "add",
                path: "/test/file1.jpg", // Same path as op-1 and op-2
                timestamp: 1003,
                priority: 3,
                retryCount: 0,
                metadata: { thumbnailSize: 150, isFile: true, lastModified: 1003 },
            },
        ];

        it("should group operations by file path", () => {
            const grouped = groupOperationsByPath(operations);

            expect(grouped.size).toBe(2);
            expect(grouped.has("/test/file1.jpg")).toBe(true);
            expect(grouped.has("/test/file2.jpg")).toBe(true);
        });

        it("should group multiple operations for same path", () => {
            const grouped = groupOperationsByPath(operations);

            const file1Operations = grouped.get("/test/file1.jpg");
            expect(file1Operations).toHaveLength(3);
            expect(file1Operations?.map((op) => op.id)).toEqual(["op-1", "op-2", "op-4"]);
        });

        it("should group single operations for unique paths", () => {
            const grouped = groupOperationsByPath(operations);

            const file2Operations = grouped.get("/test/file2.jpg");
            expect(file2Operations).toHaveLength(1);
            expect(file2Operations?.[0].id).toBe("op-3");
        });

        it("should preserve operation order within groups", () => {
            const grouped = groupOperationsByPath(operations);

            const file1Operations = grouped.get("/test/file1.jpg");
            expect(file1Operations?.map((op) => op.timestamp)).toEqual([1000, 1001, 1003]);
        });

        it("should handle empty operations array", () => {
            const grouped = groupOperationsByPath([]);
            expect(grouped.size).toBe(0);
        });

        it("should handle operations with duplicate paths but different properties", () => {
            const duplicatePathOps: FileOperation[] = [
                {
                    id: "op-1",
                    type: "add",
                    path: "/same/path.jpg",
                    timestamp: 1000,
                    priority: 3,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true, lastModified: 1000 },
                },
                {
                    id: "op-2",
                    type: "delete",
                    path: "/same/path.jpg",
                    timestamp: 2000,
                    priority: 1,
                    retryCount: 1,
                    metadata: { thumbnailSize: 200, isFile: true, lastModified: 2000 },
                },
            ];

            const grouped = groupOperationsByPath(duplicatePathOps);
            const pathOperations = grouped.get("/same/path.jpg");

            expect(pathOperations).toHaveLength(2);
            expect(pathOperations?.[0].type).toBe("add");
            expect(pathOperations?.[1].type).toBe("delete");
        });

        it("should be deterministic - same input produces same output", () => {
            const result1 = groupOperationsByPath(operations);
            const result2 = groupOperationsByPath(operations);

            expect(result1.size).toBe(result2.size);
            for (const [path, ops1] of result1) {
                const ops2 = result2.get(path);
                expect(ops1?.map((op) => op.id)).toEqual(ops2?.map((op) => op.id));
            }
        });

        it("should create new Map instance and not mutate input", () => {
            const grouped = groupOperationsByPath(operations);
            expect(grouped).toBeInstanceOf(Map);
            expect(operations).toHaveLength(4); // Original array unchanged
        });
    });
});
