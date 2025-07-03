export interface ThumbnailRequest {
    path: string; // 源文件路径
    thumbnail: string; // 缩略图路径
    width: number; // 缩略图宽度
    height: number; // 缩略图高度
    always?: boolean; // 是否总是创建缩略图
    preview: string; // 预览图片路径
    withoutEnlargement?: boolean; // 是否不放大缩略图
}

export type ThumbnailResponse = {
    success: boolean;
    file?: string;
    error?: string;
};

export type ThumbnailWorkerAction = "create" | "remove";

export const ThumbnailServiceAction = {
    create: "picasa:create-thumbnail",
    remove: "picasa:remove-thumbnail",
};
