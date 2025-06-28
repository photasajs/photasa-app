import { from } from "rxjs";
import { filter, concatMap, mergeMap } from "rxjs/operators";
import { copyFile } from "./file-helper";
import { ensureDir, scanFolder } from "./path-helper";
import type { FileAction, ImportCallback, ScanAction, ScanArgs } from "./types";
import { electronAPI } from "@electron-toolkit/preload";
import { getLogger } from "@common/logger";

const logger = getLogger("photo-import");

const { ipcRenderer } = electronAPI;

/**
 * Import photos from folders
 *
 * @param folders  folders to import
 * @param target target folder to save
 * @param callback callback function to info the state
 */
export function importPhotos(folders: string[], target: string, callback: ImportCallback): void {
    from(folders)
        .pipe(
            mergeMap((folder) => scanFolder(folder, target)),
            filter((action) => {
                return action.isImage || action.isVideo;
            }),
            mergeMap((action) => ensureDir(action)),
            concatMap((action) => copyFile(action)), // copy file should be concatMap.
        )
        .subscribe({
            next: (action) => {
                logger.debug("next", action);
                callback({
                    type: "next",
                    error: null,
                    action,
                });
            },
            error: (error) => {
                logger.debug("error", error);
                callback({
                    type: "error",
                    error,
                    action: <FileAction>{},
                });
            },
            complete: () => {
                logger.debug("complete");
                callback({
                    type: "complete",
                    error: null,
                    action: <FileAction>{},
                });
            },
        });
}

const RequestQueue = {
    promiseQueue: {},
    sequenceId: 0,
};

/**
 * 处理扫描照片结果
 *
 * 基于 on 实现异步通信 和 promise 实现异步通信
 */
ipcRenderer.on("picasa:find-photo", (_, args: ScanArgs) => {
    logger.info("picasa:find-photo called with args:", args);
    if (args.type === "complete") {
        logger.info("picasa:find-photo complete with args:", args);
        const requestId = args.requestId;
        if (RequestQueue.promiseQueue[requestId]) {
            logger.info("picasa:find-photo complete with requestId:", requestId);
            RequestQueue.promiseQueue[requestId](args);
            delete RequestQueue.promiseQueue[requestId];
        }
    }
});

/**
 * 扫描照片
 *
 * 基于 send 和 on 实现异步通信
 * 使用 promise 实现异步通信
 */
export function scanPhotos(scan: ScanAction): Promise<ScanArgs> {
    logger.info("scanPhotos called with scan action:", scan);
    return new Promise((resolve) => {
        const requestId = `scan-${RequestQueue.sequenceId++}`;
        logger.info("Created request ID:", requestId);
        // 将 resolve 函数存储到 promiseQueue 中
        RequestQueue.promiseQueue[requestId] = resolve;
        // 调用 main 进程的 scanPhotos 方法
        ipcRenderer.send("picasa:scan-photos", {
            requestId,
            scanAction: scan,
        });
    });
}
