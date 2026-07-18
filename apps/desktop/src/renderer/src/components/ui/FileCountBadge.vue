<template>
    <div class="file-count-badge" :class="{ loading: isLoading }" :title="tooltipText">
        <div v-if="isLoading" class="loading-state">
            <div class="spinner" />
            <span class="loading-text">{{ $t("common.counting") }}</span>
        </div>

        <div v-else class="count-display">
            <!-- Total count (always visible) -->
            <div class="total-count">
                <svg class="count-icon" viewBox="0 0 16 16" fill="currentColor">
                    <path
                        d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V2.5ZM3.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-9Z"
                    />
                    <path
                        d="M5 4.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5ZM5 6.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5ZM5 8.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5Z"
                    />
                </svg>
                <span class="count-number">{{ formattedTotalCount }}</span>
                <span class="count-label">{{ totalLabel }}</span>
            </div>

            <!-- Detailed breakdown (when both types present) -->
            <div v-if="showBreakdown" class="count-breakdown">
                <div class="count-item image">
                    <svg class="count-icon" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                        <path
                            d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"
                        />
                    </svg>
                    <span class="count-number">{{ formattedImageCount }}</span>
                </div>
                <div class="count-separator">·</div>
                <div class="count-item video">
                    <svg class="count-icon" viewBox="0 0 16 16" fill="currentColor">
                        <path
                            d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z"
                        />
                        <path
                            d="M10.5 8.5a.5.5 0 0 1-.5-.5V5.5a.5.5 0 0 1 .8-.4l2.4 1.8a.5.5 0 0 1 0 .8l-2.4 1.8a.5.5 0 0 1-.8-.4V8.5Z"
                        />
                    </svg>
                    <span class="count-number">{{ formattedVideoCount }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
    imageCount: number;
    videoCount: number;
    isLoading?: boolean;
    showBreakdown?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
    showBreakdown: true,
});

const { t } = useI18n();

// Computed properties
const totalCount = computed(() => props.imageCount + props.videoCount);

const showBreakdown = computed(() => {
    return props.showBreakdown && totalCount.value > 0;
});

// Format large numbers with K/M suffixes
const formatCount = (count: number): string => {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
};

const formattedTotalCount = computed(() => formatCount(totalCount.value));
const formattedImageCount = computed(() => formatCount(props.imageCount));
const formattedVideoCount = computed(() => formatCount(props.videoCount));

// Labels with proper pluralization
const totalLabel = computed(() => {
    if (totalCount.value === 0) return "";
    if (totalCount.value === 1) return t("common.file");
    return t("common.files");
});

// Tooltip text with detailed information
const tooltipText = computed(() => {
    if (props.isLoading) return t("common.counting");

    if (totalCount.value === 0) {
        return t("imageList.fileCount.empty");
    }

    if (props.imageCount > 0 && props.videoCount > 0) {
        return t("imageList.fileCount.mixed", {
            images: props.imageCount,
            videos: props.videoCount,
        });
    }

    if (props.imageCount > 0) {
        return t("imageList.fileCount.images", { count: props.imageCount });
    }

    if (props.videoCount > 0) {
        return t("imageList.fileCount.videos", { count: props.videoCount });
    }

    return t("imageList.fileCount.total", { count: totalCount.value });
});
</script>

<style scoped lang="scss">
.file-count-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    font-size: 12px;
    color: var(--color-text-secondary);
    user-select: none;
    transition: all 0.2s ease;

    &:hover {
        background: var(--color-bg-tertiary);
        border-color: var(--color-border-hover);
    }

    &.loading {
        opacity: 0.7;
    }

    .loading-state {
        display: flex;
        align-items: center;
        gap: 6px;

        .spinner {
            width: 12px;
            height: 12px;
            border: 2px solid var(--color-border);
            border-top: 2px solid var(--color-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        .loading-text {
            font-size: 11px;
            font-style: italic;
        }
    }

    .count-display {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .total-count {
        display: flex;
        align-items: center;
        gap: 3px;
        font-weight: 500;
        color: var(--color-text-primary);

        .count-number {
            font-weight: 600;
            font-variant-numeric: tabular-nums;
        }

        .count-label {
            font-weight: normal;
            opacity: 0.8;
        }
    }

    .count-breakdown {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        padding-left: 8px;
        border-left: 1px solid var(--color-border);
    }

    .count-item {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 1px 3px;
        border-radius: 3px;

        &.image {
            color: var(--color-success);
            background: var(--color-success-bg, rgba(34, 197, 94, 0.1));
        }

        &.video {
            color: var(--color-info);
            background: var(--color-info-bg, rgba(59, 130, 246, 0.1));
        }

        .count-number {
            font-weight: 500;
            font-variant-numeric: tabular-nums;
        }
    }

    .count-separator {
        color: var(--color-text-tertiary);
        opacity: 0.5;
    }

    .count-icon {
        width: 12px;
        height: 12px;
        flex-shrink: 0;
    }
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

// Responsive design
@media (max-width: 768px) {
    .file-count-badge {
        font-size: 11px;
        padding: 3px 6px;
        gap: 6px;

        .count-breakdown {
            display: none; // Hide detailed breakdown on mobile
        }

        .total-count .count-label {
            display: none; // Show only numbers on mobile
        }
    }
}

@media (max-width: 480px) {
    .file-count-badge {
        font-size: 10px;
        padding: 2px 4px;

        .count-icon {
            width: 10px;
            height: 10px;
        }
    }
}
</style>
