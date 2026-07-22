/**
 * 缩略图适配器 — invoke 前必须把 WebView URL 转成磁盘路径
 */
import { isTauri } from "./env";
import { callLegacyPreloadSection } from "./legacy-preload-access";
import { webviewMediaUrlToAbsolutePath } from "@renderer/utils/media-url";

export interface ThumbnailRequest {
    path: string;
    thumbnail: string;
    width?: number;
    height?: number;
    withoutEnlargement?: boolean;
    preview?: string;
    always?: boolean;
}

export interface ThumbnailResponse {
    success: boolean;
    file?: string;
    error?: string;
    fallback?: boolean;
}

async function normalizeThumbnailRequestPaths(
    request: ThumbnailRequest,
): Promise<ThumbnailRequest> {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string>("normalize_path", {
        path: webviewMediaUrlToAbsolutePath(request.path),
    });
    const thumbnail = await invoke<string>("normalize_path", {
        path: webviewMediaUrlToAbsolutePath(request.thumbnail),
    });
    const preview = request.preview
        ? await invoke<string>("normalize_path", {
              path: webviewMediaUrlToAbsolutePath(request.preview),
          })
        : "";
    return { ...request, path, thumbnail, preview: preview || request.preview };
}

export const thumbnailAdapter = {
    create: async (request: ThumbnailRequest): Promise<ThumbnailResponse> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            const normalized = await normalizeThumbnailRequestPaths(request);
            return await invoke("create_thumbnail", { request: normalized });
        }
        return (await callLegacyPreloadSection(
            "thumbnail",
            "create",
            request,
        )) as ThumbnailResponse;
    },

    remove: async (request: ThumbnailRequest): Promise<ThumbnailResponse> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            const normalized = await normalizeThumbnailRequestPaths(request);
            return await invoke("remove_thumbnail", { request: normalized });
        }
        return (await callLegacyPreloadSection(
            "thumbnail",
            "remove",
            request,
        )) as ThumbnailResponse;
    },
};
