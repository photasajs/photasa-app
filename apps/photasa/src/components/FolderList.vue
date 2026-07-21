<script setup lang="ts">
import { ref, watch, reactive, computed } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { storeToRefs } from "pinia";
import type { PhotasaConfig } from "@photasa/common";
import { normalizePath } from "@renderer/utils/path";
import { isEmpty } from "radash";
import { useZhangSunWuJi } from "@renderer/composables/useZhangSunWuJi";
// ✅ RFC 0058: 使用服务而不是直接 API 调用
import {
    BaseContextMenu,
    BaseMenuItem,
    BaseBreadcrumb,
    BaseBreadcrumbItem,
    BaseTree,
} from "@renderer/components/ui";
import { PhFolder } from "@phosphor-icons/vue";
import EnhancedImageInfoModal from "./EnhancedImageInfoModal.vue";
import type { TreeNode } from "@renderer/components/ui/BaseTree.vue";
import { loggers } from "@photasa/common";
import { useWeiZheng } from "@renderer/composables/useWeiZheng";
import { useXuanzang } from "@renderer/composables/useXuanzang";
import { useAppStateStore } from "@renderer/services/fangxuanling/stores/appstate-store";
import { EventNames } from "@renderer/constants/event-names";
import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";
import {
    collectAllFolderKeys,
    mergeExpandedKeysForNewFolders,
} from "@renderer/utils/folder-tree-expand";

const logger = loggers.lishimin;

/**
 * ✅ RFC 0058: 使用长孙无忌服务
 */
const zhangSunWuJi = useZhangSunWuJi();

/**
 * Preference store
 */
const preferenceStore = usePreferenceStore();

/**
 * WeiZheng service
 */
const weiZheng = useWeiZheng();

/**
 * Xuanzang service
 */
const xuanzang = useXuanzang();

/**
 * ✅ RFC 0143: 右键 rescan → 百姓上书 → 李世民 → 尉迟恭
 */

/**
 * Store to refs
 */
const { paths, currentFolder } = storeToRefs(preferenceStore);

/**
 * Folder tree — 直接绑定 Pinia appState，保证 reconcile / 扫描更新后 UI 立即刷新
 */
const appStateStore = useAppStateStore();
const { folderTree } = storeToRefs(appStateStore);

/**
 * Expanded keys
 */
const expandedKeys = ref<string[]>([...paths.value]);

/** 跟踪已展示过的树节点，用于发现新子目录时自动展开祖先 */
const knownFolderKeys = ref<Set<string>>(new Set(collectAllFolderKeys(folderTree.value)));

watch(
    folderTree,
    (newTree) => {
        const allKeys = collectAllFolderKeys(newTree);
        const newKeys = allKeys.filter((key) => !knownFolderKeys.value.has(key));
        if (newKeys.length === 0) {
            return;
        }

        knownFolderKeys.value = new Set(allKeys);
        expandedKeys.value = mergeExpandedKeysForNewFolders(
            expandedKeys.value,
            newKeys,
            paths.value,
        );
    },
    { deep: true },
);

/**
 * Selected keys
 */
const selectedKeys = ref<string[]>([]);

/**
 * Show config modal
 */
const showConfigModal = ref(false);

/**
 * Select folder method - called by parent component
 */
const selectFolder = (folderPath: string) => {
    if (folderPath && folderPath !== selectedKeys.value[0]) {
        logger.debug("[FolderList] selectFolder called with:", folderPath);
        selectedKeys.value = [folderPath];
    }
};

// Watch currentFolder changes and notify FolderList to select it
watch(
    currentFolder,
    (newFolder) => {
        if (newFolder) {
            logger.debug("[App] currentFolder changed, notifying FolderList to select:", newFolder);
            selectFolder(newFolder);
        }
    },
    { immediate: true },
);
/**
 * Watch the selected keys
 */
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

/**
 * Loading info
 */
const loadingInfo = ref(false);

/**
 * Photasa config
 */
const photasa = reactive<{
    config: any;
    path: string;
    maxDepth: number;
    status: string;
    lastModified: Date;
}>({
    config: {},
    path: "",
    maxDepth: 0,
    status: "unknown",
    lastModified: new Date(),
});

/**
 * Open photasa config modal
 * @param folder - The folder to open the config modal for
 */
async function openPhotasaConfig(folder: string): Promise<void> {
    // TODO: 优化，如果配置文件不存在，则提示用户
    loadingInfo.value = true;
    showConfigModal.value = true;
    const config = await weiZheng.getFolderConfig(folder);

    photasa.config = config;
    photasa.path = folder;
    photasa.status = config?.photoList?.length > 0 ? "completed" : "empty";
    photasa.lastModified = new Date(config?.lastModified || Date.now());
    loadingInfo.value = false;
}

/**
 * Open the file in finder - 通过长孙无忌服务，使用 qizou 流程
 * @param key - The folder to open in finder (可能是 file:// URL 或普通路径)
 */
function openFileInFinder(key: string): void {
    // ✅ RFC 0058: 服务层统一处理 file:// URL 转换，组件直接传递原始路径
    zhangSunWuJi.openInFinder(key);
}

/**
 * Fix the photasa config
 */
async function fixConfig(): Promise<void> {
    const config = await weiZheng.fixFolderConfig(photasa.path);
    photasa.config = config;
    photasa.status = config?.photoList?.length > 0 ? "completed" : "empty";
    photasa.lastModified = new Date(config?.lastModified || Date.now());
}

/**
 * Rescan the folder — 百姓上书 → 李世民 → 尉迟恭（RFC 0143）
 * @param key - folder path from tree **node.key**（勿用 slot 的 `key`：Vue 保留属性，永远是 undefined）
 */
function rescan(key: string): void {
    if (typeof key !== "string" || key.trim() === "") {
        logger.error("[FolderList] rescan 收到无效 key", { key, keyType: typeof key });
        return;
    }
    // Tree key 已是 preference 中的规范路径；勿再调 normalizePath（曾误返回 Promise）
    const folderPath = key.trim();
    logger.info(`[FolderList] 百姓上书重新扫描: ${folderPath}`);
    window.dispatchEvent(
        new CustomEvent(EventNames.BAIXING_SHANGSHU, {
            detail: {
                action: QizouMatters.REQUEST_RESCAN,
                path: folderPath,
            },
            bubbles: true,
            cancelable: true,
        }),
    );
}

// Expose methods to parent component
defineExpose({
    selectFolder,
});
</script>

<template>
    <div class="folder-list-card">
        <div
            class="px-4 h-12 border-b border-[var(--color-border)] flex items-center justify-between"
        >
            <span
                class="text-xs font-semibold tracking-widest uppercase text-[var(--color-text-secondary)]"
            >
                {{ xuanzang.translate("app.folderList") }}
            </span>
        </div>
        <div class="flex-1 min-h-0 overflow-auto tree-container">
            <BaseTree
                class="folder-tree"
                v-model:expandedKeys="expandedKeys"
                v-model:selectedKeys="selectedKeys"
                :tree-data="folderTree as TreeNode[]"
                :virtual="true"
                height="100%"
                :item-height="34"
                :show-icon="true"
                :show-line="false"
                :selectable="true"
                :checkable="false"
                :auto-focus-on-expand="true"
            >
                <!-- 文件夹图标 -->
                <template #icon>
                    <PhFolder :size="15" class="text-[var(--color-text-tertiary)]" />
                </template>

                <template #title="{ node, title }">
                    <BaseContextMenu>
                        <span v-if="paths.includes(node.key)" class="root-folder-node">{{
                            title
                        }}</span>
                        <span v-else class="folder-node">{{ title }}</span>

                        <template #menu="{ close }">
                            <BaseMenuItem
                                @click="
                                    rescan(node.key);
                                    close();
                                "
                            >
                                {{ xuanzang.translate("menu.rescan") }}
                            </BaseMenuItem>
                            <BaseMenuItem
                                @click="
                                    openPhotasaConfig(node.key);
                                    close();
                                "
                            >
                                {{ xuanzang.translate("menu.getConfig") }}
                            </BaseMenuItem>
                            <BaseMenuItem
                                @click="
                                    openFileInFinder(node.key);
                                    close();
                                "
                            >
                                {{ xuanzang.translate("menu.open") }}
                            </BaseMenuItem>
                        </template>
                    </BaseContextMenu>
                </template>
            </BaseTree>
        </div>
    </div>
    <EnhancedImageInfoModal
        v-model="showConfigModal"
        :photasa="photasa"
        :loading="loadingInfo"
        @fix-config="fixConfig"
    />
</template>
<style lang="scss">
.root-folder-node {
    font-weight: 600;
    color: var(--color-text-primary, var(--color-text));
}

.folder-node {
    white-space: nowrap;
    color: var(--color-tree-text, var(--color-text));
}

.folder-list-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-tree-bg);
}

.tree-container {
    padding: 4px 0;
    background: var(--color-tree-bg);
    height: 100%;
    min-height: 0;
}

.folder-tree {
    min-height: 100%;
    width: 100%;

    /* Modern directory tree row styling */
    .base-tree-node {
        padding: 5px 0;
        margin: 2px 8px;
        border-radius: 6px;
        color: var(--color-text-secondary, #cccccc);
        font-weight: 500;
        font-size: 13px;
        transition:
            background-color 0.15s ease,
            color 0.15s ease;
        line-height: 24px;

        &:hover {
            background-color: var(--color-tree-hover, rgba(255, 255, 255, 0.04));
            color: var(--color-text-primary, #ffffff);
        }

        &--selected {
            background-color: rgba(55, 148, 255, 0.12) !important;
            color: var(--color-primary, #3794ff) !important;
            font-weight: 600;
        }
    }

    /* Modern switcher styling */
    .base-tree-node__switcher {
        color: var(--color-text-tertiary, #888888) !important;
        transition:
            transform 0.2s ease,
            opacity 0.2s ease;
        opacity: 0.8;

        &:hover {
            background-color: rgba(255, 255, 255, 0.08) !important;
            color: var(--color-text-primary, #ffffff) !important;
        }
    }

    .base-tree-node__switcher-icon {
        color: inherit !important;
    }
}
</style>
