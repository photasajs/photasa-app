import type { IFindPhotoService } from "@renderer/interfaces/find-photo-service.interface";
import type { FindPhotoEvent } from "@common/scan-types";

/**
 * 用于提供 FindPhotoService 实例，通过 IPC 监听 find-photo 事件，用于刷新树结构
 *
 * @deprecated 使用 YuanTianGangService 替代
 */
interface IpcRenderer {
    on(channel: string, listener: (...args: unknown[]) => void): void;
}

export class FindPhotoServiceIpc implements IFindPhotoService {
    onFindPhoto(callback: (args: FindPhotoEvent) => void) {
        const ipc = (window as unknown as { electron?: { ipcRenderer?: IpcRenderer } }).electron
            ?.ipcRenderer;
        if (ipc) {
            ipc.on("picasa:find-photo", (...args: unknown[]) => {
                const [, event] = args;
                callback(event as FindPhotoEvent);
            });
        }
    }
}
