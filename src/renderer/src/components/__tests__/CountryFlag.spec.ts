import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CountryFlag from "../common/CountryFlag.vue";

// 所有支持的国家代码（全部大写，区分大小写）
const supportedCodes = [
    "US",
    "CN",
    "JP",
    "KR",
    "ES",
    "DE",
    "FR",
    "IT",
    "TR",
    "VN",
    "SA",
    "UA",
    "GB",
    "RU",
];

describe("CountryFlag.vue", () => {
    supportedCodes.forEach((code) => {
        it(`传入国家代码 ${code} 时应渲染对应 SVG`, () => {
            // 挂载组件，传入国家代码
            const wrapper = mount(CountryFlag, {
                props: { countryCode: code },
            });

            // 断言渲染的根节点为 svg 组件（SVG 内联）
            expect(wrapper.find("svg").exists()).toBe(true);
        });
    });

    // 测试传入不存在的国家代码时，渲染默认 SVG
    it("传入不存在的国家代码时应渲染默认问号 SVG", () => {
        const wrapper = mount(CountryFlag, {
            props: { countryCode: "ZZ" }, // 不存在的国家代码
        });
        // 断言渲染的 svg 存在
        expect(wrapper.find("svg").exists()).toBe(true);
        // 断言渲染了问号
        expect(wrapper.find("text").text()).toBe("?");
    });

    // 测试不传入国家代码时，渲染默认 SVG
    it("不传入国家代码时应渲染默认问号 SVG", () => {
        const wrapper = mount(CountryFlag, {
            props: { countryCode: "" },
        });
        expect(wrapper.find("svg").exists()).toBe(true);
        expect(wrapper.find("text").text()).toBe("?");
    });
});
