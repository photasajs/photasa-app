import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { notification } from "../notification-manager";
import { useNotificationStore } from "@renderer/stores/notification";

// Mock the store
vi.mock("@renderer/stores/notification", () => ({
    useNotificationStore: vi.fn(),
}));

describe("Notification Manager", () => {
    let mockStore: any;

    beforeEach(() => {
        setActivePinia(createPinia());

        mockStore = {
            success: vi.fn().mockReturnValue("success-id"),
            error: vi.fn().mockReturnValue("error-id"),
            warning: vi.fn().mockReturnValue("warning-id"),
            info: vi.fn().mockReturnValue("info-id"),
            remove: vi.fn(),
            clear: vi.fn(),
        };

        vi.mocked(useNotificationStore).mockReturnValue(mockStore);
    });

    describe("notification global object", () => {
        it("should have all methods bound correctly", () => {
            expect(typeof notification.success).toBe("function");
            expect(typeof notification.error).toBe("function");
            expect(typeof notification.warning).toBe("function");
            expect(typeof notification.info).toBe("function");
            expect(typeof notification.remove).toBe("function");
            expect(typeof notification.clear).toBe("function");
        });

        it("should call success method", () => {
            const id = notification.success("Global success");

            expect(mockStore.success).toHaveBeenCalledWith({ message: "Global success" });
            expect(id).toBe("success-id");
        });

        it("should call error method", () => {
            const id = notification.error("Global error");

            expect(mockStore.error).toHaveBeenCalledWith({ message: "Global error" });
            expect(id).toBe("error-id");
        });

        it("should call warning method", () => {
            const id = notification.warning("Global warning");

            expect(mockStore.warning).toHaveBeenCalledWith({ message: "Global warning" });
            expect(id).toBe("warning-id");
        });

        it("should call info method", () => {
            const id = notification.info("Global info");

            expect(mockStore.info).toHaveBeenCalledWith({ message: "Global info" });
            expect(id).toBe("info-id");
        });

        it("should call remove method", () => {
            notification.remove("global-test-id");

            expect(mockStore.remove).toHaveBeenCalledWith("global-test-id");
        });

        it("should call clear method", () => {
            notification.clear();

            expect(mockStore.clear).toHaveBeenCalled();
        });
    });
});
