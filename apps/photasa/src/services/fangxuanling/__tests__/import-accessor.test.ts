import { describe, expect, it, vi } from "vitest";
import { createImportOperations } from "../accessors/import-operations";

describe("房玄龄导入 accessor (RFC 0154 Phase 2d)", () => {
    it("turns execute into one typed memorial and returns the import id", async () => {
        const processZouzhe = vi.fn().mockResolvedValue({
            approved: true,
            data: "import-1",
            instruction: "准奏",
        });
        const operations = createImportOperations({
            processZouzhe,
            events: {
                ready: vi.fn().mockResolvedValue(undefined),
                onProgress: vi.fn(),
                onComplete: vi.fn(),
                onError: vi.fn(),
                onPreviewProgress: vi.fn(),
            },
        });

        await expect(operations.execute({ targetPath: "/tmp" } as never)).resolves.toEqual({
            importId: "import-1",
        });
        expect(processZouzhe).toHaveBeenCalledWith(
            expect.objectContaining({
                matter: "execute_import",
                content: { config: { targetPath: "/tmp" } },
            }),
        );
    });

    it("rejects a denied memorial instead of applying optimistic UI state", async () => {
        const operations = createImportOperations({
            processZouzhe: vi.fn().mockResolvedValue({
                approved: false,
                data: null,
                instruction: "执行失败",
            }),
            events: {
                ready: vi.fn().mockResolvedValue(undefined),
                onProgress: vi.fn(),
                onComplete: vi.fn(),
                onError: vi.fn(),
                onPreviewProgress: vi.fn(),
            },
        });

        await expect(operations.pause("import-2")).rejects.toThrow("执行失败");
    });

    it("normalizes Rust history timestamps at the persona boundary", async () => {
        const processZouzhe = vi.fn().mockResolvedValue({
            approved: true,
            data: [
                {
                    id: "history-1",
                    timestamp: "2026-07-24T00:00:00.000Z",
                    fileList: [
                        {
                            originalPath: "/a.jpg",
                            targetPath: "/library/a.jpg",
                            size: 1,
                            importTime: "2026-07-24T00:00:01.000Z",
                        },
                    ],
                    result: {
                        importedFiles: [
                            {
                                sourcePath: "/a.jpg",
                                targetPath: "/library/a.jpg",
                                size: 1,
                                importTime: "2026-07-24T00:00:02.000Z",
                            },
                        ],
                    },
                },
            ],
            instruction: "准奏",
        });
        const operations = createImportOperations({
            processZouzhe,
            events: {
                ready: vi.fn().mockResolvedValue(undefined),
                onProgress: vi.fn(),
                onComplete: vi.fn(),
                onError: vi.fn(),
                onPreviewProgress: vi.fn(),
            },
        });

        const [entry] = await operations.history();
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.fileList[0].importTime).toBeInstanceOf(Date);
        expect(entry.result.importedFiles[0].importTime).toBeInstanceOf(Date);
    });

    it("rejects overlapping previews so progress cannot cross sessions", async () => {
        let finish!: (value: unknown) => void;
        const processZouzhe = vi.fn(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        const operations = createImportOperations({
            processZouzhe,
            events: {
                ready: vi.fn().mockResolvedValue(undefined),
                onProgress: vi.fn(),
                onComplete: vi.fn(),
                onError: vi.fn(),
                onPreviewProgress: vi.fn(),
            },
        });

        const first = operations.preview({ targetPath: "/one" } as never);
        await expect(operations.preview({ targetPath: "/two" } as never)).rejects.toThrow(
            "IMPORT_PREVIEW_ALREADY_RUNNING",
        );
        finish({ approved: true, data: {}, instruction: "准奏" });
        await expect(first).resolves.toEqual({});
    });
});
