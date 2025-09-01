<template>
    <Transition name="notification" appear @enter="onEnter" @leave="onLeave">
        <div
            v-if="visible"
            :class="[
                'notification-item',
                `notification-item--${notification.type}`,
                notification.className,
            ]"
            @mouseenter="onMouseEnter"
            @mouseleave="onMouseLeave"
        >
            <!-- 图标 -->
            <div class="notification-icon">
                <PhCheckCircle v-if="notification.type === 'success'" class="icon icon--success" />
                <PhXCircle v-else-if="notification.type === 'error'" class="icon icon--error" />
                <PhWarning v-else-if="notification.type === 'warning'" class="icon icon--warning" />
                <PhInfo v-else class="icon icon--info" />
            </div>

            <!-- 内容 -->
            <div class="notification-content">
                <div v-if="notification.title" class="notification-title">
                    {{ notification.title }}
                </div>
                <div class="notification-message">{{ notification.message }}</div>

                <!-- 动作按钮 -->
                <div
                    v-if="notification.actions && notification.actions.length > 0"
                    class="notification-actions"
                >
                    <BaseButton
                        v-for="(action, index) in notification.actions"
                        :key="index"
                        :variant="action.type || 'secondary'"
                        size="sm"
                        @click="handleActionClick(action)"
                    >
                        {{ action.text }}
                    </BaseButton>
                </div>
            </div>

            <!-- 关闭按钮 -->
            <button
                v-if="notification.closable"
                class="notification-close"
                @click="handleClose"
                aria-label="关闭通知"
            >
                <PhX class="icon-close" />
            </button>

            <!-- 进度条 -->
            <div
                v-if="notification.duration > 0 && !isPaused"
                class="notification-progress"
                :style="{ animationDuration: `${notification.duration}ms` }"
            />
        </div>
    </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { PhCheckCircle, PhXCircle, PhWarning, PhInfo, PhX } from "@phosphor-icons/vue";
import { BaseButton } from "@renderer/components/ui";
import type { NotificationItem, NotificationAction } from "@renderer/types/notification";

interface Props {
    /** 通知数据 */
    notification: NotificationItem;
}

interface Emits {
    /** 关闭通知事件 */
    (e: "close", id: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 响应式状态
const visible = ref(true);
const isPaused = ref(false);

// 自动关闭定时器
let autoCloseTimer: NodeJS.Timeout | null = null;

/**
 * 处理鼠标进入事件 - 暂停自动关闭
 */
const onMouseEnter = () => {
    if (props.notification.duration > 0) {
        isPaused.value = true;
        if (autoCloseTimer) {
            clearTimeout(autoCloseTimer);
            autoCloseTimer = null;
        }
    }
};

/**
 * 处理鼠标离开事件 - 恢复自动关闭
 */
const onMouseLeave = () => {
    if (props.notification.duration > 0) {
        isPaused.value = false;
        startAutoClose();
    }
};

/**
 * 开始自动关闭倒计时
 */
const startAutoClose = () => {
    if (props.notification.duration > 0 && !autoCloseTimer) {
        autoCloseTimer = setTimeout(() => {
            handleClose();
        }, props.notification.duration);
    }
};

/**
 * 处理关闭事件
 */
const handleClose = () => {
    visible.value = false;
    // 延迟触发关闭事件，等待动画完成
    setTimeout(() => {
        emit("close", props.notification.id);
    }, 300);
};

/**
 * 处理动作按钮点击
 */
const handleActionClick = (action: NotificationAction) => {
    action.onClick();
    // 执行动作后自动关闭通知
    handleClose();
};

/**
 * 进入动画回调
 */
const onEnter = () => {
    // 动画开始后启动自动关闭
    startAutoClose();
};

/**
 * 离开动画回调
 */
const onLeave = () => {
    // 清理定时器
    if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
    }
};

// 组件挂载时启动自动关闭
onMounted(() => {
    startAutoClose();
});

// 组件卸载时清理定时器
onUnmounted(() => {
    if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
    }
});
</script>

<style scoped>
.notification-item {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    margin-bottom: 12px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border-left: 4px solid;
    backdrop-filter: blur(8px);
    background: var(--color-card-bg);
    border-color: var(--color-border);
    color: var(--color-text);
    min-width: 320px;
    max-width: 480px;
    transition: all 0.3s ease;
}

.notification-item:hover {
    transform: translateX(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

/* 通知类型样式 */
.notification-item--success {
    border-left-color: var(--color-success);
}

.notification-item--error {
    border-left-color: var(--color-danger);
}

.notification-item--warning {
    border-left-color: var(--color-warning);
}

.notification-item--info {
    border-left-color: var(--color-info);
}

/* 图标样式 */
.notification-icon {
    flex-shrink: 0;
    margin-top: 2px;
}

.icon {
    width: 20px;
    height: 20px;
}

.icon--success {
    color: var(--color-success);
}

.icon--error {
    color: var(--color-danger);
}

.icon--warning {
    color: var(--color-warning);
}

.icon--info {
    color: var(--color-info);
}

/* 内容样式 */
.notification-content {
    flex: 1;
    min-width: 0;
}

.notification-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    color: var(--color-text);
}

.notification-message {
    font-size: 14px;
    line-height: 1.5;
    color: var(--color-text-secondary);
}

/* 动作按钮样式 */
.notification-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
}

/* 关闭按钮样式 */
.notification-close {
    flex-shrink: 0;
    padding: 4px;
    border-radius: 6px;
    transition: all 0.2s ease;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
}

.notification-close:hover {
    background: var(--color-card-hover);
    color: var(--color-text);
}

.notification-close:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-primary);
}

.icon-close {
    width: 16px;
    height: 16px;
}

/* 进度条样式 */
.notification-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 4px;
    border-radius: 0 0 8px 8px;
    background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light));
    animation: progress-shrink linear forwards;
    width: 100%;
}

@keyframes progress-shrink {
    from {
        width: 100%;
    }
    to {
        width: 0%;
    }
}

/* 动画样式 */
.notification-enter-active {
    transition: all 0.3s ease-out;
}

.notification-leave-active {
    transition: all 0.3s ease-in;
}

.notification-enter-from {
    transform: translateX(100%);
    opacity: 0;
}

.notification-leave-to {
    transform: translateX(100%);
    opacity: 0;
}
</style>
