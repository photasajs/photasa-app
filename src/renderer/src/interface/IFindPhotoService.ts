import type { InjectionKey } from "vue";

export interface IFindPhotoService {
    onFindPhoto(callback: (args: any) => void): void;
}
export const FindPhotoServiceKey: InjectionKey<IFindPhotoService> = Symbol("FindPhotoService");
