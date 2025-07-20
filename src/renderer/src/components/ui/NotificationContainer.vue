<template>
    <Teleport to="body">
        <div class="notification-container">
            <TransitionGroup name="notification-list" tag="div" class="notification-list">
                <BaseNotification
                    v-for="notification in notifications"
                    :key="notification.id"
                    :notification="notification"
                    @close="handleClose"
                />
            </TransitionGroup>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BaseNotification from "./BaseNotification.vue";
import { useNotificationStore } from "@renderer/stores/notification";

// 使用通知状态管理
const notificationStore = useNotificationStore();

// 获取当前显示的通知列表
const notifications = computed(() => notificationStore.notifications);

/**
 * 处理通知关闭事件
 */
const handleClose = (id: string) => {
    notificationStore.remove(id);
};
</script>

<style scoped>
.notification-container {
    @apply fixed top-4 right-4 pointer-events-none;
    z-index: 99999;
    max-height: calc(100vh - 2rem);
    overflow: hidden;
}

.notification-list {
    @apply flex flex-col-reverse;
    pointer-events: auto;
}

/* 列表动画样式 */
.notification-list-enter-active {
    transition: all 0.3s ease-out;
}

.notification-list-leave-active {
    transition: all 0.3s ease-in;
}

.notification-list-enter-from {
    transform: translateX(100%);
    opacity: 0;
}

.notification-list-leave-to {
    transform: translateX(100%);
    opacity: 0;
}

.notification-list-move {
    transition: transform 0.3s ease;
}

/* 响应式设计 */
@media (max-width: 640px) {
    .notification-container {
        @apply left-4 right-4 top-4;
    }
}
</style>
