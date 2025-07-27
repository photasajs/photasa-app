<!--
  Portal Provider Component

  提供标准化的Portal目标容器，用于在应用中安全地渲染下拉菜单、弹出框等
  需要突破父容器限制的UI元素。

  功能：
  - 提供多个命名的Portal目标
  - 自动管理z-index层级
  - 统一的Portal目标管理

  使用方式：
  1. 在App.vue中引入并使用此组件
  2. 在子组件中使用 <Teleport to="#portal-dropdown"> 等方式传送内容
-->

<template>
    <!-- 下拉菜单专用Portal目标 -->
    <div
        id="portal-dropdown"
        class="portal-target portal-dropdown"
        data-portal-type="dropdown"
    ></div>

    <!-- 弹出框专用Portal目标 -->
    <div id="portal-popover" class="portal-target portal-popover" data-portal-type="popover"></div>

    <!-- 通用Portal目标 -->
    <div id="portal-general" class="portal-target portal-general" data-portal-type="general"></div>
</template>

<script setup lang="ts">
import { getLogger } from "@common/logger";

const logger = getLogger("portal-provider");

// 组件挂载时记录日志
logger.debug(
    "PortalProvider mounted, providing portal targets for dropdowns, popovers, and general use",
);
</script>

<style scoped>
/* Portal目标容器的基础样式 */
.portal-target {
    /* 绝对定位，不占用文档流空间 */
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none; /* 目标容器本身不响应鼠标事件 */
    z-index: 9999; /* 默认高层级 */
}

/* 下拉菜单Portal目标 */
.portal-dropdown {
    z-index: 10000; /* 下拉菜单需要更高的层级 */
}

/* 弹出框Portal目标 */
.portal-popover {
    z-index: 10500; /* 弹出框层级更高 */
}

/* 通用Portal目标 */
.portal-general {
    z-index: 9500; /* 通用目标较低层级 */
}

/* Portal目标中的内容恢复鼠标事件响应 */
.portal-target > * {
    pointer-events: auto;
}
</style>
