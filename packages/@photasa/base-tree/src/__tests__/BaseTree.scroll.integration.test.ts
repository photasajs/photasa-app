import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import BaseTree from "../BaseTree.vue";
import type { TreeNode } from "../types";

const ROW_HEIGHT = 34;

function buildWideTree(rootCount: number, childrenPerRoot: number): TreeNode[] {
    return Array.from({ length: rootCount }, (_, rootIndex) => ({
        key: `root-${rootIndex}`,
        title: `Root ${rootIndex}`,
        children: Array.from({ length: childrenPerRoot }, (_, childIndex) => ({
            key: `root-${rootIndex}/child-${childIndex}`,
            title: `Child ${childIndex}`,
        })),
    }));
}

describe("BaseTree scroll integration", () => {
    it("keeps scroll position when expanding a visible node (virtual)", async () => {
        const treeData = buildWideTree(30, 8);
        const wrapper = mount(BaseTree, {
            props: {
                treeData,
                virtual: true,
                height: 400,
                itemHeight: ROW_HEIGHT,
                expandedKeys: [],
            },
            attachTo: document.body,
        });

        await nextTick();

        const scrollContainer = wrapper.find(".virtual-list-container").element as HTMLElement;
        const scrollOffset = ROW_HEIGHT * 12;
        scrollContainer.scrollTop = scrollOffset;
        scrollContainer.dispatchEvent(new Event("scroll"));
        await nextTick();

        const expandTarget = treeData[12];
        const handleNodeExpand = (wrapper.vm as { $: { setupState: Record<string, unknown> } }).$
            .setupState.handleNodeExpand as (node: TreeNode, expanded: boolean) => void;

        handleNodeExpand(expandTarget, true);
        await wrapper.setProps({ expandedKeys: [expandTarget.key] });
        await nextTick();
        await nextTick();
        await nextTick();

        expect(scrollContainer.scrollTop).toBe(scrollOffset);

        wrapper.unmount();
    });

    it("keeps scroll position when expanding a visible node (non-virtual)", async () => {
        const treeData = buildWideTree(30, 4);
        const wrapper = mount(BaseTree, {
            props: {
                treeData,
                virtual: false,
                height: 400,
                expandedKeys: [],
            },
            attachTo: document.body,
        });

        await nextTick();

        const scrollContainer = wrapper.find(".base-tree").element as HTMLElement;
        scrollContainer.style.height = "400px";
        scrollContainer.style.overflow = "auto";

        const scrollOffset = 320;
        scrollContainer.scrollTop = scrollOffset;
        scrollContainer.dispatchEvent(new Event("scroll"));
        await nextTick();

        const expandTarget = treeData[10];
        const handleNodeExpand = (wrapper.vm as { $: { setupState: Record<string, unknown> } }).$
            .setupState.handleNodeExpand as (node: TreeNode, expanded: boolean) => void;

        handleNodeExpand(expandTarget, true);
        await wrapper.setProps({ expandedKeys: [expandTarget.key] });
        await nextTick();

        expect(scrollContainer.scrollTop).toBe(scrollOffset);

        wrapper.unmount();
    });
});
