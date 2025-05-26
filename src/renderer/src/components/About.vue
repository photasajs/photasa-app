<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import LanguageSwitcher from "./LanguageSwitcher.vue";

const { t } = useI18n();

// Accessibility improvements
const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
        // Emit event to parent to handle exit
        emit("exit");
    }
};
</script>

<template>
    <div class="about-container">
        <a-typography
            :style="{
                height: '600px',
                width: '100%',
                overflow: 'auto',
            }"
            role="article"
            aria-label="About Ant Design"
            @keydown="handleKeyPress"
            tabindex="0"
        >
            <!-- English Section -->
            <section aria-labelledby="intro-title-en">
                <a-typography-title id="intro-title-en">{{
                    t("about.introduction.title")
                }}</a-typography-title>
                <a-typography-paragraph>
                    {{ t("about.introduction.content") }}
                </a-typography-paragraph>
                <a-typography-paragraph>
                    {{ t("about.introduction.summary") }}
                    <a-typography-text strong>
                        {{ t("about.introduction.highlight") }}
                    </a-typography-text>
                </a-typography-paragraph>
            </section>

            <section aria-labelledby="resources-title-en">
                <a-typography-title :level="2" id="resources-title-en">
                    {{ t("about.resources.title") }}
                </a-typography-title>
                <a-typography-paragraph>
                    {{ t("about.resources.content") }}
                    <a-typography-text code>Sketch</a-typography-text>
                    {{ t("about.resources.and") }}
                    <a-typography-text code>Axure</a-typography-text>
                </a-typography-paragraph>

                <a-typography-paragraph>
                    <ul>
                        <li>
                            <a-typography-link
                                href="/docs/resources"
                                aria-label="Download design resources"
                            >
                                {{ t("about.resources.download") }}
                            </a-typography-link>
                        </li>
                    </ul>
                </a-typography-paragraph>

                <a-typography-paragraph>
                    {{ t("about.press") }}
                    <a-typography-text keyboard>Esc</a-typography-text>
                    {{ t("about.toExit") }}
                </a-typography-paragraph>
            </section>

            <a-divider />

            <!-- Chinese Section -->
            <section aria-labelledby="intro-title-cn">
                <a-typography-title id="intro-title-cn">{{
                    t("about.introduction.title")
                }}</a-typography-title>
                <a-typography-paragraph>
                    {{ t("about.introduction.content") }}
                </a-typography-paragraph>
                <a-typography-paragraph>
                    {{ t("about.introduction.summary") }}
                    <a-typography-text mark>{{
                        t("about.introduction.highlight")
                    }}</a-typography-text>
                    {{ t("about.introduction.focus") }}
                    <a-typography-text strong>{{
                        t("about.introduction.userExperience")
                    }}</a-typography-text>
                </a-typography-paragraph>
            </section>

            <section aria-labelledby="resources-title-cn">
                <a-typography-title :level="2" id="resources-title-cn">
                    {{ t("about.resources.title") }}
                </a-typography-title>
                <a-typography-paragraph>
                    {{ t("about.resources.content") }}
                    <a-typography-text code>Sketch</a-typography-text>
                    {{ t("about.resources.and") }}
                    <a-typography-text code>Axure</a-typography-text>
                </a-typography-paragraph>

                <a-typography-paragraph>
                    <ul>
                        <li>
                            <a-typography-link href="/docs/resources-cn" aria-label="下载设计资源">
                                {{ t("about.resources.download") }}
                            </a-typography-link>
                        </li>
                    </ul>
                </a-typography-paragraph>

                <a-typography-paragraph>
                    <blockquote>{{ t("about.antvDescription") }}</blockquote>
                    <pre>{{ t("about.antvDescription") }}</pre>
                </a-typography-paragraph>

                <a-typography-paragraph>
                    {{ t("about.press") }}
                    <a-typography-text keyboard>Esc</a-typography-text>
                    {{ t("about.toExit") }}
                </a-typography-paragraph>
            </section>
        </a-typography>
    </div>
</template>

<style scoped>
.about-container {
    position: relative;
    width: 100%;
    height: 100%;
}

.language-switcher-container {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 1;
}

section {
    margin-bottom: 2rem;
}

/* Add smooth scrolling */
:deep(.ant-typography) {
    scroll-behavior: smooth;
}

/* Improve focus styles for accessibility */
:deep(.ant-typography:focus) {
    outline: 2px solid #1890ff;
    outline-offset: 2px;
}
</style>
