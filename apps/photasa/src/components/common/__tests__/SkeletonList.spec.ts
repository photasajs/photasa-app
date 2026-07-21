import { mount } from "@vue/test-utils";
import SkeletonList from "../SkeletonList.vue";
import { describe, it, expect } from "vitest";

describe("SkeletonList", () => {
    it("renders correct number of skeleton items", () => {
        const wrapper = mount(SkeletonList, { props: { count: 6, rows: 3 } });
        // 6个骨架块，rows=3，渲染2行，每行最多3个
        expect(wrapper.findAll(".skeleton-item").length).toBe(6);
        expect(wrapper.findAll(".skeleton-list > .flex").length).toBe(2); // 2行
    });

    it("applies width, height, borderRadius, gap props", () => {
        const wrapper = mount(SkeletonList, {
            props: { count: 2, width: 120, height: 80, borderRadius: 8, gap: 10 },
        });
        const item = wrapper.find(".skeleton-item");
        expect(item.attributes("style")).toContain("width: 120px");
        expect(item.attributes("style")).toContain("height: 80px");
        expect(item.attributes("style")).toContain("border-radius: 8px");
    });

    it("renders single row by default", () => {
        const wrapper = mount(SkeletonList, { props: { count: 4 } });
        // 默认 rows=1，4个骨架块，每个单独一行
        expect(wrapper.findAll(".skeleton-list > .flex").length).toBe(4);
        expect(wrapper.findAll(".skeleton-item").length).toBe(4);
    });
});
