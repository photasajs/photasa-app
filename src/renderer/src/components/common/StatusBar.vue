<script setup lang="ts">
/**
 * 独立状态栏组件，完全变量化，支持主题 patch
 * - 自动消费 Pinia useStatusBarStore
 * - 支持国际化、进度、错误等
 * - 样式全部用 CSS 变量
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useStatusBarStore } from "@renderer/stores/statusBar";

const statusBarStore = useStatusBarStore();
const { t } = useI18n();

const statusText = computed(() =>
    statusBarStore.status ? t(`status.${statusBarStore.status}`) : "",
);
</script>
<template>
    <footer class="status-bar">
        <span class="status-bar-text">
            <template v-if="statusBarStore.status">
                {{ statusText }}
                <span v-if="statusBarStore.currentTask">: {{ statusBarStore.currentTask }}</span>
                <span v-if="statusBarStore.progress !== undefined">
                    ({{ statusBarStore.progress }}%)
                </span>
                <span v-if="statusBarStore.error">
                    [{{ t("notification.error") }}: {{ statusBarStore.error }}]
                </span>
            </template>
            <template v-else>
                <slot> </slot>
            </template>
        </span>
    </footer>
</template>
<style scoped>
.status-bar {
    height: 32px;
    line-height: 32px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    background: var(--color-footer-bg);
    color: var(--color-statusbar-fg);
    border-top: 1px solid var(--color-footer-border);
    font-size: 1em;
    user-select: none;
    transition:
        background 0.2s,
        color 0.2s;
}
.status-bar-text {
    color: var(--color-statusbar-fg);
    font-weight: 500;
    white-space: pre-line;
}
</style>
