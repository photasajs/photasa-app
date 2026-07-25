import { nextTick, ref, watch, type Ref } from "vue";
import type { FolderNode } from "@photasa/common";
import type { PhotasaConfig } from "@photasa/common";
import { BaseTree } from "@renderer/components/ui";
import { isEmpty } from "radash";
import { loggers } from "@photasa/common";
import type { usePreferenceStore } from "@renderer/stores/preference";
import type { useWeiZheng } from "@renderer/composables/useWeiZheng";
import {
    collectAllFolderKeys,
    mergeExpandedKeysForCurrentFolder,
    mergeExpandedKeysForNewFolders,
} from "@renderer/utils/folder-tree-expand";
import { canonicalFolderPath } from "@renderer/utils/folder-tree-path";
import {
    canAttemptScrollRestore,
    isFolderPresentInTree,
    shouldScrollOnFolderTreePopulated,
} from "@renderer/utils/folder-tree-scroll-restore";

const logger = loggers.lishimin;

type PreferenceStore = ReturnType<typeof usePreferenceStore>;
type WeiZhengService = ReturnType<typeof useWeiZheng>;

export interface UseFolderListTreeWatchersOptions {
    folderTree: Ref<FolderNode[]>;
    paths: Ref<string[]>;
    currentFolder: Ref<string>;
    preferenceStore: PreferenceStore;
    weiZheng: WeiZhengService;
}

export interface UseFolderListTreeWatchersResult {
    expandedKeys: Ref<string[]>;
    selectedKeys: Ref<string[]>;
    folderTreeRef: Ref<InstanceType<typeof BaseTree> | null>;
    onTreeExpand: () => void;
    selectFolder: (folderPath: string) => void;
}

/**
 * FolderList 树同步 watcher 集合（RFC 0165 Amendment）
 *
 * 职责拆分：
 * - folderTree 深监听：新子目录展开 + 补 currentFolder 祖先（禁止 scrollToNode）
 * - currentFolder/paths：展开、选中、一次性启动滚动
 * - folderTree.length 0→N：folderTree 晚到时补一次滚动
 * - selectedKeys：写回 currentFolder 并加载配置
 */
export function useFolderListTreeWatchers(
    options: UseFolderListTreeWatchersOptions,
): UseFolderListTreeWatchersResult {
    const { folderTree, paths, currentFolder, preferenceStore, weiZheng } = options;

    const expandedKeys = ref<string[]>([...paths.value]);
    const selectedKeys = ref<string[]>([]);
    const folderTreeRef = ref<InstanceType<typeof BaseTree> | null>(null);
    const didRestoreScrollIntoView = ref(false);
    const knownFolderKeys = ref<Set<string>>(new Set(collectAllFolderKeys(folderTree.value)));

    function markTreeScrollRestoreComplete(): void {
        didRestoreScrollIntoView.value = true;
    }

    function onTreeExpand(): void {
        markTreeScrollRestoreComplete();
    }

    function selectFolder(folderPath: string): void {
        const normalized = canonicalFolderPath(folderPath);
        if (normalized && normalized !== selectedKeys.value[0]) {
            logger.debug("[FolderList] selectFolder called with:", normalized);
            selectedKeys.value = [normalized];
        }
    }

    async function scrollRestoredFolderIntoViewOnce(folderPath: string): Promise<void> {
        if (!canAttemptScrollRestore(didRestoreScrollIntoView.value)) {
            return;
        }

        const normalized = canonicalFolderPath(folderPath);
        if (!normalized || !isFolderPresentInTree(normalized, folderTree.value)) {
            return;
        }

        await nextTick();
        folderTreeRef.value?.scrollToNode(normalized, { align: "center", behavior: "auto" });
        markTreeScrollRestoreComplete();
    }

    function syncTreeViewForCurrentFolder(folderPath: string): void {
        const normalized = canonicalFolderPath(folderPath);
        if (!normalized) {
            return;
        }

        expandedKeys.value = mergeExpandedKeysForCurrentFolder(
            expandedKeys.value,
            normalized,
            paths.value,
        );
        selectFolder(normalized);
        void scrollRestoredFolderIntoViewOnce(normalized);
    }

    /** folderTree 更新：新节点展开 + 保证 currentFolder 祖先可见；绝不滚动 */
    watch(
        folderTree,
        (newTree) => {
            const allKeys = collectAllFolderKeys(newTree);
            const newKeys = allKeys.filter((key) => !knownFolderKeys.value.has(key));

            if (newKeys.length > 0) {
                knownFolderKeys.value = new Set(allKeys);
                expandedKeys.value = mergeExpandedKeysForNewFolders(
                    expandedKeys.value,
                    newKeys,
                    paths.value,
                );
            }

            const folder = currentFolder.value;
            if (!folder) {
                return;
            }

            expandedKeys.value = mergeExpandedKeysForCurrentFolder(
                expandedKeys.value,
                folder,
                paths.value,
            );
        },
        { deep: true },
    );

    watch(
        [currentFolder, paths],
        ([newFolder]) => {
            if (newFolder) {
                logger.debug(
                    "[FolderList] currentFolder changed, syncing tree expand + select:",
                    newFolder,
                );
                syncTreeViewForCurrentFolder(newFolder);
            }
        },
        { immediate: true },
    );

    watch(
        () => folderTree.value.length,
        (length, previousLength) => {
            const folder = currentFolder.value;
            if (!shouldScrollOnFolderTreePopulated(length, previousLength, folder)) {
                return;
            }
            void scrollRestoredFolderIntoViewOnce(folder);
        },
    );

    watch(
        selectedKeys,
        async () => {
            if (!isEmpty(selectedKeys.value) && currentFolder.value !== selectedKeys.value[0]) {
                const newFolderPath = selectedKeys.value[0];
                preferenceStore.appState.currentFolder = newFolderPath;

                try {
                    const config = await weiZheng.getFolderConfig(newFolderPath);

                    preferenceStore.appState.currentFolderConfig =
                        config ||
                        ({
                            version: "",
                            photoList: [],
                            lastModified: 0,
                        } satisfies PhotasaConfig);
                } catch (error) {
                    logger.warn("无法加载文件夹配置:", error);
                    preferenceStore.appState.currentFolderConfig = {
                        version: "",
                        photoList: [],
                        lastModified: 0,
                    } satisfies PhotasaConfig;
                }
            }
        },
        { deep: true, flush: "post" },
    );

    return {
        expandedKeys,
        selectedKeys,
        folderTreeRef,
        onTreeExpand,
        selectFolder,
    };
}
