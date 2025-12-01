<script setup lang="ts">
import bmcButton from "@renderer/assets/bmc-button.png";
import { EventNames } from "@renderer/constants/event-names";
import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";

const props = defineProps<{ height?: string }>();
const height = props.height || "28px";

// ✅ RFC 0058: 直接使用 DOM 事件，完全解耦 UI 和服务层
function openBuyMeCoffee() {
    const event = new CustomEvent(EventNames.BAIXING_SHANGSHU, {
        detail: { action: QizouMatters.OPEN_EXTERNAL, url: "https://www.buymeacoffee.com/PpVB0uO" },
        bubbles: true,
        cancelable: true,
    });
    window.dispatchEvent(event);
}
</script>
<template>
    <a href="#" @click.prevent="openBuyMeCoffee">
        <img :src="bmcButton" alt="Buy me a coffee" :style="{ height, display: 'block' }" />
    </a>
</template>
<style scoped>
:root {
    display: block;
    --bmc-button-height: 28px;
}
.bmc-button {
    display: block;
    height: var(--bmc-button-height);
}
</style>
