<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Vue3MarkdownIt from "vue3-markdown-it";
import BuyMeCoffeeButton from "@renderer/components/common/BuyMeCoffeeButton.vue";

const { t } = useI18n();

const emit = defineEmits(["exit"]);

// Accessibility improvements
const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
        // Emit event to parent to handle exit
        emit("exit");
    }
};
</script>

<template>
    <div class="about-container settings-container" tabindex="0" @keydown="handleKeyPress">
        <div class="about-bmc">
            <BuyMeCoffeeButton />
        </div>
        <vue3-markdown-it :source="t('about.markdown')" class="about-md" />
    </div>
</template>

<style scoped lang="scss">
.about-container {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 32px 24px;
    font-family: inherit;
    background: var(--color-card-bg, var(--color-bg, #fff));
    color: var(--color-fg, #222);
    overflow: auto;

    /* 主题适配：markdown-it 渲染内容字体色，使用 :deep() 穿透 scoped 限制 */
    color: var(--color-fg, #222);
}

.about-bmc {
    text-align: right;
    margin-bottom: 16px;
}
</style>
