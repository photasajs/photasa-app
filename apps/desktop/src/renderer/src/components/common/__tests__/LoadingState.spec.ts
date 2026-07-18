import { mount } from "@vue/test-utils";
import LoadingState from "../LoadingState.vue";
import SkeletonList from "../SkeletonList.vue";
import { describe, it, expect } from "vitest";

describe("LoadingState", () => {
    it("renders loadingText and spinner", () => {
        const wrapper = mount(LoadingState, { props: { loadingText: "测试加载" } });
        expect(wrapper.text()).toContain("测试加载");
        expect(wrapper.find("svg").exists()).toBe(true);
    });

    it("renders custom size", () => {
        const wrapper = mount(LoadingState, { props: { size: 60 } });
        expect(wrapper.find("svg").attributes("width")).toBe("60");
    });

    it("renders skeleton slot", () => {
        const wrapper = mount(LoadingState, {
            slots: {
                skeleton: SkeletonList,
            },
        });
        expect(wrapper.findComponent(SkeletonList).exists()).toBe(true);
    });
});
