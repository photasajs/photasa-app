import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import VirtualizedGrid from "../VirtualizedGrid.vue";

const mockGetVirtualItems = vi.fn();
const mockGetTotalSize = vi.fn();
const mockMeasure = vi.fn();
const mockScrollToOffset = vi.fn();
const mockScrollToIndex = vi.fn();

vi.mock("@tanstack/vue-virtual", () => ({
    useVirtualizer: vi.fn(() =>
        ref({
            getVirtualItems: mockGetVirtualItems,
            getTotalSize: mockGetTotalSize,
            measure: mockMeasure,
            scrollToOffset: mockScrollToOffset,
            scrollToIndex: mockScrollToIndex,
            options: { count: 0 },
        }),
    ),
}));

function buildRows(rowCount: number, colsPerRow = 3): string[][] {
    return Array.from({ length: rowCount }, (_, rowIndex) =>
        Array.from({ length: colsPerRow }, (_, colIndex) => `r${rowIndex}c${colIndex}`),
    );
}

describe("VirtualizedGrid", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetTotalSize.mockReturnValue(5000);
        mockGetVirtualItems.mockReturnValue([
            { index: 0, start: 0, size: 166, key: 0 },
            { index: 1, start: 166, size: 166, key: 1 },
        ]);
    });

    it("仅渲染可见行对应的 DOM 节点", async () => {
        const wrapper = mount(VirtualizedGrid, {
            props: {
                rows: buildRows(100),
                rowHeight: 150,
                containerHeight: 400,
            },
            slots: {
                item: `<div class="grid-cell">{{ item }}</div>`,
            },
        });

        await flushPromises();

        expect(wrapper.findAll(".grid-cell")).toHaveLength(6);
        expect(wrapper.text()).toContain("r0c0");
        expect(wrapper.text()).not.toContain("r50c0");
    });

    it("支持外部滚动容器并暴露 scrollToOffset", async () => {
        const scrollElement = document.createElement("div");
        document.body.appendChild(scrollElement);

        const wrapper = mount(VirtualizedGrid, {
            props: {
                rows: buildRows(10),
                rowHeight: 150,
                resolveScrollElement: () => scrollElement,
            },
            slots: {
                item: `<div class="grid-cell">{{ item }}</div>`,
            },
            attachTo: document.body,
        });

        await flushPromises();

        expect(wrapper.find(".virtualized-grid").exists()).toBe(false);

        const exposed = wrapper.vm as unknown as {
            scrollToOffset: (offset: number) => void;
            measure: () => void;
        };
        exposed.scrollToOffset(120);
        exposed.measure();

        expect(mockScrollToOffset).toHaveBeenCalledWith(120, undefined);
        expect(mockMeasure).toHaveBeenCalled();

        wrapper.unmount();
        scrollElement.remove();
    });
});
