import type { IFindPhotoService } from "@renderer/interface/IFindPhotoService";

export class FindPhotoServiceIpc implements IFindPhotoService {
    onFindPhoto(callback: (args: any) => void) {
        const ipc =
            (window as any).electronAPI?.ipcRenderer || (window as any).electron?.ipcRenderer;
        if (ipc) {
            ipc.on("picasa:find-photo", (_: any, args: any) => callback(args));
        }
    }
}
