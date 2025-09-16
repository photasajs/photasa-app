import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import BaseNotification from "../BaseNotification.vue";
import type { NotificationItem } from "@renderer/types/notification";

// Mock Event constructor to avoid SupportedEventInterface errors
global.Event =
    global.Event ||
    class Event {
        constructor(
            public type: string,
            options?: any,
        ) {
            this.type = type;
            Object.assign(this, options);
        }

        // Add required Event interface methods
        preventDefault() {}
        stopPropagation() {}
        stopImmediatePropagation() {}
        get bubbles() {
            return false;
        }
        get cancelable() {
            return false;
        }
        get composed() {
            return false;
        }
        get currentTarget() {
            return null;
        }
        get defaultPrevented() {
            return false;
        }
        get eventPhase() {
            return 0;
        }
        get isTrusted() {
            return false;
        }
        get target() {
            return null;
        }
        get timeStamp() {
            return Date.now();
        }
    };

// Mock MouseEvent constructor
global.MouseEvent =
    global.MouseEvent ||
    class MouseEvent extends Event {
        constructor(type: string, options?: any) {
            super(type, options);
        }

        // Add MouseEvent specific properties
        get button() {
            return 0;
        }
        get buttons() {
            return 0;
        }
        get clientX() {
            return 0;
        }
        get clientY() {
            return 0;
        }
        get movementX() {
            return 0;
        }
        get movementY() {
            return 0;
        }
        get offsetX() {
            return 0;
        }
        get offsetY() {
            return 0;
        }
        get pageX() {
            return 0;
        }
        get pageY() {
            return 0;
        }
        get relatedTarget() {
            return null;
        }
        get screenX() {
            return 0;
        }
        get screenY() {
            return 0;
        }
    };

// Mock all event constructors that Vue Test Utils might need
global.KeyboardEvent =
    global.KeyboardEvent ||
    class KeyboardEvent extends Event {
        constructor(type: string, options?: any) {
            super(type, options);
        }

        get key() {
            return "";
        }
        get code() {
            return "";
        }
        get keyCode() {
            return 0;
        }
        get which() {
            return 0;
        }
        get charCode() {
            return 0;
        }
        get shiftKey() {
            return false;
        }
        get ctrlKey() {
            return false;
        }
        get altKey() {
            return false;
        }
        get metaKey() {
            return false;
        }
        get repeat() {
            return false;
        }
        get isComposing() {
            return false;
        }
    };

global.FocusEvent =
    global.FocusEvent ||
    class FocusEvent extends Event {
        constructor(type: string, options?: any) {
            super(type, options);
        }

        get relatedTarget() {
            return null;
        }
    };

describe("BaseNotification", () => {
    const mockNotification: NotificationItem = {
        id: "test-id",
        type: "success",
        message: "Test message",
        title: "Test title",
        duration: 4000,
        timestamp: Date.now(),
        closable: true,
        actions: [],
        className: "",
        visible: true,
        key: "test-key",
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should render notification with correct content", () => {
        const wrapper = mount(BaseNotification, {
            props: {
                notification: mockNotification,
            },
        });

        // Check for the notification item
        const notificationItem = wrapper.find(".notification-item");
        expect(notificationItem.exists()).toBe(true);

        expect(wrapper.find(".notification-title").text()).toBe("Test title");
        expect(wrapper.find(".notification-message").text()).toBe("Test message");
        expect(notificationItem.classes()).toContain("notification-item--success");
    });

    it("should render different notification types", () => {
        const types: Array<NotificationItem["type"]> = ["success", "error", "warning", "info"];

        types.forEach((type) => {
            const notification = { ...mockNotification, type };
            const wrapper = mount(BaseNotification, {
                props: { notification },
            });

            const notificationItem = wrapper.find(".notification-item");
            expect(notificationItem.classes()).toContain(`notification-item--${type}`);
        });
    });

    it("should render without title when not provided", () => {
        const notificationWithoutTitle = { ...mockNotification, title: "" };
        const wrapper = mount(BaseNotification, {
            props: {
                notification: notificationWithoutTitle,
            },
        });

        expect(wrapper.find(".notification-title").exists()).toBe(false);
        expect(wrapper.find(".notification-message").text()).toBe("Test message");
    });

    it("should emit close event when close button is clicked", async () => {
        const wrapper = mount(BaseNotification, {
            props: {
                notification: mockNotification,
            },
        });

        const closeButton = wrapper.find(".notification-close");
        expect(closeButton.exists()).toBe(true);

        await closeButton.trigger("click");

        // Fast-forward the close animation delay (300ms)
        vi.advanceTimersByTime(300);

        expect(wrapper.emitted("close")).toBeTruthy();
        expect(wrapper.emitted("close")?.[0]).toEqual([mockNotification.id]);
    });

    it("should auto-close after duration", async () => {
        const wrapper = mount(BaseNotification, {
            props: {
                notification: { ...mockNotification, duration: 1000 },
            },
        });

        // Fast-forward time to trigger auto-close
        vi.advanceTimersByTime(1000);

        // Fast-forward additional time for the close animation delay
        vi.advanceTimersByTime(300);

        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("close")).toBeTruthy();
        expect(wrapper.emitted("close")?.[0]).toEqual([mockNotification.id]);
    });

    it("should not auto-close when duration is 0", async () => {
        const wrapper = mount(BaseNotification, {
            props: {
                notification: { ...mockNotification, duration: 0 },
            },
        });

        // Fast-forward time significantly
        vi.advanceTimersByTime(10000);

        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("close")).toBeFalsy();
    });

    it("should clear timeout on unmount", () => {
        const wrapper = mount(BaseNotification, {
            props: {
                notification: mockNotification,
            },
        });

        const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

        wrapper.unmount();

        expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("should pause auto-close on mouse enter", async () => {
        const wrapper = mount(BaseNotification, {
            props: {
                notification: { ...mockNotification, duration: 2000 },
            },
        });

        // Wait a bit for the component to initialize
        await wrapper.vm.$nextTick();

        // Trigger mouse enter to pause the timer
        const notificationItem = wrapper.find(".notification-item");
        await notificationItem.trigger("mouseenter");

        // Fast-forward time past the original duration
        vi.advanceTimersByTime(3000);

        await wrapper.vm.$nextTick();

        // Should not have closed because we paused it
        expect(wrapper.emitted("close")).toBeFalsy();
    });

    it("should resume auto-close on mouse leave", async () => {
        const wrapper = mount(BaseNotification, {
            props: {
                notification: { ...mockNotification, duration: 1000 },
            },
        });

        // Trigger mouse enter to pause
        await wrapper.trigger("mouseenter");

        // Fast-forward time
        vi.advanceTimersByTime(500);

        // Trigger mouse leave to resume
        await wrapper.trigger("mouseleave");

        // Fast-forward remaining time
        vi.advanceTimersByTime(1000);

        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("close")).toBeTruthy();
    });

    it("should display correct icon for each notification type", () => {
        const types: Array<NotificationItem["type"]> = ["success", "error", "warning", "info"];

        types.forEach((type) => {
            const notification = { ...mockNotification, type };
            const wrapper = mount(BaseNotification, {
                props: { notification },
            });

            const iconContainer = wrapper.find(".notification-icon");
            expect(iconContainer.exists()).toBe(true);

            // Check that the correct icon class is present based on type
            const iconElement = iconContainer.find(".icon");
            expect(iconElement.exists()).toBe(true);
            expect(iconElement.classes()).toContain(`icon--${type}`);
        });
    });

    it("should apply theme-aware CSS classes", () => {
        const wrapper = mount(BaseNotification, {
            props: {
                notification: mockNotification,
            },
        });

        // Check for the notification item
        const notificationItem = wrapper.find(".notification-item");
        expect(notificationItem.exists()).toBe(true);

        // Check that the component has the correct base classes
        expect(notificationItem.classes()).toContain("notification-item");
        expect(notificationItem.classes()).toContain("notification-item--success");

        // Check that the component structure is correct
        expect(wrapper.find(".notification-icon").exists()).toBe(true);
        expect(wrapper.find(".notification-content").exists()).toBe(true);
    });
});
