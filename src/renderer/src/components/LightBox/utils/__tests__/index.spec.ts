import { describe, it, expect } from "vitest";
import {
    calculateNextIndex,
    calculatePrevIndex,
    validateIndex,
    calculateCursor,
    calculateZoomScale,
    normalizeRotation,
    shouldHandleWheel,
    getKeyboardAction,
    canMoveImage,
    shouldShowNavigationBtn,
    calculateMouseDelta,
} from "../index";

// ==================== 索引计算相关函数测试 ====================

describe("calculateNextIndex", () => {
    it("should return next index when not at end and not looping", () => {
        expect(calculateNextIndex(0, 5, false)).toBe(1);
        expect(calculateNextIndex(2, 5, false)).toBe(3);
    });

    it("should return null when at end and not looping", () => {
        expect(calculateNextIndex(4, 5, false)).toBeNull();
    });

    it("should loop to start when at end and looping", () => {
        expect(calculateNextIndex(4, 5, true)).toBe(0);
    });

    it("should handle single item with loop", () => {
        expect(calculateNextIndex(0, 1, true)).toBe(0);
    });

    it("should handle empty array", () => {
        expect(calculateNextIndex(0, 0, false)).toBeNull();
        expect(calculateNextIndex(0, 0, true)).toBeNaN();
    });
});

describe("calculatePrevIndex", () => {
    it("should return previous index when not at start and not looping", () => {
        expect(calculatePrevIndex(4, 5, false)).toBe(3);
        expect(calculatePrevIndex(2, 5, false)).toBe(1);
    });

    it("should return null when at start and not looping", () => {
        expect(calculatePrevIndex(0, 5, false)).toBeNull();
    });

    it("should loop to end when at start and looping", () => {
        expect(calculatePrevIndex(0, 5, true)).toBe(4);
    });

    it("should handle single item with loop", () => {
        expect(calculatePrevIndex(0, 1, true)).toBe(0);
    });
});

describe("validateIndex", () => {
    it("should return valid index unchanged", () => {
        expect(validateIndex(2, 5)).toBe(2);
        expect(validateIndex(0, 5)).toBe(0);
        expect(validateIndex(4, 5)).toBe(4);
    });

    it("should clamp index above range to max", () => {
        expect(validateIndex(10, 5)).toBe(4);
        expect(validateIndex(5, 5)).toBe(4);
    });

    it("should clamp negative index to 0", () => {
        expect(validateIndex(-1, 5)).toBe(0);
        expect(validateIndex(-10, 5)).toBe(0);
    });

    it("should handle empty array", () => {
        expect(validateIndex(0, 0)).toBe(0);
        expect(validateIndex(5, 0)).toBe(0);
        expect(validateIndex(-1, 0)).toBe(0);
    });
});

// ==================== 样式计算相关函数测试 ====================

describe("calculateCursor", () => {
    it("should return default cursor when load error", () => {
        expect(calculateCursor(true, false, false)).toBe("default");
        expect(calculateCursor(true, true, true)).toBe("default");
    });

    it("should return grab cursors when move disabled", () => {
        expect(calculateCursor(false, true, false)).toBe("grab");
        expect(calculateCursor(false, true, true)).toBe("grabbing");
    });

    it("should return move cursor when move enabled", () => {
        expect(calculateCursor(false, false, false)).toBe("move");
        expect(calculateCursor(false, false, true)).toBe("move");
    });
});

// ==================== 缩放和旋转计算函数测试 ====================

describe("calculateZoomScale", () => {
    const currentScale = 1.0;
    const zoomStep = 0.1;
    const maxZoom = 3.0;
    const minZoom = 0.1;
    const maxScale = 1.0;

    it("should zoom in correctly", () => {
        expect(calculateZoomScale(currentScale, zoomStep, "in", maxZoom, minZoom, maxScale)).toBe(
            1.1,
        );
        expect(calculateZoomScale(2.0, zoomStep, "in", maxZoom, minZoom, maxScale)).toBe(2.1);
    });

    it("should zoom out correctly", () => {
        expect(calculateZoomScale(currentScale, zoomStep, "out", maxZoom, minZoom, maxScale)).toBe(
            0.9,
        );
        expect(calculateZoomScale(2.0, zoomStep, "out", maxZoom, minZoom, maxScale)).toBe(1.9);
    });

    it("should return null when zoom in exceeds max", () => {
        expect(calculateZoomScale(3.0, zoomStep, "in", maxZoom, minZoom, maxScale)).toBeNull();
        expect(calculateZoomScale(2.95, zoomStep, "in", maxZoom, minZoom, maxScale)).toBeNull();
    });

    it("should return null when zoom out below min", () => {
        expect(calculateZoomScale(0.1, zoomStep, "out", maxZoom, minZoom, maxScale)).toBeNull();
        expect(calculateZoomScale(0.05, zoomStep, "out", maxZoom, minZoom, maxScale)).toBeNull();
    });

    it("should handle edge cases", () => {
        // Just at the boundary
        expect(calculateZoomScale(2.89, zoomStep, "in", maxZoom, minZoom, maxScale)).toBe(2.99);
        expect(calculateZoomScale(0.2, zoomStep, "out", maxZoom, minZoom, maxScale)).toBeNull();
    });
});

describe("normalizeRotation", () => {
    it("should normalize positive angles", () => {
        expect(normalizeRotation(45)).toBe(45);
        expect(normalizeRotation(90)).toBe(90);
        expect(normalizeRotation(180)).toBe(180);
        expect(normalizeRotation(270)).toBe(270);
        expect(normalizeRotation(360)).toBe(0);
        expect(normalizeRotation(450)).toBe(90);
        expect(normalizeRotation(720)).toBe(0);
    });

    it("should normalize negative angles", () => {
        expect(normalizeRotation(-45)).toBe(315);
        expect(normalizeRotation(-90)).toBe(270);
        expect(normalizeRotation(-180)).toBe(180);
        expect(normalizeRotation(-270)).toBe(90);
        expect(normalizeRotation(-360)).toBe(0);
        expect(normalizeRotation(-450)).toBe(270);
    });

    it("should handle zero and exact multiples", () => {
        expect(normalizeRotation(0)).toBe(0);
        expect(normalizeRotation(360)).toBe(0);
        expect(normalizeRotation(-360)).toBe(0);
    });
});

// ==================== 事件处理判断函数测试 ====================

describe("shouldHandleWheel", () => {
    const defaultStatus = {
        loadError: false,
        gesturing: false,
        loading: false,
        dragging: false,
        wheeling: false,
    };

    it("should return true when all conditions are met", () => {
        expect(shouldHandleWheel(defaultStatus, true, false)).toBe(true);
    });

    it("should return false when any blocking status is true", () => {
        expect(shouldHandleWheel({ ...defaultStatus, loadError: true }, true, false)).toBe(false);
        expect(shouldHandleWheel({ ...defaultStatus, gesturing: true }, true, false)).toBe(false);
        expect(shouldHandleWheel({ ...defaultStatus, loading: true }, true, false)).toBe(false);
        expect(shouldHandleWheel({ ...defaultStatus, dragging: true }, true, false)).toBe(false);
        expect(shouldHandleWheel({ ...defaultStatus, wheeling: true }, true, false)).toBe(false);
    });

    it("should return false when scroll is not disabled", () => {
        expect(shouldHandleWheel(defaultStatus, false, false)).toBe(false);
    });

    it("should return false when zoom is disabled", () => {
        expect(shouldHandleWheel(defaultStatus, true, true)).toBe(false);
    });
});

describe("getKeyboardAction", () => {
    it("should return close action for Escape key", () => {
        expect(getKeyboardAction("Escape", false, false)).toBe("close");
        expect(getKeyboardAction("Escape", true, false)).toBe("close");
    });

    it("should return null for Escape when disabled", () => {
        expect(getKeyboardAction("Escape", false, true)).toBeNull();
        expect(getKeyboardAction("Escape", true, true)).toBeNull();
    });

    it("should handle arrow keys in LTR mode", () => {
        expect(getKeyboardAction("ArrowLeft", false, false)).toBe("prev");
        expect(getKeyboardAction("ArrowRight", false, false)).toBe("next");
    });

    it("should handle arrow keys in RTL mode", () => {
        expect(getKeyboardAction("ArrowLeft", true, false)).toBe("next");
        expect(getKeyboardAction("ArrowRight", true, false)).toBe("prev");
    });

    it("should return null for unknown keys", () => {
        expect(getKeyboardAction("Space", false, false)).toBeNull();
        expect(getKeyboardAction("Enter", false, false)).toBeNull();
        expect(getKeyboardAction("a", false, false)).toBeNull();
    });
});

describe("canMoveImage", () => {
    it("should return false when move is disabled", () => {
        expect(canMoveImage(true, 0)).toBe(false);
        expect(canMoveImage(true, 1)).toBe(false);
        expect(canMoveImage(true, 2)).toBe(false);
    });

    it("should return true for left mouse button when move enabled", () => {
        expect(canMoveImage(false, 0)).toBe(true);
        expect(canMoveImage(false)).toBe(true); // default button = 0
    });

    it("should return false for non-left mouse buttons", () => {
        expect(canMoveImage(false, 1)).toBe(false); // right button
        expect(canMoveImage(false, 2)).toBe(false); // middle button
    });
});

describe("shouldShowNavigationBtn", () => {
    it("should not show buttons when only one image", () => {
        expect(shouldShowNavigationBtn(1, 0, false, "prev")).toEqual({
            show: false,
            disabled: true,
        });
        expect(shouldShowNavigationBtn(1, 0, true, "prev")).toEqual({
            show: false,
            disabled: true,
        });
        expect(shouldShowNavigationBtn(1, 0, false, "next")).toEqual({
            show: false,
            disabled: true,
        });
        expect(shouldShowNavigationBtn(1, 0, true, "next")).toEqual({
            show: false,
            disabled: true,
        });
    });

    it("should not show buttons when no images", () => {
        expect(shouldShowNavigationBtn(0, 0, false, "prev")).toEqual({
            show: false,
            disabled: true,
        });
        expect(shouldShowNavigationBtn(0, 0, true, "next")).toEqual({
            show: false,
            disabled: true,
        });
    });

    describe("prev button", () => {
        it("should be disabled at first image when not looping", () => {
            expect(shouldShowNavigationBtn(5, 0, false, "prev")).toEqual({
                show: true,
                disabled: true,
            });
        });

        it("should be enabled at first image when looping", () => {
            expect(shouldShowNavigationBtn(5, 0, true, "prev")).toEqual({
                show: true,
                disabled: false,
            });
        });

        it("should be enabled at middle images", () => {
            expect(shouldShowNavigationBtn(5, 2, false, "prev")).toEqual({
                show: true,
                disabled: false,
            });
            expect(shouldShowNavigationBtn(5, 2, true, "prev")).toEqual({
                show: true,
                disabled: false,
            });
        });
    });

    describe("next button", () => {
        it("should be disabled at last image when not looping", () => {
            expect(shouldShowNavigationBtn(5, 4, false, "next")).toEqual({
                show: true,
                disabled: true,
            });
        });

        it("should be enabled at last image when looping", () => {
            expect(shouldShowNavigationBtn(5, 4, true, "next")).toEqual({
                show: true,
                disabled: false,
            });
        });

        it("should be enabled at middle images", () => {
            expect(shouldShowNavigationBtn(5, 2, false, "next")).toEqual({
                show: true,
                disabled: false,
            });
            expect(shouldShowNavigationBtn(5, 2, true, "next")).toEqual({
                show: true,
                disabled: false,
            });
        });
    });
});

// ==================== 坐标计算函数测试 ====================

describe("calculateMouseDelta", () => {
    it("should calculate positive deltas correctly", () => {
        const currentPos = { x: 150, y: 200 };
        const lastPos = { x: 100, y: 150 };
        const result = calculateMouseDelta(currentPos, lastPos);

        expect(result).toEqual({ dx: 50, dy: 50 });
    });

    it("should calculate negative deltas correctly", () => {
        const currentPos = { x: 50, y: 75 };
        const lastPos = { x: 100, y: 150 };
        const result = calculateMouseDelta(currentPos, lastPos);

        expect(result).toEqual({ dx: -50, dy: -75 });
    });

    it("should handle zero delta", () => {
        const pos = { x: 100, y: 200 };
        const result = calculateMouseDelta(pos, pos);

        expect(result).toEqual({ dx: 0, dy: 0 });
    });

    it("should handle mixed positive/negative deltas", () => {
        const currentPos = { x: 80, y: 250 };
        const lastPos = { x: 120, y: 200 };
        const result = calculateMouseDelta(currentPos, lastPos);

        expect(result).toEqual({ dx: -40, dy: 50 });
    });

    it("should handle floating point coordinates", () => {
        const currentPos = { x: 100.5, y: 200.75 };
        const lastPos = { x: 100.25, y: 200.25 };
        const result = calculateMouseDelta(currentPos, lastPos);

        expect(result.dx).toBeCloseTo(0.25);
        expect(result.dy).toBeCloseTo(0.5);
    });
});
