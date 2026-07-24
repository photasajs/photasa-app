/**
 * Tests for ScanQueueDialog component
 */
import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createScanQueueItem, type ScanQueueItem } from "@renderer/stores/scanning-types";
import ScanQueueDialog from "../ScanQueueDialog.vue";

vi.mock("@tanstack/vue-virtual", () => ({
    useVirtualizer: (options: {
        count: number;
        estimateSize: (index: number) => number;
        gap?: number;
    }) => {
        const virtualizer = ref({
            options: { count: options.count },
            getVirtualItems: () => {
                const count = virtualizer.value.options.count;
                return Array.from({ length: count }, (_, index) => {
                    const size = options.estimateSize(index);
                    const gap = options.gap ?? 0;
                    return {
                        index,
                        key: index,
                        start: index * (size + gap),
                        size,
                    };
                });
            },
            getTotalSize: () => {
                const count = virtualizer.value.options.count;
                if (count === 0) {
                    return 0;
                }
                const sizes = Array.from({ length: count }, (_, index) =>
                    options.estimateSize(index),
                );
                const gap = options.gap ?? 0;
                return sizes.reduce((sum, size) => sum + size, 0) + (count - 1) * gap;
            },
            measure: vi.fn(),
        });
        return virtualizer;
    },
}));

const i18n = createI18n({
    legacy: false,
    locale: "zh-CN",
    messages: {
        "zh-CN": {
            scan: {
                queueTitle: "扫描队列",
                queueEmpty: "队列为空",
                processing: "正在处理队列",
                pendingTasks: "{count} 个任务待处理",
                allTasksCompleted: "所有扫描任务已完成",
                unknownFolder: "未知文件夹",
                noTimestamp: "无时间戳",
                timeJustNow: "刚刚",
                timeMinutesAgo: "{count} 分钟前",
                timeHoursAgo: "{count} 小时前",
                timeDaysAgo: "{count} 天前",
                priority: "优先级",
                processed: "已处理",
                incrementalCache: "增量缓存",
                retryState: "重试 {retryCount}/{maxRetries}",
                statusLabels: {
                    pending: "等待",
                    processing: "处理中",
                    failed: "失败",
                },
                actions: {
                    scan: "扫描",
                    rescan: "重新扫描",
                    current: "当前扫描",
                },
            },
            button: {
                ok: "确定",
            },
        },
    },
});

function createQueueItem(path: string, overrides: Partial<ScanQueueItem> = {}): ScanQueueItem {
    return {
        ...createScanQueueItem({
            path,
            action: overrides.action ?? "scan",
            priority: overrides.priority,
            maxRetries: overrides.maxRetries,
        }),
        ...overrides,
        path,
    };
}

describe("ScanQueueDialog", () => {
    const createWrapper = (props = {}) => {
        return mount(ScanQueueDialog, {
            props: {
                show: false,
                scanningFolder: [],
                ...props,
            },
            global: {
                plugins: [i18n],
                stubs: {
                    BaseModal: {
                        template: '<div class="base-modal"><slot /></div>',
                        props: ["open", "title"],
                    },
                    BaseButton: {
                        template: '<button class="base-button"><slot /></button>',
                        props: ["variant"],
                    },
                },
            },
        });
    };

    it("应该正确渲染空状态", () => {
        const wrapper = createWrapper({
            show: true,
            scanningFolder: [],
        });

        expect(wrapper.find(".empty-status").exists()).toBe(true);
    });

    it("应该在单列表中渲染全部任务并高亮当前项", () => {
        const scanningFolder = [
            createQueueItem("/test/folder1", { action: "scan" }),
            createQueueItem("/test/folder2", { action: "rescan" }),
            createQueueItem("/test/folder3", { action: "current" }),
        ];

        const wrapper = createWrapper({
            show: true,
            scanningFolder,
        });

        const cards = wrapper.findAll(".queue-card");
        expect(cards).toHaveLength(3);
        expect(cards[0].classes()).toContain("queue-card-active");
        expect(cards[1].classes()).toContain("queue-card-next");
        expect(cards[2].classes()).toContain("queue-card-queued");
    });

    it("应该显示完整路径、basename 与优先级", () => {
        const scanningFolder = [
            createQueueItem("/test/very/long/folder/path", {
                priority: 2,
                progress: { processed: 3, total: 10 },
            }),
        ];

        const wrapper = createWrapper({
            show: true,
            scanningFolder,
        });

        expect(wrapper.find(".queue-card-path").text()).toBe("/test/very/long/folder/path");
        expect(wrapper.text()).toContain("path");
        expect(wrapper.text()).toContain("优先级: 2");
    });

    it("当前项无进度时仍预留详情槽位", () => {
        const scanningFolder = [createQueueItem("/test/folder1")];

        const wrapper = createWrapper({
            show: true,
            scanningFolder,
        });

        expect(wrapper.find(".queue-card-active .queue-card-detail-slot").exists()).toBe(true);
        expect(wrapper.find(".queue-card-progress").exists()).toBe(false);
    });

    it("应该显示当前项扫描进度与增量缓存指示", () => {
        const scanningFolder = [
            createQueueItem("/test/folder1", {
                progress: { processed: 5, total: 20, cacheEnabled: true },
            }),
        ];

        const wrapper = createWrapper({
            show: true,
            scanningFolder,
        });

        expect(wrapper.find(".queue-card-active .queue-card-detail-slot").exists()).toBe(true);
        expect(wrapper.find(".queue-card-progress").text()).toContain("已处理:");
        expect(wrapper.find(".queue-card-progress").text()).toContain("5");
        expect(wrapper.find(".queue-card-progress").text()).toContain("/ 20");
        expect(wrapper.find(".queue-cache-indicator").exists()).toBe(true);
    });

    it("应该显示失败任务错误与重试状态", () => {
        const scanningFolder = [
            createQueueItem("/test/failed", {
                status: "failed",
                error: "permission denied",
                retryCount: 1,
                maxRetries: 3,
            }),
        ];

        const wrapper = createWrapper({
            show: true,
            scanningFolder,
        });

        expect(wrapper.find(".queue-card-failed").exists()).toBe(true);
        expect(wrapper.find(".queue-card-error").text()).toContain("permission denied");
        expect(wrapper.find(".queue-card-error").text()).toContain("重试 1/3");
        expect(wrapper.find(".chip-failed").text()).toBe("失败");
    });

    it("应该发出close事件", async () => {
        const wrapper = createWrapper({
            show: true,
            scanningFolder: [],
        });

        await wrapper.vm.$emit("close");

        expect(wrapper.emitted("close")).toBeTruthy();
    });
});
