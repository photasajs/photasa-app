<script setup lang="ts">
import { ref, watch, reactive, defineExpose } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import type { PhotasaConfig } from "@common/config-types";
import { fixPhotasaConfig, getPhotasaConfig, resetPhotasaConfig } from "@renderer/utils/api";
import { openInFinder } from "@renderer/utils/api-path";
import { isEmpty } from "radash";
// removeFileProtocol 通过 preload API 使用
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
import { loggers } from "@common/logger";

/**
 * I18n
 */
const { t } = useI18n();
const logger = loggers.renderer;

/**
 * Preference store
 */
const preferenceStore = usePreferenceStore();

/**
 * Add scan folder
 */
const { addScanFolder } = preferenceStore;

/**
 * Store to refs
 */
const { paths, currentFolder, currentFolderConfig, folderTree } = storeToRefs(preferenceStore);

/**
 * Expanded keys
 */
const expandedKeys = ref<string[]>([...paths.value]);

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
        // Only when Current folder changed, update current folder and load photasa config
        if (!isEmpty(selectedKeys.value) && currentFolder.value !== selectedKeys.value[0]) {
            const newFolderPath = selectedKeys.value[0];
            currentFolder.value = newFolderPath;

            try {
                // 自动加载新文件夹的配置
                const config = await getPhotasaConfig(newFolderPath);

                currentFolderConfig.value =
                    config ||
                    ({
                        version: "",
                        photoList: [],
                        lastModified: 0,
                    } satisfies PhotasaConfig);
            } catch (error) {
                logger.warn("无法加载文件夹配置:", error);
                // 如果加载失败，使用空配置
                currentFolderConfig.value = {
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
    const config = await getPhotasaConfig(folder);

    photasa.config = config;
    photasa.path = folder;
    photasa.status = config?.photoList?.length > 0 ? "completed" : "empty";
    photasa.lastModified = new Date(config?.lastModified || Date.now());
    loadingInfo.value = false;
}

/**
 * Open the file in finder - 直接传递 file:// URL，让 preload 层处理转换
 * @param key - The folder to open in finder
 */
function openFileInFinder(key: string): void {
    openInFinder(key);
}

/**
 * Fix the photasa config
 */
async function fixConfig(): Promise<void> {
    const config = await fixPhotasaConfig(photasa.path);
    photasa.config = config;
    photasa.status = config?.photoList?.length > 0 ? "completed" : "empty";
    photasa.lastModified = new Date(config?.lastModified || Date.now());
}

/**
 * Rescan the folder
 * @param key - The folder to rescan
 */
async function rescan(key: string): Promise<void> {
    await resetPhotasaConfig(key);
    addScanFolder(key, "rescan");
}

// Expose methods to parent component
defineExpose({
    selectFolder,
});
</script>

<template>
    <div class="folder-list-card">
        <div class="px-4 py-2 border-b border-gray-100 flex items-center">
            <BaseBreadcrumb class="folder-list-header">
                <BaseBreadcrumbItem>
                    {{ t("app.folderList") }}
                </BaseBreadcrumbItem>
            </BaseBreadcrumb>
        </div>
        <div class="flex-1 min-h-0 overflow-auto tree-container">
            <BaseTree
                class="folder-tree"
                v-model:expandedKeys="expandedKeys"
                v-model:selectedKeys="selectedKeys"
                :tree-data="folderTree as TreeNode[]"
                :virtual="true"
                height="100%"
                :item-height="28"
                :show-icon="true"
                :show-line="false"
                :selectable="true"
                :checkable="false"
            >
                <!-- 文件夹图标 -->
                <template #icon>
                    <PhFolder :size="14" />
                </template>

                <template #title="slotProps">
                    <BaseContextMenu>
                        <span
                            v-if="paths.includes((slotProps as any).key)"
                            class="root-folder-node"
                            >{{ (slotProps as any).title }}</span
                        >
                        <span v-else class="folder-node">{{ (slotProps as any).title }}</span>

                        <template #menu="{ close }">
                            <BaseMenuItem
                                @click="
                                    rescan((slotProps as any).key);
                                    close();
                                "
                            >
                                {{ t("menu.rescan") }}
                            </BaseMenuItem>
                            <BaseMenuItem
                                @click="
                                    openPhotasaConfig((slotProps as any).key);
                                    close();
                                "
                            >
                                {{ t("menu.getConfig") }}
                            </BaseMenuItem>
                            <BaseMenuItem
                                @click="
                                    openFileInFinder((slotProps as any).key);
                                    close();
                                "
                            >
                                {{ t("menu.open") }}
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
    color: var(--color-tree-selected, var(--color-primary));
}

.folder-node {
    white-space: nowrap;
    color: var(--color-tree-text, var(--color-text));
    background: var(--color-tree-bg, var(--color-bg));
    transition:
        background 0.2s,
        color 0.2s;
}
.folder-node:hover {
    background: var(--color-tree-hover, var(--color-bg-secondary));
    color: var(--color-tree-hover-text, var(--color-primary));
}
.folder-node.active {
    background: var(--color-tree-active, var(--color-tree-selected, var(--color-primary)));
    color: var(--color-tree-active-text, var(--color-white));
}
.folder-node.disabled {
    color: var(--color-tree-disabled-text);
    background: var(--color-tree-disabled-bg);
    cursor: not-allowed;
    opacity: 0.6;
}
.folder-list-header {
    height: 32px;
    line-height: 32px;
    background: var(--color-tree-bg);
    color: var(--color-tree-text);
    border-bottom: 1px solid var(--color-tree-border);
    display: flex;
    align-items: center;
}
.folder-list-card {
    flex: 1; /* 使用 flex 占满父容器空间 */
    display: flex;
    flex-direction: column;
    overflow: hidden; /* 让内部 BaseTree 控制滚动 */
    background: var(--color-tree-bg);
}

.tree-container {
    padding: 0;
    background: var(--color-tree-bg);
    height: 100%; /* 强制占满剩余空间 */
    min-height: 0; /* 允许内容滚动 */
}

.folder-tree {
    min-height: 100%; /* 确保树组件至少占满容器高度 */
    width: 100%;
}
</style>
