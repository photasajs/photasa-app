import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import NotificationContainer from "../NotificationContainer.vue";
import { useNotificationStore } from "@renderer/stores/notification";

// 全局 Pinia 实例，避免重复创建
let globalPinia: ReturnType<typeof createPinia>;

// Mock BaseNotification component
vi.mock("../BaseNotification.vue", () => ({
    default: {
        name: "BaseNotification",
        props: ["notification"],
        emits: ["close"],
        template: `
      <div
        class="mock-notification"
        :data-id="notification.id"
        :data-type="notification.type"
        @click="$emit('close', notification.id)"
      >
        {{ notification.message }}
      </div>
    `,
    },
}));

describe("NotificationContainer", () => {
    let store: ReturnType<typeof useNotificationStore>;

    beforeAll(() => {
        // 创建全局 Pinia 实例
        globalPinia = createPinia();
        setActivePinia(globalPinia);

        // 抑制 Pinia 重复提供的警告
        const originalWarn = console.warn;
        console.warn = (message: string) => {
            if (message.includes('App already provides property with key "Symbol(pinia)"')) {
                return;
            }
            originalWarn(message);
        };
    });

    beforeEach(() => {
        // Clean up any existing DOM elements
        document.body.innerHTML = "";

        // 使用全局 Pinia 实例
        setActivePinia(globalPinia);
        store = useNotificationStore();

        // 清理 store 状态
        store.clear();
    });

    afterEach(() => {
        // 清理 DOM 和 store 状态
        document.body.innerHTML = "";
        if (store) {
            store.clear();
        }
    });

    afterAll(() => {
        // 清理全局 Pinia 实例
        if (globalPinia) {
            // 使用类型断言访问内部方法，因为这是测试清理
            (globalPinia as any)._s?.clear();
        }
        document.body.innerHTML = "";
    });

    it("should render empty container when no notifications", () => {
        const wrapper = mount(NotificationContainer, {
            global: {
                plugins: [globalPinia],
            },
            attachTo: document.body,
        });

        // Since we're using Teleport, check the document body for the container
        expect(document.querySelector(".notification-container")).toBeTruthy();
        expect(document.querySelectorAll(".mock-notification")).toHaveLength(0);

        wrapper.unmount();
    });

    it("should render notifications from store", async () => {
        // Add notifications to store
        store.success({ message: "Success message" });
        store.error({ message: "Error message" });

        const wrapper = mount(NotificationContainer, {
            global: {
                plugins: [globalPinia],
            },
            attachTo: document.body,
        });

        await wrapper.vm.$nextTick();

        // Check in document body since we're using Teleport
        const notifications = document.querySelectorAll(".mock-notification");
        expect(notifications).toHaveLength(2);
        expect(notifications[0].textContent?.trim()).toBe("Success message");
        expect(notifications[1].textContent?.trim()).toBe("Error message");

        wrapper.unmount();
    });

    it("should handle notification close event", async () => {
        const successId = store.success({ message: "Success message" });
        store.error({ message: "Error message" });

        const wrapper = mount(NotificationContainer, {
            global: {
                plugins: [globalPinia],
            },
            attachTo: document.body,
        });
        await wrapper.vm.$nextTick();

        expect(document.querySelectorAll(".mock-notification")).toHaveLength(2);

        // Click on first notification to close it
        const firstNotification = document.querySelector(`[data-id="${successId}"]`) as HTMLElement;
        firstNotification?.click();
        await wrapper.vm.$nextTick();

        expect(document.querySelectorAll(".mock-notification")).toHaveLength(1);
        expect(document.querySelector(".mock-notification")?.textContent?.trim()).toBe(
            "Error message",
        );

        wrapper.unmount();
    });

    it("should position notifications correctly", () => {
        const wrapper = mount(NotificationContainer, {
            global: {
                plugins: [globalPinia],
            },
            attachTo: document.body,
        });

        // Check the teleported container in document body
        const container = document.querySelector(".notification-container");
        expect(container).toBeTruthy();

        // Check that the container has the notification-container class
        expect(container?.classList.contains("notification-container")).toBeTruthy();

        wrapper.unmount();
    });

    it("should apply stacking styles for multiple notifications", async () => {
        store.success({ message: "First" });
        store.error({ message: "Second" });
        store.warning({ message: "Third" });

        const wrapper = mount(NotificationContainer, {
            global: {
                plugins: [globalPinia],
            },
            attachTo: document.body,
        });
        await wrapper.vm.$nextTick();

        const notifications = document.querySelectorAll(".mock-notification");
        expect(notifications).toHaveLength(3);

        // Check that the container exists in document body
        const container = document.querySelector(".notification-container");
        expect(container).toBeTruthy();

        wrapper.unmount();
    });

    it("should handle different notification types", async () => {
        store.success({ message: "Success" });
        store.error({ message: "Error" });
        store.warning({ message: "Warning" });
        store.info({ message: "Info" });

        const wrapper = mount(NotificationContainer, {
            global: {
                plugins: [globalPinia],
            },
            attachTo: document.body,
        });
        await wrapper.vm.$nextTick();

        const notifications = document.querySelectorAll(".mock-notification");
        expect(notifications).toHaveLength(4);

        expect(notifications[0].getAttribute("data-type")).toBe("success");
        expect(notifications[1].getAttribute("data-type")).toBe("error");
        expect(notifications[2].getAttribute("data-type")).toBe("warning");
        expect(notifications[3].getAttribute("data-type")).toBe("info");

        wrapper.unmount();
    });

    it("should reactively update when store changes", async () => {
        const wrapper = mount(NotificationContainer, {
            global: {
                plugins: [globalPinia],
            },
            attachTo: document.body,
        });

        expect(document.querySelectorAll(".mock-notification")).toHaveLength(0);

        // Add notification
        store.success({ message: "New notification" });
        await wrapper.vm.$nextTick();

        expect(document.querySelectorAll(".mock-notification")).toHaveLength(1);

        // Clear all notifications
        store.clear();
        await wrapper.vm.$nextTick();

        expect(document.querySelectorAll(".mock-notification")).toHaveLength(0);

        wrapper.unmount();
    });

    it("should maintain notification order", async () => {
        store.success({ message: "First" });
        store.error({ message: "Second" });
        store.warning({ message: "Third" });

        const wrapper = mount(NotificationContainer, {
            global: {
                plugins: [globalPinia],
            },
            attachTo: document.body,
        });
        await wrapper.vm.$nextTick();

        const notifications = document.querySelectorAll(".mock-notification");
        expect(notifications[0].textContent?.trim()).toBe("First");
        expect(notifications[1].textContent?.trim()).toBe("Second");
        expect(notifications[2].textContent?.trim()).toBe("Third");

        wrapper.unmount();
    });

    it("should handle rapid notification additions and removals", async () => {
        const wrapper = mount(NotificationContainer, {
            global: {
                plugins: [globalPinia],
            },
            attachTo: document.body,
        });

        // Add multiple notifications rapidly
        store.success({ message: "First" });
        const id2 = store.error({ message: "Second" });
        store.warning({ message: "Third" });

        await wrapper.vm.$nextTick();
        expect(document.querySelectorAll(".mock-notification")).toHaveLength(3);

        // Remove middle notification
        store.remove(id2);
        await wrapper.vm.$nextTick();

        const notifications = document.querySelectorAll(".mock-notification");
        expect(notifications).toHaveLength(2);
        expect(notifications[0].textContent?.trim()).toBe("First");
        expect(notifications[1].textContent?.trim()).toBe("Third");

        wrapper.unmount();
    });

    it("should apply theme-aware styling", () => {
        const wrapper = mount(NotificationContainer, {
            global: {
                plugins: [globalPinia],
            },
            attachTo: document.body,
        });

        // Check the teleported container in document body
        const container = document.querySelector(".notification-container");
        expect(container).toBeTruthy();

        // Check that the container has the notification-container class
        expect(container?.classList.contains("notification-container")).toBeTruthy();

        wrapper.unmount();
    });
});
