<template>
    <Teleport to="body">
        <div v-if="visible" class="log-console-overlay">
            <div class="log-console" @mousedown="startDrag">
                <div class="log-header">
                    <h3 class="log-title">{{ t("logViewer.title") }}</h3>
                    <div class="log-controls">
                        <input
                            v-model="searchTerm"
                            :placeholder="t('logViewer.searchPlaceholder')"
                            class="log-search"
                            @click.stop
                            @mousedown.stop
                        />
                        <select v-model="levelFilter" class="log-filter">
                            <option value="">{{ t("logViewer.allLevels") }}</option>
                            <option value="debug">{{ t("logViewer.debug") }}</option>
                            <option value="info">{{ t("logViewer.info") }}</option>
                            <option value="warn">{{ t("logViewer.warn") }}</option>
                            <option value="error">{{ t("logViewer.error") }}</option>
                        </select>
                        <button @click="clearLogs" class="log-btn">
                            {{ t("logViewer.clear") }}
                        </button>
                        <button @click="exportLogs" class="log-btn">
                            {{ t("logViewer.export") }}
                        </button>
                        <button @click="close" class="log-btn log-btn-close">✕</button>
                    </div>
                </div>

                <div class="log-body" ref="logContainer" @mousedown.stop>
                    <div
                        v-for="(entry, index) in filteredLogs"
                        :key="`${entry.timestamp}-${index}`"
                        :class="['log-entry', `log-${entry.level}`]"
                    >
                        <span class="log-time">{{ formatTime(entry.timestamp) }}</span>
                        <span class="log-level">{{ entry.level.toUpperCase() }}</span>
                        <span class="log-source">[{{ entry.source }}]</span>
                        <span class="log-category">{{ entry.category }}</span>
                        <span class="log-message">{{ entry.message }}</span>
                    </div>
                    <div v-if="filteredLogs.length === 0" class="log-empty">
                        {{ t("logViewer.noLogs") }}
                    </div>
                </div>

                <div class="log-footer">
                    <span>{{
                        t("logViewer.showing", {
                            filtered: filteredLogs.length,
                            total: logs.length,
                        })
                    }}</span>
                    <label class="auto-scroll-label">
                        <input type="checkbox" v-model="autoScroll" />
                        {{ t("logViewer.autoScroll") }}
                    </label>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import type { LogEntry } from "@common/logger";

const { t } = useI18n();

const visible = ref(false);
const logs = ref<LogEntry[]>([]);
const searchTerm = ref("");
const levelFilter = ref("");
const autoScroll = ref(true);
const logContainer = ref<HTMLElement>();

// 拖拽相关
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

const filteredLogs = computed(() => {
    return logs.value.filter((log) => {
        const matchesLevel = !levelFilter.value || log.level === levelFilter.value;
        const matchesSearch =
            !searchTerm.value ||
            log.message.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
            log.category.toLowerCase().includes(searchTerm.value.toLowerCase());
        return matchesLevel && matchesSearch;
    });
});

// 格式化时间
const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
    });
};

// 监听快捷键
const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+Shift+Option+L (Mac) / Ctrl+Shift+Alt+L (Windows/Linux)
    const isTargetKey = (e.metaKey || e.ctrlKey) && e.shiftKey && e.altKey && e.key === "L";

    if (isTargetKey) {
        e.preventDefault();
        toggle();
    }
};

const toggle = async () => {
    visible.value = !visible.value;
    if (visible.value) {
        // 通知主进程开始收集日志
        const result = await window.api.log.viewerOpen();
        if (result.success) {
            logs.value = []; // 清空旧日志
        } else {
            visible.value = false;
        }
    } else {
        // 通知主进程停止收集日志
        await window.api.log.viewerClose();
        logs.value = []; // 清空日志

        // 重置位置，下次打开时重新居中
        const consoleEl = document.querySelector(".log-console") as HTMLElement;
        if (consoleEl) {
            consoleEl.style.transform = "translateX(-50%)";
            consoleEl.style.left = "50%";
            consoleEl.style.top = "50px";
        }
    }
};

const close = () => {
    visible.value = false;
    window.api.log.viewerClose();
    logs.value = [];

    // 重置位置，下次打开时重新居中
    const consoleEl = document.querySelector(".log-console") as HTMLElement;
    if (consoleEl) {
        consoleEl.style.transform = "translateX(-50%)";
        consoleEl.style.left = "50%";
        consoleEl.style.top = "50px";
    }
};

const clearLogs = () => {
    logs.value = [];
};

const exportLogs = () => {
    const logText = logs.value
        .map(
            (entry) =>
                `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.category} - ${entry.message}`,
        )
        .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `photasa-logs-${new Date().toISOString().replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
};

// 拖拽功能
const startDrag = (e: MouseEvent) => {
    // 忽略控件区域的拖拽
    const target = e.target as HTMLElement;
    if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "OPTION" ||
        target.tagName === "BUTTON" ||
        target.closest(".log-controls") ||
        target.closest(".log-body")
    ) {
        return;
    }

    isDragging.value = true;
    const consoleEl = document.querySelector(".log-console") as HTMLElement;
    if (consoleEl) {
        const rect = consoleEl.getBoundingClientRect();

        // 移除 transform，切换到 left/top 定位
        consoleEl.style.transform = "none";
        consoleEl.style.left = `${rect.left}px`;
        consoleEl.style.top = `${rect.top}px`;

        // 添加拖拽样式
        consoleEl.style.opacity = "0.8";
        consoleEl.style.cursor = "grabbing";

        // 计算拖拽偏移
        dragOffset.value = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }

    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", stopDrag);
};

const handleDrag = (e: MouseEvent) => {
    if (!isDragging.value) return;

    const consoleEl = document.querySelector(".log-console") as HTMLElement;
    if (consoleEl) {
        const newLeft = e.clientX - dragOffset.value.x;
        const newTop = e.clientY - dragOffset.value.y;

        // 限制在视窗范围内
        const maxLeft = window.innerWidth - consoleEl.offsetWidth;
        const maxTop = window.innerHeight - consoleEl.offsetHeight;

        consoleEl.style.left = `${Math.max(0, Math.min(maxLeft, newLeft))}px`;
        consoleEl.style.top = `${Math.max(0, Math.min(maxTop, newTop))}px`;
    }
};

const stopDrag = () => {
    isDragging.value = false;

    // 恢复样式
    const consoleEl = document.querySelector(".log-console") as HTMLElement;
    if (consoleEl) {
        consoleEl.style.opacity = "1";
        consoleEl.style.cursor = "move";
    }

    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);
};

// 自动滚动
watch(filteredLogs, async () => {
    if (autoScroll.value && logContainer.value) {
        await nextTick();
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
});

onMounted(() => {
    document.addEventListener("keydown", handleKeyDown);

    // 监听全局快捷键触发
    window.api.log.onToggleViewer(() => {
        toggle();
    });

    // 监听新日志
    window.api.log.onEntry((entry: LogEntry) => {
        logs.value.push(entry);
        // 限制最大条数
        if (logs.value.length > 5000) {
            logs.value.shift();
        }
    });
});

onUnmounted(() => {
    document.removeEventListener("keydown", handleKeyDown);
    if (visible.value) {
        window.api.log.viewerClose();
    }
});
</script>

<style scoped lang="less">
.log-console-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
}

.log-console {
    position: absolute;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 1200px;
    height: 600px;
    background: #1e1e1e;
    border: 1px solid #444;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    cursor: move;
    user-select: none;

    .log-header {
        padding: 12px 16px;
        background: #2d2d2d;
        border-bottom: 1px solid #444;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 8px 8px 0 0;

        .log-title {
            margin: 0;
            font-size: 16px;
            color: #fff;
            font-weight: 500;
        }

        .log-controls {
            display: flex;
            gap: 8px;
            cursor: default;

            .log-search {
                padding: 4px 8px;
                background: #1e1e1e;
                border: 1px solid #555;
                border-radius: 4px;
                color: #fff;
                width: 200px;
                cursor: text;

                &:focus {
                    outline: none;
                    border-color: #0084ff;
                }
            }

            .log-filter {
                padding: 4px 8px;
                background: #1e1e1e;
                border: 1px solid #555;
                border-radius: 4px;
                color: #fff;
                cursor: pointer;

                &:focus {
                    outline: none;
                    border-color: #0084ff;
                }
            }

            .log-btn {
                padding: 4px 12px;
                background: #3a3a3a;
                border: 1px solid #555;
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                transition: background 0.2s;

                &:hover {
                    background: #4a4a4a;
                }

                &.log-btn-close {
                    background: #d73a49;
                    border-color: #d73a49;

                    &:hover {
                        background: #cb2431;
                    }
                }
            }
        }
    }

    .log-body {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace;
        font-size: 12px;
        line-height: 1.5;
        cursor: auto;

        .log-entry {
            padding: 2px 4px;
            white-space: pre-wrap;
            word-break: break-all;

            &:hover {
                background: rgba(255, 255, 255, 0.05);
            }

            .log-time {
                color: #888;
                margin-right: 8px;
            }

            .log-level {
                font-weight: bold;
                margin-right: 8px;
                min-width: 50px;
                display: inline-block;
            }

            .log-source {
                color: #9ca3af;
                margin-right: 8px;
            }

            .log-category {
                color: #60a5fa;
                margin-right: 8px;
            }

            .log-message {
                color: #e5e5e5;
            }

            &.log-debug {
                .log-level {
                    color: #6b7280;
                }
            }

            &.log-info {
                .log-level {
                    color: #3b82f6;
                }
            }

            &.log-warn {
                .log-level {
                    color: #f59e0b;
                }
            }

            &.log-error {
                .log-level {
                    color: #ef4444;
                }
                .log-message {
                    color: #fca5a5;
                }
            }
        }

        .log-empty {
            text-align: center;
            color: #888;
            padding: 20px;
        }
    }

    .log-footer {
        padding: 8px 16px;
        background: #2d2d2d;
        border-top: 1px solid #444;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #888;
        font-size: 12px;
        border-radius: 0 0 8px 8px;
        cursor: default;

        .auto-scroll-label {
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;

            input[type="checkbox"] {
                cursor: pointer;
            }
        }
    }
}
</style>
