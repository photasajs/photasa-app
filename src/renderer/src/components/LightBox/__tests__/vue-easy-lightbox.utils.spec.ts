import { describe, it, expect, beforeEach, vi } from "vitest";
import { mutateDragging, MutateDraggingOptions } from "../vue-easy-lightbox.utils";

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
