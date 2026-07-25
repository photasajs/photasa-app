import type { FileMetadata, ThumbnailRequest, ThumbnailResponse } from "@photasa/common";
import type { Zouzhe, ZouzheResponse } from "@renderer/interfaces/fang-xuan-ling.interface";
import type { IGalleryMediaOperations } from "@renderer/interfaces/wei-zheng.interface";

interface GalleryMediaDependencies {
    processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse>;
}

function memorial(matter: string, content: Record<string, unknown>): Zouzhe {
    return {
        department: "图库监察",
        matter,
        content,
        timestamp: Date.now(),
        priority: "normal",
    };
}

function approvedData<T>(response: ZouzheResponse): T {
    if (!response.approved) throw new Error(response.instruction || "图库操作失败");
    return response.data as T;
}

function date(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(typeof value === "string" || typeof value === "number" ? value : 0);
}

function normalizeMetadata(raw: unknown): FileMetadata {
    const metadata = raw as FileMetadata & {
        modifiedTime: unknown;
        createdTime: unknown;
        dateTime?: unknown;
        creationTime?: unknown;
    };
    return {
        ...metadata,
        modifiedTime: date(metadata.modifiedTime),
        createdTime: date(metadata.createdTime),
        dateTime: metadata.dateTime == null ? undefined : date(metadata.dateTime),
        creationTime: metadata.creationTime == null ? undefined : date(metadata.creationTime),
    };
}

export function createGalleryMediaOperations({
    processZouzhe,
}: GalleryMediaDependencies): IGalleryMediaOperations {
    const execute = async <T>(matter: string, content: Record<string, unknown>): Promise<T> =>
        approvedData<T>(await processZouzhe(memorial(matter, content)));

    return {
        createThumbnail: (request: ThumbnailRequest) =>
            execute<ThumbnailResponse>("create_thumbnail", { request }),
        async fileMetadata(path: string) {
            return normalizeMetadata(await execute("extract_metadata", { path }));
        },
        filesModified: (paths: string[]) =>
            execute<Record<string, number>>("get_files_modified", { paths }),
    };
}
