<template>
    <div class="spin-container" :class="{ 'spin-container-spinning': spinning }">
        <!-- Spinner overlay -->
        <div v-if="spinning" class="spin-overlay" :class="`spin-size-${size}`">
            <div class="spin-content">
                <div class="spin-dot" :class="`spin-dot-${size}`">
                    <i class="spin-dot-item"></i>
                    <i class="spin-dot-item"></i>
                    <i class="spin-dot-item"></i>
                    <i class="spin-dot-item"></i>
                </div>
                <div v-if="tip" class="spin-tip">{{ tip }}</div>
            </div>
        </div>

        <!-- Content -->
        <div class="spin-blur" :class="{ 'spin-blur-active': spinning }">
            <slot></slot>
        </div>
    </div>
</template>

<script setup lang="ts">
interface BaseSpinContainerProps {
    spinning: boolean;
    size?: "small" | "default" | "large";
    tip?: string;
}

withDefaults(defineProps<BaseSpinContainerProps>(), {
    size: "default",
});
</script>

<style scoped>
.spin-container {
    position: relative;
    transition: var(--transition-modern-slow);
    border-radius: 12px;
    overflow: hidden;
}

.spin-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
        135deg,
        var(--color-bg, rgba(255, 255, 255, 0.95)) 0%,
        var(--color-bg-secondary, rgba(250, 250, 250, 0.98)) 100%
    );
    backdrop-filter: blur(12px) saturate(180%);
    -webkit-backdrop-filter: blur(12px) saturate(180%);
    border-radius: 12px;
    animation: overlaySlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.spin-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
    border-radius: 16px;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.4) 100%);
    box-shadow:
        var(--shadow-modern-lg),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    position: relative;
    overflow: hidden;
    transform: translateY(0);
    animation: contentFloat 2s ease-in-out infinite alternate;
}

.spin-content::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.3) 50%,
        transparent 100%
    );
    animation: shimmer 2s infinite;
    pointer-events: none;
}

.spin-blur {
    transition: var(--transition-modern-slow);
    border-radius: 12px;
}

.spin-blur-active {
    opacity: 0.4;
    pointer-events: none;
    transform: scale(0.98);
    filter: blur(1px) grayscale(0.2);
}

.spin-tip {
    margin-top: 16px;
    color: var(--color-text-secondary, rgba(0, 0, 0, 0.65));
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.02em;
    background: linear-gradient(
        135deg,
        var(--color-text-secondary) 0%,
        var(--color-primary, #1890ff) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    animation: tipPulse 2s ease-in-out infinite;
}

/* Spinner dot animation */
.spin-dot {
    position: relative;
    display: inline-block;
    transform: rotate(45deg);
    animation: spin-rotate 1.8s infinite linear;
    filter: drop-shadow(0 4px 8px rgba(24, 144, 255, 0.3));
}

.spin-dot-small {
    width: 16px;
    height: 16px;
}

.spin-dot-default {
    width: 24px;
    height: 24px;
}

.spin-dot-large {
    width: 40px;
    height: 40px;
}

.spin-dot-item {
    position: absolute;
    background: linear-gradient(
        135deg,
        var(--color-primary, #1890ff) 0%,
        var(--color-primary-dark, #096dd9) 100%
    );
    border-radius: 50%;
    animation: spin-move 1.5s infinite ease-in-out alternate;
    opacity: 0.2;
    box-shadow:
        0 2px 8px rgba(24, 144, 255, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
    transition: var(--transition-modern);
}

.spin-dot-small .spin-dot-item {
    width: 7px;
    height: 7px;
}

.spin-dot-default .spin-dot-item {
    width: 10px;
    height: 10px;
}

.spin-dot-large .spin-dot-item {
    width: 16px;
    height: 16px;
}

.spin-dot-item:nth-child(1) {
    top: 0;
    left: 0;
}

.spin-dot-item:nth-child(2) {
    top: 0;
    right: 0;
    animation-delay: 0.4s;
}

.spin-dot-item:nth-child(3) {
    bottom: 0;
    right: 0;
    animation-delay: 0.8s;
}

.spin-dot-item:nth-child(4) {
    bottom: 0;
    left: 0;
    animation-delay: 1.2s;
}

/* Small size adjustments */
.spin-size-small .spin-tip {
    font-size: 12px;
}

/* Large size adjustments */
.spin-size-large .spin-tip {
    font-size: 16px;
    margin-top: 12px;
}

/* Enhanced Animations */
@keyframes spin-rotate {
    from {
        transform: rotate(45deg);
    }
    to {
        transform: rotate(405deg);
    }
}

@keyframes spin-move {
    from {
        opacity: 0.2;
        transform: scale(0.8);
    }
    to {
        opacity: 1;
        transform: scale(1.1);
    }
}

@keyframes overlaySlideIn {
    from {
        opacity: 0;
        backdrop-filter: blur(0px);
        -webkit-backdrop-filter: blur(0px);
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        backdrop-filter: blur(12px) saturate(180%);
        -webkit-backdrop-filter: blur(12px) saturate(180%);
        transform: scale(1);
    }
}

@keyframes contentFloat {
    from {
        transform: translateY(-2px);
    }
    to {
        transform: translateY(2px);
    }
}

@keyframes tipPulse {
    0%,
    100% {
        opacity: 0.7;
        transform: scale(1);
    }
    50% {
        opacity: 1;
        transform: scale(1.02);
    }
}

@keyframes shimmer {
    0% {
        left: -100%;
    }
    100% {
        left: 100%;
    }
}

/* When container is spinning */
.spin-container-spinning {
    overflow: hidden;
    transform: translateZ(0); /* Hardware acceleration */
}
</style>
