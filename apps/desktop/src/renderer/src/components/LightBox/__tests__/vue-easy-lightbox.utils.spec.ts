import { describe, it, expect, vi, beforeEach } from "vitest";
import { mutateDragging, MutateDraggingOptions, isImg, zoom } from "../vue-easy-lightbox.utils";
import type { Img, IImgState, IImgWrapperState } from "../types";

describe("mutateDragging", () => {
    let onNext: ReturnType<typeof vi.fn>;
    let onPrev: ReturnType<typeof vi.fn>;
    let canMove: ReturnType<typeof vi.fn>;
    let imgWrapperState: MutateDraggingOptions["imgWrapperState"];
    const swipeTolerance = 30;

    beforeEach(() => {
        onNext = vi.fn();
        onPrev = vi.fn();
        canMove = vi.fn();
        imgWrapperState = {
            lastX: 0,
            lastY: 0,
            initX: 0,
            initY: 0,
        };
    });

    it("should call onNext when swiped left beyond tolerance and cannot move", () => {
        canMove.mockReturnValue(false);
        imgWrapperState.initX = 100;
        imgWrapperState.lastX = 60; // xDiff = -40
        imgWrapperState.initY = 0;
        imgWrapperState.lastY = 0;
        mutateDragging(false, true, { onNext, onPrev, canMove, imgWrapperState, swipeTolerance });
        expect(onNext).toHaveBeenCalled();
        expect(onPrev).not.toHaveBeenCalled();
    });

    it("should call onPrev when swiped right beyond tolerance and cannot move", () => {
        canMove.mockReturnValue(false);
        imgWrapperState.initX = 100;
        imgWrapperState.lastX = 140; // xDiff = 40
        imgWrapperState.initY = 0;
        imgWrapperState.lastY = 0;
        mutateDragging(false, true, { onNext, onPrev, canMove, imgWrapperState, swipeTolerance });
        expect(onPrev).toHaveBeenCalled();
        expect(onNext).not.toHaveBeenCalled();
    });

    it("should not call onNext/onPrev if moved vertically more than horizontally", () => {
        canMove.mockReturnValue(false);
        imgWrapperState.initX = 100;
        imgWrapperState.lastX = 110; // xDiff = 10
        imgWrapperState.initY = 0;
        imgWrapperState.lastY = 50; // yDiff = 50
        mutateDragging(false, true, { onNext, onPrev, canMove, imgWrapperState, swipeTolerance });
        expect(onNext).not.toHaveBeenCalled();
        expect(onPrev).not.toHaveBeenCalled();
    });

    it("should not call onNext/onPrev if canMove returns true", () => {
        canMove.mockReturnValue(true);
        imgWrapperState.initX = 100;
        imgWrapperState.lastX = 60; // xDiff = -40
        imgWrapperState.initY = 0;
        imgWrapperState.lastY = 0;
        mutateDragging(false, true, { onNext, onPrev, canMove, imgWrapperState, swipeTolerance });
        expect(onNext).not.toHaveBeenCalled();
        expect(onPrev).not.toHaveBeenCalled();
    });

    it("should not call onNext/onPrev if not dragged (newStatus=true)", () => {
        canMove.mockReturnValue(false);
        imgWrapperState.initX = 100;
        imgWrapperState.lastX = 60;
        imgWrapperState.initY = 0;
        imgWrapperState.lastY = 0;
        mutateDragging(true, false, { onNext, onPrev, canMove, imgWrapperState, swipeTolerance });
        expect(onNext).not.toHaveBeenCalled();
        expect(onPrev).not.toHaveBeenCalled();
    });
});

describe("isImg", () => {
    it("should return true for valid Img object", () => {
        const img: Img = { src: "a.jpg" };
        expect(isImg(img)).toBe(true);
    });
    it("should return false for object without src", () => {
        const img: Img = {};
        expect(isImg(img)).toBe(false);
    });
    it("should return false for non-object", () => {
        expect(isImg({} as Img)).toBe(false);
        // @ts-expect-error Testing null as invalid Img
        expect(isImg(null)).toBe(false);
        // @ts-expect-error Testing undefined as invalid Img
        expect(isImg(undefined)).toBe(false);
    });
});

describe("zoom", () => {
    let imgState: IImgState;
    let imgWrapperState: IImgWrapperState;

    beforeEach(() => {
        imgState = { maxScale: 2, width: 100, height: 100 };
        imgWrapperState = {
            lastScale: 1,
            scale: 1,
            rotateDeg: 0,
            top: 0,
            left: 0,
            initX: 0,
            initY: 0,
            lastX: 0,
            lastY: 0,
            touches: [],
        };
    });

    it("should snap to 1 if newScale is close to 1", () => {
        zoom(1.01, imgState, imgWrapperState);
        expect(imgWrapperState.scale).toBe(1);
    });

    it("should snap to maxScale if newScale is close to maxScale", () => {
        zoom(1.96, imgState, imgWrapperState);
        expect(imgWrapperState.scale).toBe(2);
    });

    it("should set scale to newScale if not close to 1 or maxScale", () => {
        zoom(1.5, imgState, imgWrapperState);
        expect(imgWrapperState.scale).toBe(1.5);
    });

    it("should update lastScale to previous scale", () => {
        imgWrapperState.scale = 1.2;
        zoom(1.5, imgState, imgWrapperState);
        expect(imgWrapperState.lastScale).toBe(1.2);
    });
});
