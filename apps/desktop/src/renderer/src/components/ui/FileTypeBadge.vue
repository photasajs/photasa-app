<template>
    <div
        class="file-type-badge"
        :class="[`file-type-badge--${size}`, `file-type-badge--${fileType.category}`]"
        :title="tooltipText"
    >
        <ImageIcon v-if="fileType.icon === 'ImageIcon'" :size="iconSize" />
        <VideoIcon v-else-if="fileType.icon === 'VideoIcon'" :size="iconSize" />
        <RawIcon v-else-if="fileType.icon === 'RawIcon'" :size="iconSize" />
        <AiIcon v-else-if="fileType.icon === 'AiIcon'" :size="iconSize" />
        <FileIcon v-else :size="iconSize" />
        <span v-if="showFormat" class="file-type-badge__format">
            {{ fileType.format }}
        </span>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
    PhImage as ImageIcon,
    PhVideo as VideoIcon,
    PhFile as FileIcon,
    PhCamera as RawIcon,
    PhPaintBrush as AiIcon,
} from "@phosphor-icons/vue";

interface Props {
    filePath: string;
    isVideo: boolean;
    showFormat?: boolean;
    size?: "small" | "medium" | "large";
}

const props = withDefaults(defineProps<Props>(), {
    showFormat: true,
    size: "medium",
});

// 文件类型检测（直接使用现有逻辑）
const isImage = computed(() => {
    const ext = props.filePath.toLowerCase().split(".").pop();
    return ["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif"].includes(ext || "");
});

const isRaw = computed(() => {
    const ext = props.filePath.toLowerCase().split(".").pop();
    return ["raf", "cr2", "arw", "dng"].includes(ext || "");
});

const isAi = computed(() => {
    const ext = props.filePath.toLowerCase().split(".").pop();
    return ["ai", "psd", "sketch", "figma", "xd"].includes(ext || "");
});

// 文件类型信息
const fileType = computed(() => {
    const ext = props.filePath.toLowerCase().split(".").pop() || "";

    if (isImage.value) {
        return {
            category: "image",
            icon: "ImageIcon",
            format: ext.toUpperCase(),
        };
    } else if (props.isVideo) {
        return {
            category: "video",
            icon: "VideoIcon",
            format: ext.toUpperCase(),
        };
    } else if (isRaw.value) {
        return {
            category: "raw",
            icon: "RawIcon",
            format: ext.toUpperCase(),
        };
    } else if (isAi.value) {
        return {
            category: "ai",
            icon: "AiIcon",
            format: ext.toUpperCase(),
        };
    } else {
        return {
            category: "other",
            icon: "FileIcon",
            format: ext.toUpperCase(),
        };
    }
});

// 图标尺寸
const iconSize = computed(() => {
    switch (props.size) {
        case "small":
            return 12;
        case "large":
            return 20;
        default:
            return 16;
    }
});

// 工具提示文本
const tooltipText = computed(() => {
    return `${fileType.value.format} 文件`;
});
</script>

<style scoped lang="scss">
.file-type-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    color: white;
    user-select: none;
    pointer-events: none;
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 10;
    backdrop-filter: blur(4px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);

    // 尺寸变体
    &--small {
        padding: 1px 4px;
        font-size: 9px;
        gap: 2px;
    }

    &--medium {
        padding: 2px 6px;
        font-size: 10px;
        gap: 4px;
    }

    &--large {
        padding: 3px 8px;
        font-size: 11px;
        gap: 6px;
    }

    // 文件类型颜色
    &--image {
        background: rgba(34, 197, 94, 0.9);
    }

    &--video {
        background: rgba(59, 130, 246, 0.9);
    }

    &--raw {
        background: rgba(168, 85, 247, 0.9);
    }

    &--ai {
        background: rgba(245, 158, 11, 0.9);
    }

    &--other {
        background: rgba(107, 114, 128, 0.9);
    }

    &__format {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
    }
}

// 响应式设计
@media (max-width: 768px) {
    .file-type-badge {
        &--small {
            font-size: 8px;
            padding: 1px 3px;
        }

        &--medium {
            font-size: 9px;
            padding: 2px 4px;
        }

        &--large {
            font-size: 10px;
            padding: 3px 6px;
        }
    }
}
</style>
