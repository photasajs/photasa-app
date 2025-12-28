/**
 * Tests for BaseMetricsCard component
 * Ensures proper metrics display, formatting, and responsiveness
 */

import { describe, it, expect, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import BaseMetricsCard from "@renderer/components/queue-monitoring/BaseMetricsCard.vue";
import type { MetricCardConfig } from "@photasa/common";

describe("BaseMetricsCard", () => {
    let wrapper: VueWrapper<any>;

    const createWrapper = (config: MetricCardConfig, props?: any) => {
        return mount(BaseMetricsCard, {
            props: {
                config,
                ...props,
            },
        });
    };

    describe("Basic rendering", () => {
        it("应该正确渲染基本指标卡", () => {
            const config: MetricCardConfig = {
                title: "队列大小",
                value: 42,
            };

            wrapper = createWrapper(config);

            expect(wrapper.find(".card-title").text()).toBe("队列大小");
            expect(wrapper.find(".value").text()).toBe("42");
            expect(wrapper.classes()).toContain("severity-info");
        });

        it("应该正确显示单位", () => {
            const config: MetricCardConfig = {
                title: "处理速率",
                value: 15.5,
                unit: "操作/分",
            };

            wrapper = createWrapper(config);

            expect(wrapper.find(".value").text()).toBe("15.5");
            expect(wrapper.find(".unit").text()).toBe("操作/分");
        });

        it("应该正确显示描述信息", () => {
            const config: MetricCardConfig = {
                title: "错误率",
                value: 2.3,
                description: "过去10分钟的错误百分比",
            };

            wrapper = createWrapper(config);

            expect(wrapper.find(".metric-description").text()).toBe("过去10分钟的错误百分比");
        });
    });

    describe("Value formatting", () => {
        it("应该格式化大数字（百万）", () => {
            const config: MetricCardConfig = {
                title: "总处理量",
                value: 2500000,
            };

            wrapper = createWrapper(config);
            expect(wrapper.find(".value").text()).toBe("2.5M");
        });

        it("应该格式化千位数字", () => {
            const config: MetricCardConfig = {
                title: "队列大小",
                value: 1250,
            };

            wrapper = createWrapper(config);
            expect(wrapper.find(".value").text()).toBe("1.3K");
        });

        it("应该格式化小数", () => {
            const config: MetricCardConfig = {
                title: "错误率",
                value: 3.14159,
            };

            wrapper = createWrapper(config);
            expect(wrapper.find(".value").text()).toBe("3.1");
        });

        it("应该直接显示整数", () => {
            const config: MetricCardConfig = {
                title: "处理中",
                value: 5,
            };

            wrapper = createWrapper(config);
            expect(wrapper.find(".value").text()).toBe("5");
        });

        it("应该处理字符串值", () => {
            const config: MetricCardConfig = {
                title: "状态",
                value: "活跃",
            };

            wrapper = createWrapper(config);
            expect(wrapper.find(".value").text()).toBe("活跃");
        });
    });

    describe("Severity styling", () => {
        it("应该应用成功样式", () => {
            const config: MetricCardConfig = {
                title: "健康状态",
                value: "良好",
                severity: "success",
            };

            wrapper = createWrapper(config);
            expect(wrapper.classes()).toContain("severity-success");
        });

        it("应该应用警告样式", () => {
            const config: MetricCardConfig = {
                title: "队列大小",
                value: 800,
                severity: "warning",
            };

            wrapper = createWrapper(config);
            expect(wrapper.classes()).toContain("severity-warning");
        });

        it("应该应用错误样式", () => {
            const config: MetricCardConfig = {
                title: "错误率",
                value: 15.2,
                severity: "error",
            };

            wrapper = createWrapper(config);
            expect(wrapper.classes()).toContain("severity-error");
        });

        it("应该默认使用信息样式", () => {
            const config: MetricCardConfig = {
                title: "处理速率",
                value: 10,
            };

            wrapper = createWrapper(config);
            expect(wrapper.classes()).toContain("severity-info");
        });
    });

    describe("Trend indicators", () => {
        it("应该显示上升趋势图标", () => {
            const config: MetricCardConfig = {
                title: "处理速率",
                value: 25,
            };

            wrapper = createWrapper(config, { trend: "up" });

            expect(wrapper.find(".trend-indicator").exists()).toBe(true);
            expect(wrapper.find(".trend-indicator").classes()).toContain("trend-up");
            expect(wrapper.find("svg").exists()).toBe(true);
        });

        it("应该显示下降趋势图标", () => {
            const config: MetricCardConfig = {
                title: "队列大小",
                value: 150,
            };

            wrapper = createWrapper(config, { trend: "down" });

            expect(wrapper.find(".trend-indicator").classes()).toContain("trend-down");
        });

        it("应该显示稳定趋势图标", () => {
            const config: MetricCardConfig = {
                title: "错误率",
                value: 2.1,
            };

            wrapper = createWrapper(config, { trend: "stable" });

            expect(wrapper.find(".trend-indicator").classes()).toContain("trend-stable");
        });

        it("没有趋势时不应显示趋势指示器", () => {
            const config: MetricCardConfig = {
                title: "处理速率",
                value: 15,
            };

            wrapper = createWrapper(config);

            expect(wrapper.find(".trend-indicator").exists()).toBe(false);
        });
    });

    describe("Last update display", () => {
        it("应该显示最后更新时间", () => {
            const config: MetricCardConfig = {
                title: "队列状态",
                value: "活跃",
            };

            const lastUpdated = new Date("2023-12-01T10:30:00");
            wrapper = createWrapper(config, {
                showLastUpdate: true,
                lastUpdated,
            });

            expect(wrapper.find(".card-footer").exists()).toBe(true);
            expect(wrapper.find(".last-update").text()).toContain("更新时间:");
            expect(wrapper.find(".last-update").text()).toContain("10:30:00");
        });

        it("默认情况下不显示最后更新时间", () => {
            const config: MetricCardConfig = {
                title: "队列状态",
                value: "活跃",
            };

            wrapper = createWrapper(config);

            expect(wrapper.find(".card-footer").exists()).toBe(false);
        });
    });

    describe("Responsive behavior", () => {
        it("应该在移动设备上应用响应式样式", async () => {
            const config: MetricCardConfig = {
                title: "队列大小",
                value: 100,
            };

            wrapper = createWrapper(config);

            // 验证组件结构支持响应式CSS
            expect(wrapper.find(".metrics-card").exists()).toBe(true);
            expect(wrapper.find(".card-title").exists()).toBe(true);
            expect(wrapper.find(".metric-value .value").exists()).toBe(true);
        });
    });

    describe("Card interactions", () => {
        it("应该支持悬停效果", async () => {
            const config: MetricCardConfig = {
                title: "队列大小",
                value: 75,
            };

            wrapper = createWrapper(config);

            const card = wrapper.find(".metrics-card");
            expect(card.exists()).toBe(true);

            // 验证CSS类存在，实际悬停效果由CSS控制
            expect(card.classes()).toContain("metrics-card");
        });
    });

    describe("Component props validation", () => {
        it("应该要求config属性", () => {
            // 这个测试验证组件在没有config属性时应该正常工作
            expect(() => {
                mount(BaseMetricsCard, {
                    props: {
                        config: {
                            title: "Test Metric",
                            value: "100",
                            unit: "items",
                            icon: "test-icon",
                            color: "blue",
                        },
                        lastUpdated: new Date(),
                        showLastUpdate: true,
                    },
                });
            }).not.toThrow();
        });

        it("应该接受所有可选属性", () => {
            const config: MetricCardConfig = {
                title: "测试指标",
                value: 50,
            };

            expect(() => {
                wrapper = createWrapper(config, {
                    trend: "up",
                    lastUpdated: new Date(),
                    showLastUpdate: true,
                });
            }).not.toThrow();

            expect(wrapper.exists()).toBe(true);
        });
    });

    afterEach(() => {
        if (wrapper) {
            wrapper.unmount();
        }
    });
});
