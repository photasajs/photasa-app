import { describe, it, expect, beforeEach, vi } from "vitest";
import { showThemeNotification, themeNotification } from "../theme-notification";
import { notification } from "@renderer/services/notification-manager";

// Mock the notification manager
vi.mock("@renderer/services/notification-manager", () => ({
    notification: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

describe("Theme Notification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("showThemeNotification", () => {
        it("should call notification.success for success type", () => {
            showThemeNotification("success", "Test message", "Test title");

            expect(notification.success).toHaveBeenCalledWith({
                message: "Test message",
                title: "Test title",
                duration: 4500,
            });
        });

        it("should call notification.error for error type", () => {
            showThemeNotification("error", "Error message");

            expect(notification.error).toHaveBeenCalledWith({
                message: "Error message",
                title: undefined,
                duration: 4500,
            });
        });

        it("should call notification.warning for warning type", () => {
            showThemeNotification("warning", "Warning message", "Warning title");

            expect(notification.warning).toHaveBeenCalledWith({
                message: "Warning message",
                title: "Warning title",
                duration: 4500,
            });
        });

        it("should call notification.info for info type", () => {
            showThemeNotification("info", "Info message");

            expect(notification.info).toHaveBeenCalledWith({
                message: "Info message",
                title: undefined,
                duration: 4500,
            });
        });
    });

    describe("themeNotification", () => {
        it("should handle success with string message", () => {
            themeNotification.success("Success message");

            expect(notification.success).toHaveBeenCalledWith({
                message: "Success message",
            });
        });

        it("should handle success with config object", () => {
            const config = { message: "Success message", title: "Success" };
            themeNotification.success(config);

            expect(notification.success).toHaveBeenCalledWith(config);
        });

        it("should handle error with string message", () => {
            themeNotification.error("Error message");

            expect(notification.error).toHaveBeenCalledWith({
                message: "Error message",
            });
        });

        it("should handle error with config object", () => {
            const config = { message: "Error message", title: "Error" };
            themeNotification.error(config);

            expect(notification.error).toHaveBeenCalledWith(config);
        });

        it("should handle warning with string message", () => {
            themeNotification.warning("Warning message");

            expect(notification.warning).toHaveBeenCalledWith({
                message: "Warning message",
            });
        });

        it("should handle warning with config object", () => {
            const config = { message: "Warning message", title: "Warning" };
            themeNotification.warning(config);

            expect(notification.warning).toHaveBeenCalledWith(config);
        });

        it("should handle info with string message", () => {
            themeNotification.info("Info message");

            expect(notification.info).toHaveBeenCalledWith({
                message: "Info message",
            });
        });

        it("should handle info with config object", () => {
            const config = { message: "Info message", title: "Info" };
            themeNotification.info(config);

            expect(notification.info).toHaveBeenCalledWith(config);
        });
    });

    describe("getThemeColors", () => {
        beforeEach(() => {
            // Mock getComputedStyle
            Object.defineProperty(window, "getComputedStyle", {
                value: vi.fn(() => ({
                    getPropertyValue: vi.fn((prop: string) => {
                        const mockColors: Record<string, string> = {
                            "--color-primary": "#1890ff",
                            "--color-text": "#000000",
                            "--color-card-bg": "#ffffff",
                            "--color-card-border": "#d9d9d9",
                            "--color-success": "#52c41a",
                            "--color-warning": "#faad14",
                            "--color-danger": "#ff4d4f",
                            "--color-info": "#1890ff",
                        };
                        return mockColors[prop] || "";
                    }),
                })),
                writable: true,
            });
        });

        it("should return theme colors from CSS variables", async () => {
            const { getThemeColors } = await import("../theme-notification");
            const colors = getThemeColors();

            expect(colors).toEqual({
                primary: "#1890ff",
                text: "#000000",
                background: "#ffffff",
                border: "#d9d9d9",
                success: "#52c41a",
                warning: "#faad14",
                danger: "#ff4d4f",
                info: "#1890ff",
            });
        });
    });
});
