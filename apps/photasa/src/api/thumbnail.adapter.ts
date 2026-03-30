/**
 * 缩略图适配器
 * 适配缩略图服务 API
 */

import { isTauri } from "./env";

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
}

export const thumbnailAdapter = {
    /**
     * 创建缩略图
     */
    create: async (request: ThumbnailRequest): Promise<ThumbnailResponse> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke("create_thumbnail", { request });
        } else {
            return await (window as any).electronAPI?.thumbnail?.create(request);
        }
    },

    /**
     * 删除缩略图
     */
    remove: async (request: ThumbnailRequest): Promise<ThumbnailResponse> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke("remove_thumbnail", { request });
        } else {
            return await (window as any).electronAPI?.thumbnail?.remove(request);
        }
    },
};
