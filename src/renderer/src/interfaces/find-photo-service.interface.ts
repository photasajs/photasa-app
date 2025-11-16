import type { InjectionKey } from "vue";
import type { FindPhotoEvent } from "@common/scan-types";

/**
 * 用于监听 find-photo 事件，用于刷新树结构
 */
export interface IFindPhotoService {
    onFindPhoto(callback: (args: FindPhotoEvent) => void): void;
}

/**
 * 用于提供 FindPhotoService 实例
 */
export const FindPhotoServiceKey: InjectionKey<IFindPhotoService> = Symbol("FindPhotoService");
