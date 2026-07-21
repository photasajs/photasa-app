import { useTask } from "vue-concurrency";
import {
    createThumbnailTask,
    isFileUnderFolder,
    removeThumbnailTask,
    addToPhotoList,
    removeFromPhotoList,
    isHiddenFile,
    shouldIgnorePhotasaPath,
    startWatching,
} from "@renderer/utils/api";
import type { WatchAction, WatchState } from "@photasa/common";
import type { ThumbnailRequest } from "@photasa/common";
import { deepCopy } from "./object";
import type { PreferenceStore } from "@renderer/stores/preference";
import type { IQinQiongService } from "@renderer/interfaces/qin-qiong.interface";

/**
 * 判断是否为媒体文件
 * @param state - 状态
 * @returns 是否为媒体文件
 */
export function isMedia(state: WatchState): boolean {
    return state.isImage || state.isVideo;
}

/**
 * 判断是否可以处理文件
 * @param state - 状态
 * @returns 是否可以处理文件
 */
export function canHandleFile(state: WatchState): boolean {
    return (
        state.isFile &&
        state.path?.length > 0 &&
        !isHiddenFile(state.path) &&
        !shouldIgnorePhotasaPath(state.path) &&
        isMedia(state)
    );
}

/**
 * 处理添加文件
 * @param state - 状态
 * @param preferenceStore - 偏好设置
 * @param qinQiongService - 秦琼服务（文件系统事件守护者）
 */
async function handleAddFile(
    state: WatchState,
    preferenceStore: PreferenceStore,
    qinQiongService: IQinQiongService,
): Promise<void> {
    // ✅ RFC 0042: 如果是目录添加，通过秦琼服务更新 folderTree
    if (!state.isFile && state.path?.length > 0) {
        // 目录添加，秦琼发起启奏给李世民
        await qinQiongService.addPath(state.path);
        return;
    }
    // Skip hidden or empty path or ignored file
    if (canHandleFile(state)) {
        const request = {
            path: state.path as string,
            thumbnail: state.thumbnail as string,
            width: preferenceStore.thumbnailSize,
            height: preferenceStore.thumbnailSize,
            preview: "",
        };

        await createThumbnailTask.perform(request);

        await addToPhotoList(state.path);

        // if the file is in the current folder, update the current folder config
        // check after replace current folder, if any string still exist
        if (isFileUnderFolder(state.path, preferenceStore.currentFolder)) {
            preferenceStore.addToCurrentPhotasaConfig(request);
        }
    }
}

/**
 * 处理删除文件
 * @param state - 状态
 * @param preferenceStore - 偏好设置
 * @param qinQiongService - 秦琼服务（文件系统事件守护者）
 */
async function handleDeleteFile(
    state: WatchState,
    preferenceStore: PreferenceStore,
    qinQiongService: IQinQiongService,
): Promise<void> {
    // ✅ RFC 0042: 目录删除，通过秦琼服务更新 folderTree
    if (!state.isFile) {
        if (!state.path?.length) {
            return;
        }
        await qinQiongService.removePath(state.path);
        return;
    }

    if (!state.path?.length) {
        return;
    }

    if (isMedia(state)) {
        const request = {
            path: state.path as string,
            thumbnail: state.thumbnail,
            width: preferenceStore.thumbnailSize,
            height: preferenceStore.thumbnailSize,
            preview: "",
        } satisfies ThumbnailRequest;
        await removeThumbnailTask.perform(request);

        await removeFromPhotoList(state.path);

        if (isFileUnderFolder(request.path, preferenceStore.currentFolder)) {
            preferenceStore.removeFromCurrentPhotasaConfig(request);
        }
    }
}

async function handleChangeFile(
    state: WatchState,
    preferenceStore: PreferenceStore,
): Promise<void> {
    // Skip hidden or empty path or ignored file
    if (
        !state.isFile ||
        !state.path?.length ||
        isHiddenFile(state.path) ||
        shouldIgnorePhotasaPath(state.path)
    ) {
        return;
    }

    if (isMedia(state)) {
        // if file is changed, then recreate the thumbnail only
        const request = {
            path: state.path as string,
            thumbnail: state.thumbnail as string,
            width: preferenceStore.thumbnailSize,
            height: preferenceStore.thumbnailSize,
            preview: "",
            always: true,
        } satisfies ThumbnailRequest;

        await createThumbnailTask.perform(request);
    }
    return;
}

type FileActionHandler = (
    state: WatchState,
    preferenceStore: PreferenceStore,
    qinQiongService: IQinQiongService,
) => Promise<void>;

const actions: Partial<Record<WatchAction, FileActionHandler>> = {
    add: handleAddFile,
    change: handleChangeFile,
    delete: handleDeleteFile,
};

export const handleFileTask = useTask(function* (
    _,
    state: WatchState,
    preferenceStore: PreferenceStore,
    qinQiongService: IQinQiongService,
) {
    const handler = actions[state.action];
    if (handler) {
        yield handler(state, preferenceStore, qinQiongService);
    }
})
    .enqueue()
    .maxConcurrency(1);

/**
 * 开始监听文件
 * @param dirs - 目录
 * @param preferenceStore - 偏好设置
 * @param qinQiongService - 秦琼服务（文件系统事件守护者）
 */
export function startFileWatching(
    dirs: string[],
    preferenceStore: PreferenceStore,
    qinQiongService: IQinQiongService,
): void {
    startWatching(
        {
            path: dirs[0],
            recursive: true,
            paths: deepCopy(dirs),
            options: {
                ignored: /(^|[/\\])\../,
                ignoreInitial: true,
                awaitWriteFinish: true,
            },
            thumbnailSize: preferenceStore.thumbnailSize,
        },
        (state: WatchState) => {
            handleFileTask.perform(state, preferenceStore, qinQiongService);
        },
    );
}
