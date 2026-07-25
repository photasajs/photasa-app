<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { PhArrowsClockwise, PhFolderOpen, PhInfo } from "@phosphor-icons/vue";
import type { Image } from "@renderer/common/image";
import { BaseImage, BaseTooltip, BaseCard } from "@renderer/components/ui";
import {
    getThumbnailDisplaySrc,
    getThumbnailRenderKey,
    thumbnailDisplayEpoch,
} from "@renderer/utils/thumbnail-display";
import {
    IMAGE_HOVER_ACTION,
    IMAGE_HOVER_I18N_KEY,
    IMAGE_HOVER_TEST_ID,
    type ImageHoverActionId,
} from "./image-list-hover-actions";

const props = defineProps<{
    image: Image;
    thumbnailSize: number;
    fallback: string;
    mouseEnterDelay: number;
    rebuildThumbnail: (image: Image) => Promise<void>;
}>();

const emit = defineEmits<{
    preview: [];
    openMeta: [];
    openInFolder: [];
}>();

const { t } = useI18n();
const isHovered = ref(false);
const isRebuilding = ref(false);

const hoverActions = [
    { id: IMAGE_HOVER_ACTION.DETAIL, icon: PhInfo },
    { id: IMAGE_HOVER_ACTION.REBUILD, icon: PhArrowsClockwise },
    { id: IMAGE_HOVER_ACTION.OPEN_IN_FINDER, icon: PhFolderOpen },
] as const;

function handlePreviewClick(): void {
    emit("preview");
}

async function handleHoverAction(event: MouseEvent, actionId: ImageHoverActionId): Promise<void> {
    event.stopPropagation();

    if (actionId === IMAGE_HOVER_ACTION.DETAIL) {
        emit("openMeta");
        return;
    }

    if (actionId === IMAGE_HOVER_ACTION.OPEN_IN_FINDER) {
        emit("openInFolder");
        return;
    }

    if (isRebuilding.value) {
        return;
    }

    isRebuilding.value = true;
    try {
        await props.rebuildThumbnail(props.image);
    } finally {
        isRebuilding.value = false;
    }
}

function isActionSpinning(actionId: ImageHoverActionId): boolean {
    return actionId === IMAGE_HOVER_ACTION.REBUILD && isRebuilding.value;
}

function isActionDisabled(actionId: ImageHoverActionId): boolean {
    return actionId === IMAGE_HOVER_ACTION.REBUILD && isRebuilding.value;
}
</script>

<template>
    <div
        class="image-list-item"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
        @click="handlePreviewClick"
    >
        <BaseTooltip placement="right" :mouse-enter-delay="mouseEnterDelay" :title="image.raw">
            <BaseCard
                hoverable
                :bodyPadding="false"
                :style="{
                    height: thumbnailSize + 'px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--color-image-item-bg)',
                    padding: 0,
                    minWidth: thumbnailSize + 'px',
                }"
            >
                <BaseImage
                    :key="`${thumbnailDisplayEpoch}-${getThumbnailRenderKey(image)}`"
                    :width="thumbnailSize"
                    :height="thumbnailSize"
                    :src="getThumbnailDisplaySrc(image)"
                    :fallback="fallback"
                    :raw="image.raw"
                    :is-video="image.isVideo"
                />

                <Transition name="image-hover-bar">
                    <div
                        v-show="isHovered"
                        class="image-hover-bar"
                        data-testid="image-hover-bar"
                        @click.stop
                    >
                        <BaseTooltip
                            v-for="action in hoverActions"
                            :key="action.id"
                            placement="top"
                            :mouse-enter-delay="0.3"
                            :title="t(IMAGE_HOVER_I18N_KEY[action.id])"
                        >
                            <button
                                type="button"
                                class="image-hover-bar__button"
                                :disabled="isActionDisabled(action.id)"
                                :aria-label="t(IMAGE_HOVER_I18N_KEY[action.id])"
                                :data-testid="IMAGE_HOVER_TEST_ID[action.id]"
                                @click="handleHoverAction($event, action.id)"
                            >
                                <component
                                    :is="action.icon"
                                    :size="16"
                                    weight="bold"
                                    :class="{
                                        'image-hover-bar__icon--spinning': isActionSpinning(
                                            action.id,
                                        ),
                                    }"
                                />
                            </button>
                        </BaseTooltip>
                    </div>
                </Transition>
            </BaseCard>
        </BaseTooltip>
    </div>
</template>

<style scoped lang="scss">
.image-list-item {
    position: relative;
}

.image-hover-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: linear-gradient(
        180deg,
        transparent 0%,
        var(--color-image-hover-bar-overlay-mid) 40%,
        var(--color-image-hover-bar-overlay-end) 100%
    );
    box-shadow: 0 -6px 20px var(--color-image-hover-bar-shadow);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    pointer-events: auto;
}

.image-hover-bar__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    min-width: 28px;
    min-height: 28px;
    padding: 4px;
    border: 1px solid var(--color-image-hover-bar-button-border);
    border-radius: var(--radius-sm);
    background: var(--color-image-hover-bar-button-bg);
    color: var(--color-image-hover-bar-button-text);
    cursor: pointer;
    transition: var(--transition-modern-fast);

    &:hover:not(:disabled) {
        background: var(--color-image-hover-bar-button-hover-bg);
        border-color: var(--color-image-hover-bar-button-hover-border);
        color: var(--color-image-hover-bar-button-text);
        box-shadow: 0 2px 8px var(--color-image-hover-bar-shadow);
    }

    &:disabled {
        opacity: 0.6;
        cursor: wait;
    }
}

.image-hover-bar__icon--spinning {
    animation: image-hover-bar-spin 0.9s linear infinite;
}

.image-hover-bar-enter-active,
.image-hover-bar-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
}

.image-hover-bar-enter-from,
.image-hover-bar-leave-to {
    opacity: 0;
    transform: translateY(4px);
}

@keyframes image-hover-bar-spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}
</style>
