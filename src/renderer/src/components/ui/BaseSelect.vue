<template>
    <div class="base-select" ref="containerRef">
        <!-- ComboBox Button -->
        <button
            ref="buttonRef"
            type="button"
            role="combobox"
            :disabled="disabled"
            :aria-expanded="isOpen"
            :aria-haspopup="'listbox'"
            :aria-controls="isOpen ? listboxId : undefined"
            :aria-activedescendant="
                isOpen && highlightedIndex >= 0
                    ? `${listboxId}-option-${highlightedIndex}`
                    : undefined
            "
            :aria-labelledby="labelId"
            @click="toggleDropdown"
            @keydown="handleComboboxKeydown"
            @blur="handleBlur"
            :class="[
                'relative w-full cursor-default rounded-md border py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none sm:text-sm',
                'bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text)]',
                'hover:border-[var(--color-primary)] focus:border-[var(--color-primary)]',
                disabled && 'opacity-50 cursor-not-allowed',
            ]"
        >
            <span class="block truncate">
                {{ selectedOption?.label || placeholder }}
            </span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <PhCaretDown
                    :class="[
                        'h-5 w-5 text-[var(--color-text-secondary)] transition-transform duration-200',
                        isOpen && 'rotate-180',
                    ]"
                    aria-hidden="true"
                />
            </span>
        </button>

        <!-- Portal Listbox -->
        <Teleport to="#portal-dropdown">
            <transition
                name="dropdown"
                @enter="onDropdownEnter"
                @leave="onDropdownLeave"
                @after-enter="onDropdownAfterEnter"
            >
                <div
                    v-if="isOpen"
                    ref="dropdownRef"
                    :id="listboxId"
                    :style="dropdownStyles"
                    class="base-select-dropdown fixed z-[10000]"
                    role="listbox"
                    :aria-labelledby="labelId"
                    :aria-multiselectable="false"
                    tabindex="-1"
                    @keydown="handleListboxKeydown"
                    @mousedown.stop
                >
                    <ul
                        :class="[
                            'max-h-60 rounded-md py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm',
                            'bg-[var(--color-card-bg)] border border-[var(--color-border)]',
                            options.length > 6 ? 'overflow-y-auto' : 'overflow-hidden',
                        ]"
                    >
                        <li
                            v-for="(option, index) in options"
                            :key="option.value"
                            :id="`${listboxId}-option-${index}`"
                            role="option"
                            :aria-selected="option.value === modelValue"
                            :data-highlighted="highlightedIndex === index"
                            @click="handleOptionClick(option, index)"
                            @mouseenter="handleMouseEnter(index)"
                            @mouseleave="handleMouseLeave"
                            :class="[
                                highlightedIndex === index
                                    ? 'bg-[var(--color-primary)] text-[var(--color-white)]'
                                    : option.value === modelValue
                                      ? 'bg-[var(--color-card-hover)] text-[var(--color-text)]'
                                      : 'text-[var(--color-text)]',
                                'relative cursor-pointer select-none py-2 pl-10 pr-4 transition-colors duration-150',
                                'hover:bg-[var(--color-primary)] hover:text-[var(--color-white)]',
                            ]"
                        >
                            <span
                                :class="[
                                    option.value === modelValue ? 'font-semibold' : 'font-normal',
                                    'block whitespace-nowrap',
                                ]"
                            >
                                {{ option.label }}
                            </span>
                            <span
                                v-if="option.value === modelValue"
                                class="absolute inset-y-0 left-0 flex items-center pl-3"
                                :class="[
                                    highlightedIndex === index
                                        ? 'text-[var(--color-white)]'
                                        : 'text-[var(--color-primary)]',
                                ]"
                            >
                                <PhCheck class="h-5 w-5" aria-hidden="true" />
                            </span>
                        </li>
                    </ul>
                </div>
            </transition>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch, onBeforeUnmount } from "vue";
import { PhCheck, PhCaretDown } from "@phosphor-icons/vue";
import { getLogger } from "@common/logger";
import { useDropdownManager } from "@renderer/composables/useDropdownManager";

const logger = getLogger("base-select");

// 下拉管理器
const dropdownManager = useDropdownManager();

interface Option {
    value: string | number;
    label: string;
}

interface Props {
    modelValue: string | number | null;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: "Select an option",
    disabled: false,
});

const emit = defineEmits<{
    "update:modelValue": [value: string | number | null];
}>();

// Refs
const containerRef = ref<HTMLElement>();
const buttonRef = ref<HTMLElement>();
const dropdownRef = ref<HTMLElement>();

// State
const isOpen = ref(false);
const highlightedIndex = ref(-1);
const dropdownStyles = ref<Record<string, string>>({});

// 为每个组件实例生成唯一ID
const dropdownId = `dropdown-${Math.random().toString(36).substring(2, 11)}`;

// Computed
const selectedOption = computed(() => {
    return props.options.find((option) => option.value === props.modelValue);
});

const labelId = computed(() => `base-select-${Math.random().toString(36).substring(2, 11)}`);
const listboxId = computed(() => `${labelId.value}-listbox`);

/**
 * 更新下拉菜单位置
 */
const updateDropdownPosition = () => {
    if (!buttonRef.value) {
        logger.warn("Button ref not available for positioning");
        return;
    }

    const buttonRect = buttonRef.value.getBoundingClientRect();

    // 计算实际的下拉菜单高度
    const estimatedItemHeight = 40; // 每个选项的估算高度
    const actualDropdownHeight = Math.min(props.options.length * estimatedItemHeight + 16, 240); // 实际高度，最大240px

    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;

    // 计算下拉框的最小宽度，基于内容和按钮宽度
    const calculateDropdownWidth = () => {
        // 获取最长选项的估算宽度
        const longestLabel = props.options.reduce(
            (longest, option) => (option.label.length > longest.length ? option.label : longest),
            "",
        );

        // 估算文本宽度（中文字符约14px，英文字符约8px，加上padding和图标空间）
        const isChinese = /[\u4e00-\u9fa5]/.test(longestLabel);
        const avgCharWidth = isChinese ? 14 : 9; // 中文字符更宽
        const estimatedTextWidth = longestLabel.length * avgCharWidth + 70; // 70px用于padding和图标空间

        // 下拉框宽度至少与按钮相同，但可以更宽以适应内容
        // 增加最小宽度确保有足够空间
        return Math.max(buttonRect.width + 20, Math.min(estimatedTextWidth, 400)); // 最大400px，最小比按钮宽20px
    };

    const dropdownWidth = calculateDropdownWidth();

    // 确保下拉菜单在视口内，考虑新的宽度
    const left = Math.max(8, Math.min(buttonRect.left, window.innerWidth - dropdownWidth - 8));

    // 优先向下展开，空间不足时向上
    let top: number;
    if (spaceBelow >= actualDropdownHeight + 8) {
        // 向下展开：按钮底部 + 4px
        top = buttonRect.bottom + 4;
    } else if (spaceAbove >= actualDropdownHeight + 8) {
        // 向上展开：按钮顶部 - 下拉菜单高度 - 4px
        top = buttonRect.top - actualDropdownHeight - 4;
    } else {
        // 空间都不足，选择空间更大的方向
        if (spaceBelow > spaceAbove) {
            top = buttonRect.bottom + 4;
        } else {
            top = buttonRect.top - actualDropdownHeight - 4;
        }
    }

    dropdownStyles.value = {
        left: `${left}px`,
        top: `${top}px`,
        width: `${dropdownWidth}px`,
        zIndex: "10000",
    };

    // 位置更新完成
};

/**
 * 打开下拉菜单
 */
const openDropdown = () => {
    if (props.disabled || isOpen.value) return;

    // 通知下拉管理器此下拉菜单即将打开（会自动关闭其他下拉菜单）
    dropdownManager.open(dropdownId);

    isOpen.value = true;

    nextTick(() => {
        updateDropdownPosition();
        // 高亮当前选中的选项，如果没有则高亮第一个
        const currentIndex = props.options.findIndex((option) => option.value === props.modelValue);
        highlightedIndex.value = currentIndex >= 0 ? currentIndex : 0;
    });
};

/**
 * 切换下拉菜单状态
 */
const toggleDropdown = () => {
    if (props.disabled) return;

    if (isOpen.value) {
        closeDropdown();
    } else {
        openDropdown();
    }
};

/**
 * 选择选项
 */
const selectOption = (option: Option, index?: number) => {
    if (props.disabled) {
        return;
    }

    emit("update:modelValue", option.value);

    // 更新高亮索引到选中项
    if (index !== undefined) {
        highlightedIndex.value = index;
    }

    // 立即关闭下拉菜单
    closeDropdown();
};

/**
 * 关闭下拉菜单
 */
const closeDropdown = () => {
    if (!isOpen.value) return;

    isOpen.value = false;
    highlightedIndex.value = -1;

    // 通知下拉管理器此下拉菜单已关闭
    dropdownManager.close(dropdownId);

    // 焦点返回按钮
    if (buttonRef.value) {
        buttonRef.value.focus();
    }
};

/**
 * 高亮下一个选项
 */
const highlightNext = () => {
    const nextIndex = highlightedIndex.value + 1;
    highlightedIndex.value = nextIndex >= props.options.length ? 0 : nextIndex;
    scrollToHighlighted();
};

/**
 * 高亮上一个选项
 */
const highlightPrevious = () => {
    const prevIndex = highlightedIndex.value - 1;
    highlightedIndex.value = prevIndex < 0 ? props.options.length - 1 : prevIndex;
    scrollToHighlighted();
};

/**
 * 滚动到高亮选项
 */
const scrollToHighlighted = () => {
    if (highlightedIndex.value >= 0 && dropdownRef.value) {
        const highlightedElement = dropdownRef.value.querySelector(
            `#${listboxId.value}-option-${highlightedIndex.value}`,
        ) as HTMLElement;

        if (highlightedElement) {
            highlightedElement.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        }
    }
};

/**
 * 选择当前高亮的选项
 */
const selectHighlighted = () => {
    if (highlightedIndex.value >= 0 && highlightedIndex.value < props.options.length) {
        selectOption(props.options[highlightedIndex.value]);
    }
};

/**
 * 处理ComboBox键盘事件 (按ARIA标准)
 */
const handleComboboxKeydown = (event: KeyboardEvent) => {
    switch (event.key) {
        case " ":
        case "Enter":
        case "ArrowDown":
        case "ArrowUp":
            event.preventDefault();
            if (!isOpen.value) {
                openDropdown();
                // 根据按键设置初始高亮
                if (event.key === "ArrowUp") {
                    highlightedIndex.value = props.options.length - 1;
                } else {
                    highlightedIndex.value = 0;
                }
            } else {
                // 下拉菜单已打开时的导航
                if (event.key === "ArrowDown") {
                    highlightNext();
                } else if (event.key === "ArrowUp") {
                    highlightPrevious();
                } else if (event.key === " " || event.key === "Enter") {
                    selectHighlighted();
                }
            }
            break;
        case "Home":
            if (isOpen.value) {
                event.preventDefault();
                highlightedIndex.value = 0;
            }
            break;
        case "End":
            if (isOpen.value) {
                event.preventDefault();
                highlightedIndex.value = props.options.length - 1;
            }
            break;
        case "Escape":
            if (isOpen.value) {
                event.preventDefault();
                closeDropdown();
            }
            break;
        case "Tab":
            if (isOpen.value) {
                closeDropdown();
            }
            break;
    }
};

/**
 * 处理Listbox键盘事件 (仅用于备用，主要逻辑在ComboBox中)
 */
const handleListboxKeydown = (event: KeyboardEvent) => {
    // 将事件转发到ComboBox处理，保持焦点管理一致
    if (buttonRef.value) {
        buttonRef.value.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: event.key,
                bubbles: true,
                cancelable: true,
            }),
        );
    }
    event.preventDefault();
};

/**
 * 处理失去焦点事件
 */
const handleBlur = (_event: FocusEvent) => {
    // 使用setTimeout来延迟检查，确保新的焦点元素已经设置
    setTimeout(() => {
        if (!isOpen.value) return;

        const activeElement = document.activeElement;

        // 如果焦点转移到了下拉菜单内部的元素，不关闭下拉菜单
        if (dropdownRef.value && dropdownRef.value.contains(activeElement)) {
            return;
        }

        // 如果焦点转移到了按钮容器内的其他元素，不关闭下拉菜单
        if (containerRef.value && containerRef.value.contains(activeElement)) {
            return;
        }

        // 否则关闭下拉菜单
        closeDropdown();
    }, 0);
};

/**
 * 处理点击外部区域
 */
const handleClickOutside = (event: MouseEvent) => {
    if (!isOpen.value) return;

    const target = event.target as HTMLElement;

    // 检查是否点击在按钮容器内部
    if (containerRef.value && containerRef.value.contains(target)) {
        return; // 点击在按钮区域，不关闭下拉菜单
    }

    // 检查是否点击在portal下拉菜单内部
    if (dropdownRef.value && dropdownRef.value.contains(target)) {
        return; // 点击在下拉菜单内部，不关闭下拉菜单
    }

    // 点击在外部，关闭下拉菜单
    closeDropdown();
};

/**
 * 处理选项点击事件
 */
const handleOptionClick = (option: Option, index: number) => {
    selectOption(option, index);
};

/**
 * 处理选项鼠标按下事件
 */
// Commenting out unused function
// const _handleOptionMouseDown = (option: Option, index: number) => {
//     logger.debug("Option mousedown:", option, "index:", index);
//     selectOption(option, index);
// };

/**
 * 鼠标进入选项处理
 */
const handleMouseEnter = (index: number) => {
    highlightedIndex.value = index;
};

/**
 * 鼠标离开选项处理
 */
const handleMouseLeave = () => {
    // 保持当前高亮，不清除
};

/**
 * 下拉菜单进入动画
 */
const onDropdownEnter = () => {
    // 动画开始，准备DOM
};

/**
 * 下拉菜单进入动画完成
 */
const onDropdownAfterEnter = () => {
    // 确保ComboBox保持焦点，符合ARIA标准
    if (buttonRef.value) {
        buttonRef.value.focus();
    }

    // 滚动到高亮项
    scrollToHighlighted();
};

/**
 * 下拉菜单离开动画
 */
const onDropdownLeave = () => {
    // 动画清理逻辑
    highlightedIndex.value = -1;
};

/**
 * 处理来自下拉管理器的关闭事件
 */
const handleDropdownCloseEvent = (event: CustomEvent) => {
    const { id } = event.detail;
    if (id === dropdownId && isOpen.value) {
        // 被其他下拉菜单强制关闭，直接关闭本地状态（不需要通知管理器）
        isOpen.value = false;
        highlightedIndex.value = -1;
    }
};

// 生命周期
onMounted(() => {
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("dropdown-close", handleDropdownCloseEvent as EventListener);
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    // 注册到下拉管理器
    dropdownManager.register(dropdownId);
});

onBeforeUnmount(() => {
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("dropdown-close", handleDropdownCloseEvent as EventListener);
    window.removeEventListener("resize", updateDropdownPosition);
    window.removeEventListener("scroll", updateDropdownPosition, true);

    // 从下拉管理器注销
    dropdownManager.unregister(dropdownId);
});

// 监听位置更新
watch(isOpen, (newValue) => {
    if (newValue) {
        nextTick(updateDropdownPosition);
    }
});

// 监听选项变化，重置高亮
watch(
    () => props.options,
    () => {
        if (isOpen.value) {
            const currentIndex = props.options.findIndex(
                (option) => option.value === props.modelValue,
            );
            highlightedIndex.value = currentIndex >= 0 ? currentIndex : 0;
        }
    },
    { deep: true },
);
</script>

<style scoped>
/* Dropdown transition animations */
.dropdown-enter-active {
    transition: all 0.15s ease-out;
}

.dropdown-leave-active {
    transition: all 0.1s ease-in;
}

.dropdown-enter-from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
}

.dropdown-leave-to {
    opacity: 0;
    transform: translateY(-2px) scale(0.99);
}

/* ComboBox 焦点状态 - 修复边缘截断问题 */
.base-select {
    /* 为焦点环留出空间 */
    padding: 2px;
    margin: -2px;
}

.base-select button:focus {
    /* 使用inset shadow避免被截断 */
    box-shadow: inset 0 0 0 2px var(--color-primary, rgb(59, 130, 246));
    border-color: var(--color-primary, rgb(59, 130, 246));
}

/* Dropdown 容器样式 */
.base-select-dropdown {
    outline: none;
    backdrop-filter: blur(8px);
}

.base-select-dropdown ul {
    scroll-behavior: smooth;
}

/* 选项高亮和选中状态的视觉优化 */
.base-select-dropdown li {
    transition: all 0.15s ease;
}

/* 选中项的特殊样式 */
.base-select-dropdown li[aria-selected="true"]:not([data-highlighted="true"]) {
    background: var(--color-card-hover);
    font-weight: 600;
}

/* 高亮项的样式 (键盘导航或hover) */
.base-select-dropdown li[data-highlighted="true"] {
    background: var(--color-primary) !important;
    color: var(--color-white) !important;
    transform: translateX(2px);
}

/* 确保图标颜色正确 */
.base-select-dropdown li[data-highlighted="true"] .check-icon {
    color: var(--color-white);
}

/* 选项hover状态 */
.base-select-dropdown li:hover:not([data-highlighted="true"]) {
    background: var(--color-card-hover);
    transform: translateX(1px);
}

/* 无障碍支持：减少动画 */
@media (prefers-reduced-motion: reduce) {
    .dropdown-enter-active,
    .dropdown-leave-active,
    .base-select-dropdown li {
        transition: none;
    }

    .dropdown-enter-from,
    .dropdown-leave-to {
        transform: none;
    }

    .base-select-dropdown li[data-highlighted="true"],
    .base-select-dropdown li:hover {
        transform: none;
    }
}

/* 滚动条样式优化 - 使用主题变量 */
.base-select-dropdown ul {
    scrollbar-width: thin;
    scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
}

.base-select-dropdown ul::-webkit-scrollbar {
    width: var(--color-scrollbar-width-thin);
}

.base-select-dropdown ul::-webkit-scrollbar-track {
    background: var(--color-scrollbar-track);
    border-radius: var(--color-scrollbar-border-radius);
}

.base-select-dropdown ul::-webkit-scrollbar-track:hover {
    background: var(--color-scrollbar-track-hover);
}

.base-select-dropdown ul::-webkit-scrollbar-thumb {
    background: var(--color-scrollbar-thumb);
    border-radius: var(--color-scrollbar-border-radius);
    transition: all 0.2s ease;
}

.base-select-dropdown ul::-webkit-scrollbar-thumb:hover {
    background: var(--color-scrollbar-thumb-hover);
}

.base-select-dropdown ul::-webkit-scrollbar-thumb:active {
    background: var(--color-scrollbar-thumb-active);
}
</style>
