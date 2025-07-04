<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Vue3MarkdownIt from "vue3-markdown-it";

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
    <div class="about-container" tabindex="0" @keydown="handleKeyPress">
        <vue3-markdown-it :source="t('about.markdown')" />
    </div>
</template>

<style scoped>
.about-container {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 32px 24px;
    font-family: inherit;
    background: #fff;
    color: #222;
    overflow: auto;
}

h1 {
    font-size: 2rem;
    margin-bottom: 1rem;
}

h2 {
    font-size: 1.25rem;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
}

p {
    margin-bottom: 1rem;
    line-height: 1.7;
}

ul {
    margin: 0 0 1rem 1.5rem;
    padding: 0;
}

li {
    margin-bottom: 0.5rem;
}

code {
    background: #f5f5f5;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 0.95em;
}

kbd {
    background: #eee;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 0.95em;
    font-family: inherit;
}

strong {
    font-weight: bold;
    color: #1890ff;
}
</style>
