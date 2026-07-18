import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useNotificationStore } from "../notification";
import type { NotificationConfig } from "@renderer/types/notification";

describe("Notification Store", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it("should initialize with empty notifications", () => {
        const store = useNotificationStore();
        expect(store.notifications).toEqual([]);
    });

    it("should add success notification", () => {
        const store = useNotificationStore();
        const config: Omit<NotificationConfig, "type"> = {
            message: "Success message",
            title: "Success",
        };

        const id = store.success(config);

        expect(store.notifications).toHaveLength(1);
        expect(store.notifications[0]).toMatchObject({
            id,
            type: "success",
            message: "Success message",
            title: "Success",
        });
    });

    it("should add error notification", () => {
        const store = useNotificationStore();
        const config: Omit<NotificationConfig, "type"> = {
            message: "Error message",
            title: "Error",
        };

        const id = store.error(config);

        expect(store.notifications).toHaveLength(1);
        expect(store.notifications[0]).toMatchObject({
            id,
            type: "error",
            message: "Error message",
            title: "Error",
        });
    });

    it("should add warning notification", () => {
        const store = useNotificationStore();
        const config: Omit<NotificationConfig, "type"> = {
            message: "Warning message",
        };

        const id = store.warning(config);

        expect(store.notifications).toHaveLength(1);
        expect(store.notifications[0]).toMatchObject({
            id,
            type: "warning",
            message: "Warning message",
        });
    });

    it("should add info notification", () => {
        const store = useNotificationStore();
        const config: Omit<NotificationConfig, "type"> = {
            message: "Info message",
        };

        const id = store.info(config);

        expect(store.notifications).toHaveLength(1);
        expect(store.notifications[0]).toMatchObject({
            id,
            type: "info",
            message: "Info message",
        });
    });

    it("should remove notification by id", () => {
        const store = useNotificationStore();
        const id1 = store.success({ message: "First" });
        const id2 = store.error({ message: "Second" });

        expect(store.notifications).toHaveLength(2);

        store.remove(id1);

        expect(store.notifications).toHaveLength(1);
        expect(store.notifications[0].id).toBe(id2);
    });

    it("should clear all notifications", () => {
        const store = useNotificationStore();
        store.success({ message: "First" });
        store.error({ message: "Second" });
        store.warning({ message: "Third" });

        expect(store.notifications).toHaveLength(3);

        store.clear();

        expect(store.notifications).toHaveLength(0);
    });

    it("should generate unique IDs for notifications", () => {
        const store = useNotificationStore();
        const id1 = store.success({ message: "First" });
        const id2 = store.success({ message: "Second" });

        expect(id1).not.toBe(id2);
        expect(typeof id1).toBe("string");
        expect(typeof id2).toBe("string");
    });

    it("should set default duration for notifications", () => {
        const store = useNotificationStore();
        const id = store.success({ message: "Test" });

        const notification = store.notifications.find((n) => n.id === id);
        expect(notification?.duration).toBe(4000);
    });

    it("should respect custom duration", () => {
        const store = useNotificationStore();
        const customDuration = 8000;
        const id = store.success({
            message: "Test",
            duration: customDuration,
        });

        const notification = store.notifications.find((n) => n.id === id);
        expect(notification?.duration).toBe(customDuration);
    });

    it("should handle persistent notifications", () => {
        const store = useNotificationStore();
        const id = store.error({
            message: "Persistent error",
            duration: 0,
        });

        const notification = store.notifications.find((n) => n.id === id);
        expect(notification?.duration).toBe(0);
    });
});
