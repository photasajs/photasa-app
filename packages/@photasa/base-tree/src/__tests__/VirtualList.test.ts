import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import VirtualList from "../internal/VirtualList.vue";

const ITEM_HEIGHT = 28;
const CONTAINER_HEIGHT = 200;
const ITEM_COUNT = 60;

function createItems(count: number, prefix = "item"): Array<{ id: string; label: string }> {
    return Array.from({ length: count }, (_, index) => ({
        id: `${prefix}-${index}`,
        label: `Item ${index}`,
    }));
}

describe("VirtualList", () => {
    it("preserves scroll position when items are inserted (tree expand)", async () => {
        const initialItems = createItems(ITEM_COUNT);
        const wrapper = mount(VirtualList, {
            props: {
                items: initialItems,
                itemHeight: ITEM_HEIGHT,
                containerHeight: CONTAINER_HEIGHT,
                getItemKey: (item: { id: string }) => item.id,
            },
            attachTo: document.body,
        });

        await nextTick();

        const container = wrapper.find(".virtual-list-container").element as HTMLElement;
        const scrollOffset = ITEM_HEIGHT * 20;
        container.scrollTop = scrollOffset;
        container.dispatchEvent(new Event("scroll"));
        await nextTick();

        expect(container.scrollTop).toBe(scrollOffset);

        const expandedItems = [
            ...initialItems.slice(0, 11),
            ...createItems(5, "child"),
            ...initialItems.slice(11),
        ];

        const exposed = wrapper.vm as unknown as {
            captureScrollOffset: () => void;
        };
        exposed.captureScrollOffset();

        await wrapper.setProps({ items: expandedItems });
        await nextTick();

        expect(container.scrollTop).toBe(scrollOffset);

        wrapper.unmount();
    });

    it("restores scrollTop after small item insertions via items watcher", async () => {
        const initialItems = createItems(20);
        const wrapper = mount(VirtualList, {
            props: {
                items: initialItems,
                itemHeight: ITEM_HEIGHT,
                containerHeight: CONTAINER_HEIGHT,
                getItemKey: (item: { id: string }) => item.id,
            },
            attachTo: document.body,
        });

        await nextTick();

        const container = wrapper.find(".virtual-list-container").element as HTMLElement;
        container.scrollTop = ITEM_HEIGHT * 8;
        container.dispatchEvent(new Event("scroll"));
        await nextTick();

        const expandedItems = [
            ...initialItems.slice(0, 5),
            ...createItems(3, "child"),
            ...initialItems.slice(5),
        ];

        const exposed = wrapper.vm as unknown as {
            captureScrollOffset: () => void;
        };
        exposed.captureScrollOffset();

        await wrapper.setProps({ items: expandedItems });
        await nextTick();
        await nextTick();

        expect(container.scrollTop).toBe(ITEM_HEIGHT * 8);

        wrapper.unmount();
    });

    it("resolves item keys without index for virtualizer anchoring", async () => {
        const items = createItems(3);
        const wrapper = mount(VirtualList, {
            props: {
                items,
                itemHeight: ITEM_HEIGHT,
                containerHeight: CONTAINER_HEIGHT,
                getItemKey: (item: { id: string }, index: number) => item.id ?? index,
            },
        });

        await nextTick();

        const exposed = wrapper.vm as unknown as {
            virtualizer: { options: { getItemKey: (index: number) => string | number } };
        };
        const getItemKey = exposed.virtualizer.options.getItemKey;

        expect(getItemKey(0)).toBe("item-0");
        expect(getItemKey(2)).toBe("item-2");

        wrapper.unmount();
    });
});
