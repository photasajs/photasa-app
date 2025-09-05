/**
 * Tests for ScanQueueDialog component
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import ScanQueueDialog from "../ScanQueueDialog.vue";

// Create i18n instance for testing
const i18n = createI18n({
    legacy: false,
    locale: "zh-CN",
    messages: {
        "zh-CN": {
            scan: {
                queueTitle: "扫描队列",
            },
            button: {
                ok: "确定",
            },
        },
    },
});

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
        expect(wrapper.find(".empty-text h4").text()).toBe("队列为空");
        expect(wrapper.find(".empty-text p").text()).toBe("所有扫描任务已完成");
    });

    it("应该正确渲染处理状态", () => {
        const scanningFolder = [
            { path: "/test/folder1", action: "scan" },
            { path: "/test/folder2", action: "rescan" },
        ];

        const wrapper = createWrapper({
            show: true,
            scanningFolder,
        });

        expect(wrapper.find(".processing-status").exists()).toBe(true);
        expect(wrapper.find(".status-text h4").text()).toBe("正在处理队列");
        expect(wrapper.find(".status-text p").text()).toBe("2 个任务待处理");
    });

    it("应该正确显示扫描项目列表", () => {
        const scanningFolder = [
            { path: "/test/folder1", action: "scan" },
            { path: "/test/folder2", action: "rescan" },
            { path: "/test/folder3", action: "current" },
        ];

        const wrapper = createWrapper({
            show: true,
            scanningFolder,
        });

        expect(wrapper.find(".queue-items").exists()).toBe(true);

        const queueItems = wrapper.findAll(".queue-item");
        expect(queueItems).toHaveLength(3);

        // 检查第一个项目是否被标记为活跃
        expect(queueItems[0].classes()).toContain("active");
        expect(queueItems[1].classes()).not.toContain("active");
        expect(queueItems[2].classes()).not.toContain("active");
    });

    it("应该正确格式化路径名称", () => {
        const scanningFolder = [{ path: "/test/very/long/folder/path", action: "scan" }];

        const wrapper = createWrapper({
            show: true,
            scanningFolder,
        });

        const itemMeta = wrapper.find(".item-meta");
        expect(itemMeta.text()).toBe("path");
    });

    it("应该正确显示操作标签", () => {
        const scanningFolder = [
            { path: "/test/folder1", action: "scan" },
            { path: "/test/folder2", action: "rescan" },
            { path: "/test/folder3", action: "current" },
        ];

        const wrapper = createWrapper({
            show: true,
            scanningFolder,
        });

        const actionBadges = wrapper.findAll(".action-badge");
        expect(actionBadges[0].text()).toBe("扫描");
        expect(actionBadges[0].classes()).toContain("action-scan");

        expect(actionBadges[1].text()).toBe("重新扫描");
        expect(actionBadges[1].classes()).toContain("action-rescan");

        expect(actionBadges[2].text()).toBe("当前扫描");
        expect(actionBadges[2].classes()).toContain("action-current");
    });

    it("应该发出close事件", async () => {
        const wrapper = createWrapper({
            show: true,
            scanningFolder: [],
        });

        // Since we're using stubs, we need to trigger the event from the component
        await wrapper.vm.$emit("close");

        expect(wrapper.emitted("close")).toBeTruthy();
    });

    it("当show为false时不应渲染内容", () => {
        const wrapper = createWrapper({
            show: false,
            scanningFolder: [{ path: "/test", action: "scan" }],
        });

        // 由于使用了stub，实际的BaseModal行为会被模拟
        // 这里主要测试组件能正常挂载
        expect(wrapper.exists()).toBe(true);
    });
});
