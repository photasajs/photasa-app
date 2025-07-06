<template>
    <div ref="host"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, type PropType } from "vue";

interface ThemeColors {
    background: string;
    text: string;
    border: string;
    [key: string]: string;
}

const props = defineProps({
    colors: {
        type: Object as PropType<ThemeColors>,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
});

const host = ref<HTMLElement | null>(null);
let shadow: ShadowRoot | null = null;

function renderShadow() {
    if (!shadow) return;
    // 构建隔离样式
    const style = `
    .preview-box {
      background: ${props.colors.background};
      color: ${props.colors.text};
      border: 1.5px solid ${props.colors.border};
      border-radius: 8px;
      min-width: 120px;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 1rem;
      margin-bottom: 8px;
      text-align: center;
    }
    .desc {
      font-size: 0.9em;
      color: ${props.colors.text};
      opacity: 0.8;
      text-align: center;
    }
  `;
    shadow.innerHTML = `
    <style>${style}</style>
    <div class="preview-box">${props.name}</div>
    <div class="desc">${props.description}</div>
  `;
}

onMounted(() => {
    if (host.value) {
        shadow = host.value.attachShadow({ mode: "open" });
        renderShadow();
    }
});

watch(() => [props.colors, props.name, props.description], renderShadow, { deep: true });
</script>
