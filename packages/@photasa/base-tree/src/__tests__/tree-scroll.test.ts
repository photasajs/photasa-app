import { describe, it, expect } from "vitest";
import {
    isElementInScrollContainer,
    isFixedItemIndexInScrollViewport,
    restoreScrollContainerOffset,
} from "../tree-scroll";

describe("tree-scroll", () => {
    describe("isFixedItemIndexInScrollViewport", () => {
        const base = { itemHeight: 34, viewportHeight: 200 };

        it("returns true when item is fully inside viewport", () => {
            expect(isFixedItemIndexInScrollViewport({ ...base, index: 2, scrollTop: 0 })).toBe(
                true,
            );
            expect(isFixedItemIndexInScrollViewport({ ...base, index: 5, scrollTop: 100 })).toBe(
                true,
            );
        });

        it("returns false when item is above or below viewport", () => {
            expect(isFixedItemIndexInScrollViewport({ ...base, index: 0, scrollTop: 100 })).toBe(
                false,
            );
            expect(isFixedItemIndexInScrollViewport({ ...base, index: 10, scrollTop: 0 })).toBe(
                false,
            );
        });
    });

    describe("isElementInScrollContainer", () => {
        it("returns true when element rect fits inside container rect", () => {
            const container = {
                getBoundingClientRect: () => ({
                    top: 0,
                    bottom: 300,
                    left: 0,
                    right: 200,
                }),
            } as Element;
            const element = {
                getBoundingClientRect: () => ({
                    top: 50,
                    bottom: 84,
                    left: 10,
                    right: 180,
                }),
            } as Element;

            expect(isElementInScrollContainer(element, container)).toBe(true);
        });

        it("returns false when element extends outside container", () => {
            const container = {
                getBoundingClientRect: () => ({
                    top: 100,
                    bottom: 300,
                    left: 0,
                    right: 200,
                }),
            } as Element;
            const element = {
                getBoundingClientRect: () => ({
                    top: 50,
                    bottom: 120,
                    left: 10,
                    right: 180,
                }),
            } as Element;

            expect(isElementInScrollContainer(element, container)).toBe(false);
        });
    });

    describe("restoreScrollContainerOffset", () => {
        it("sets scrollTop and invokes virtualizer callback", () => {
            const container = document.createElement("div");
            const offsets: number[] = [];
            restoreScrollContainerOffset(container, 272, (offset) => {
                offsets.push(offset);
            });

            expect(container.scrollTop).toBe(272);
            expect(offsets).toEqual([272]);
        });
    });
});
