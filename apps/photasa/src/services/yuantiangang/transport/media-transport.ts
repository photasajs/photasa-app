import type { ThumbnailRequest, ThumbnailResponse } from "@photasa/common";
import { webviewMediaUrlToAbsolutePath } from "@renderer/utils/media-url";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export type MediaMatter = "create_thumbnail" | "extract_metadata" | "get_files_modified";

interface MediaTransportDependencies {
    invoke: Invoke;
}

async function normalizePath(invoke: Invoke, path: string): Promise<string> {
    return invoke<string>("normalize_path", {
        path: webviewMediaUrlToAbsolutePath(path),
    });
}

export class MediaTransport {
    constructor(private readonly dependencies: MediaTransportDependencies) {}

    async execute(matter: MediaMatter, context: Record<string, unknown>): Promise<unknown> {
        const { invoke } = this.dependencies;

        if (matter === "create_thumbnail") {
            const request = context.request as ThumbnailRequest;
            const path = await normalizePath(invoke, request.path);
            const thumbnail = await normalizePath(invoke, request.thumbnail);
            const preview = request.preview
                ? await normalizePath(invoke, request.preview)
                : request.preview;
            return invoke<ThumbnailResponse>("create_thumbnail", {
                request: { ...request, path, thumbnail, preview },
            });
        }

        if (matter === "extract_metadata") {
            return invoke("extract_metadata", {
                args: {
                    request: {
                        filePath: webviewMediaUrlToAbsolutePath(String(context.path ?? "")),
                    },
                },
            });
        }

        return invoke<Record<string, number>>("get_files_modified", {
            paths: context.paths,
        });
    }
}
