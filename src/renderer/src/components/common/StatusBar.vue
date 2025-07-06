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
import bmcButton from "@renderer/assets/bmc-button.png";

const statusBarStore = useStatusBarStore();
const { t } = useI18n();

const statusText = computed(() =>
    statusBarStore.status ? t(`status.${statusBarStore.status}`) : "",
);

function openBuyMeCoffee() {
    window.api.openExternal("https://www.buymeacoffee.com/PpVB0uO");
}
</script>
<template>
    <div class="status-bar">
        <div class="status-content">
            <!-- 原有状态栏内容和插槽保留 -->
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
        </div>
        <!-- Buy Me a Coffee 按钮始终在最右侧 -->
        <a href="#" class="bmc-btn" @click.prevent="openBuyMeCoffee">
            <img :src="bmcButton" alt="Buy me a coffee" style="height: 28px; display: block" />
        </a>
    </div>
</template>
<style scoped>
.status-bar {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 32px;
    background: var(--color-bg-secondary, #f3f3f3);
    padding: 0 12px;
}
.status-content {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.bmc-btn {
    flex-shrink: 0;
    margin-left: 12px;
    display: flex;
    align-items: center;
}
</style>
