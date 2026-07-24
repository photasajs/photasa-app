import { describe, expect, it, vi } from "vitest";
import { MediaTransport } from "../transport/media-transport";

describe("MediaTransport (RFC 0154 Phase 2e)", () => {
    it("normalizes thumbnail paths before invoking create_thumbnail", async () => {
        const invoke = vi
            .fn()
            .mockResolvedValueOnce("/photos/source.jpg")
            .mockResolvedValueOnce("/photos/.photasaoriginals/thumb.png")
            .mockResolvedValueOnce({ success: true, file: "/photos/.photasaoriginals/thumb.png" });
        const transport = new MediaTransport({ invoke });

        await expect(
            transport.execute("create_thumbnail", {
                request: {
                    path: `asset://localhost/${encodeURIComponent("/photos/source.jpg")}`,
                    thumbnail: `asset://localhost/${encodeURIComponent(
                        "/photos/.photasaoriginals/thumb.png",
                    )}`,
                    width: 200,
                    height: 200,
                    preview: "",
                },
            }),
        ).resolves.toEqual({
            success: true,
            file: "/photos/.photasaoriginals/thumb.png",
        });

        expect(invoke.mock.calls).toEqual([
            ["normalize_path", { path: "/photos/source.jpg" }],
            ["normalize_path", { path: "/photos/.photasaoriginals/thumb.png" }],
            [
                "create_thumbnail",
                {
                    request: {
                        path: "/photos/source.jpg",
                        thumbnail: "/photos/.photasaoriginals/thumb.png",
                        width: 200,
                        height: 200,
                        preview: "",
                    },
                },
            ],
        ]);
    });

    it("uses extract_metadata Rust args wrapper and an absolute file path", async () => {
        const invoke = vi.fn().mockResolvedValue({ name: "source.jpg" });
        const transport = new MediaTransport({ invoke });

        await transport.execute("extract_metadata", {
            path: "file:///photos/source.jpg",
        });

        expect(invoke).toHaveBeenCalledWith("extract_metadata", {
            args: {
                request: {
                    filePath: "/photos/source.jpg",
                },
            },
        });
    });

    it("forwards thumbnail mtime paths without changing cache keys", async () => {
        const invoke = vi.fn().mockResolvedValue({ "/photos/thumb.png": 42 });
        const transport = new MediaTransport({ invoke });

        await expect(
            transport.execute("get_files_modified", {
                paths: ["/photos/thumb.png"],
            }),
        ).resolves.toEqual({ "/photos/thumb.png": 42 });

        expect(invoke).toHaveBeenCalledWith("get_files_modified", {
            paths: ["/photos/thumb.png"],
        });
    });
});
