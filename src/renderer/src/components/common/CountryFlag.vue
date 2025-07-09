<template>
    <!-- 根据传入的 countryCode 渲染对应的 SVG 国旗，如果未找到则渲染默认图标 -->
    <component :is="flagComponent" class="country-flag" />
</template>

<script setup lang="ts">
/**
 * 国家国旗组件
 * 根据传入的国家代码，渲染对应的国旗 SVG 图标
 * 支持的国家代码包括：
 * - US: 美国
 * - CN: 中国
 * - JP: 日本
 * - KR: 韩国
 * - ES: 西班牙
 * - DE: 德国
 * - FR: 法国
 * - IT: 意大利
 * - TR: 土耳其
 * - VN: 越南
 * - SA: 沙特阿拉伯
 * - UA: 乌克兰
 * - GB: 英国
 * - RU: 俄罗斯
 */
// 静态 import 所有 SVG 文件，保持原有大小写
import US from "@renderer/assets/flags/US.svg?component"; // 美国国旗 SVG
import CN from "@renderer/assets/flags/CN.svg?component"; // 中国国旗 SVG
import JP from "@renderer/assets/flags/JP.svg?component"; // 日本国旗 SVG
import KR from "@renderer/assets/flags/KR.svg?component"; // 韩国国旗 SVG
import ES from "@renderer/assets/flags/ES.svg?component"; // 西班牙国旗 SVG
import DE from "@renderer/assets/flags/DE.svg?component"; // 德国国旗 SVG
import FR from "@renderer/assets/flags/FR.svg?component"; // 法国国旗 SVG
import IT from "@renderer/assets/flags/IT.svg?component"; // 意大利国旗 SVG
import TR from "@renderer/assets/flags/TR.svg?component"; // 土耳其国旗 SVG
import VN from "@renderer/assets/flags/VN.svg?component"; // 越南国旗 SVG
import SA from "@renderer/assets/flags/SA.svg?component"; // 沙特阿拉伯国旗 SVG
import UA from "@renderer/assets/flags/UA.svg?component"; // 乌克兰国旗 SVG
import GB from "@renderer/assets/flags/GB.svg?component"; // 英国国旗 SVG
import RU from "@renderer/assets/flags/RU.svg?component"; // 俄罗斯国旗 SVG

// 导入 vue 的 h 方法用于自定义渲染函数
import { h, computed } from "vue";

// 默认国旗图标组件（SVG 问号占位符）
const DefaultFlag = {
    // 渲染函数，返回一个 SVG 问号图标
    render() {
        // 使用 h() 创建 SVG 元素，兼容 Vue SFC
        return h("svg", { width: "24", height: "16", viewBox: "0 0 24 16" }, [
            h("rect", { width: "24", height: "16", fill: "#eee" }), // 灰色背景
            h(
                "text",
                { x: "12", y: "12", "text-anchor": "middle", "font-size": "10", fill: "#aaa" },
                "?",
            ), // 问号
        ]);
    },
};

// 构建国家代码与 SVG 组件的映射对象，全部大写，区分大小写
const flagMap: Record<string, any> = {
    "en-US": US,
    "zh-CN": CN,
    "ja-JP": JP,
    "ko-KR": KR,
    "es-ES": ES,
    "de-DE": DE,
    "fr-FR": FR,
    "it-IT": IT,
    "tr-TR": TR,
    "vi-VN": VN,
    "ar-SA": SA,
    "uk-UA": UA,
    "en-GB": GB,
    "ru-RU": RU,
};

// 定义 props，接收国家代码
const props = defineProps<{
    countryCode: string; // 国家代码，需与 flagMap 键一致
}>();

// 计算当前应显示的 SVG 组件
const flagComponent = computed(() => {
    // 统一将传入的国家代码转为大写后查找映射表
    return flagMap[props.countryCode] || DefaultFlag;
});
</script>

<style scoped>
/* 国旗组件样式，固定宽高，内联显示 */
.country-flag {
    width: 24px;
    height: 16px;
    display: inline-block;
    vertical-align: middle;
}
</style>
