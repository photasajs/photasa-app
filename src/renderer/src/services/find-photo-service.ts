import type { IFindPhotoService } from "@renderer/interface/find-photo-service.interface";

/**
 * 用于提供 FindPhotoService 实例，通过 IPC 监听 find-photo 事件，用于刷新树结构
 */
export class FindPhotoServiceIpc implements IFindPhotoService {
    onFindPhoto(callback: (args: any) => void) {
        const ipc =
            (window as any).electronAPI?.ipcRenderer || (window as any).electron?.ipcRenderer;
        if (ipc) {
            ipc.on("picasa:find-photo", (_: any, args: any) => callback(args));
        }
    }
}
