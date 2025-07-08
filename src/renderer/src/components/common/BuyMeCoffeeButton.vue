<script setup lang="ts">
import bmcButton from "@renderer/assets/bmc-button.png";

const props = defineProps<{ height?: string }>();
const height = props.height || "28px";

function openBuyMeCoffee() {
    window.api.openExternal("https://www.buymeacoffee.com/PpVB0uO");
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
