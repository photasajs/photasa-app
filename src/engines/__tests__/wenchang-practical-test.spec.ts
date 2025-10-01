/**
 * 文昌引擎实际使用验证测试
 * 验证文昌引擎在人界（用户界面）的实际使用场景
 */

import { TaiyiEngine } from "../taiyi/core/TaiyiEngine";
import { WenchangAdapter } from "../adapters/WenchangAdapter";

describe("文昌引擎人界集成验证", () => {
    let taiyiEngine: TaiyiEngine;
    let wenchangAdapter: WenchangAdapter;

    beforeEach(async () => {
        // 初始化文昌适配器
        wenchangAdapter = new WenchangAdapter();
        await wenchangAdapter.initialize();

        // 初始化太乙引擎
        taiyiEngine = new TaiyiEngine({
            enableHealthCheck: false,
        });
        await taiyiEngine.initialize();
    });

    afterEach(async () => {
        await taiyiEngine?.shutdown();
        await wenchangAdapter?.shutdown();
    });

    describe("用户偏好管理 - 实际使用场景", () => {
        it("应该能够获取当前用户偏好设置", async () => {
            const result = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");

            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();
            expect(result.result).toHaveProperty("ui");
            expect(result.result).toHaveProperty("display");
            expect(result.result).toHaveProperty("scan");

            console.log("当前用户偏好设置：", JSON.stringify(result.result, null, 2));
        });

        it("应该能够更新UI主题设置", async () => {
            // 模拟用户在界面上切换主题
            const updateResult = await taiyiEngine.callEngine("wenchang", "updatePreferences", {
                ui: {
                    theme: "dark",
                },
            });

            expect(updateResult.success).toBe(true);
            expect(updateResult.result).toBeDefined();
            expect(updateResult.result.success).toBe(true);

            // 验证更新后的设置
            const verifyResult = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");
            expect(verifyResult.result.ui.theme).toBe("dark");

            console.log("主题已更新为：", verifyResult.result.ui.theme);
        });

        it("应该能够更新显示设置", async () => {
            // 模拟用户调整缩略图大小
            const updateResult = await taiyiEngine.callEngine("wenchang", "updatePreferences", {
                display: {
                    thumbnailSize: 200,
                    viewMode: "grid",
                },
            });

            expect(updateResult.success).toBe(true);

            // 验证更新
            const verifyResult = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");
            expect(verifyResult.result.display.thumbnailSize).toBe(200);
            expect(verifyResult.result.display.viewMode).toBe("grid");

            console.log("显示设置已更新：缩略图大小=", verifyResult.result.display.thumbnailSize);
        });

        it("应该能够重置偏好设置到默认值", async () => {
            // 先更新一些设置
            await taiyiEngine.callEngine("wenchang", "updatePreferences", {
                ui: { theme: "dark" },
                display: { thumbnailSize: 300 },
            });

            // 重置到默认值
            const resetResult = await taiyiEngine.callEngine("wenchang", "resetToDefaults");
            expect(resetResult.success).toBe(true);

            // 验证已重置
            const verifyResult = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");
            expect(verifyResult.result.ui.theme).toBe("light"); // 默认主题
            expect(verifyResult.result.display.thumbnailSize).toBe(150); // 默认大小

            console.log("偏好设置已重置到默认值");
        });

        it("应该能够导出用户偏好配置", async () => {
            const exportResult = await taiyiEngine.callEngine("wenchang", "exportPreferences");

            expect(exportResult.success).toBe(true);
            expect(exportResult.result).toBeDefined();
            expect(typeof exportResult.result).toBe("string"); // JSON字符串

            const exported = JSON.parse(exportResult.result);
            expect(exported).toHaveProperty("preferences");
            expect(exported).toHaveProperty("revision");
            expect(exported).toHaveProperty("exportTime");

            console.log("偏好设置已导出，版本号：", exported.revision);
        });

        it("应该能够导入用户偏好配置", async () => {
            // 先导出当前配置
            const exportResult = await taiyiEngine.callEngine("wenchang", "exportPreferences");
            const exportedConfig = exportResult.result;

            // 修改一些设置
            await taiyiEngine.callEngine("wenchang", "updatePreferences", {
                ui: { theme: "dark" },
            });

            // 导入之前的配置
            const importResult = await taiyiEngine.callEngine(
                "wenchang",
                "importPreferences",
                exportedConfig,
            );
            expect(importResult.success).toBe(true);

            // 验证已恢复
            const verifyResult = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");
            expect(verifyResult.result.ui.theme).toBe("light"); // 恢复到导出时的值

            console.log("偏好设置已从备份恢复");
        });

        it("应该能够监听偏好变更事件", async () => {
            const events: any[] = [];

            // 监听偏好变更事件
            const listener = (event: any) => {
                events.push(event);
            };

            // 注意：实际应用中会通过适配器的事件系统
            wenchangAdapter["engine"].on("preferencesChanged", listener);

            // 触发变更
            await taiyiEngine.callEngine("wenchang", "updatePreferences", {
                ui: { language: "zh-CN" },
            });

            // 等待事件传播
            await new Promise((resolve) => setTimeout(resolve, 100));

            // 验证事件
            expect(events.length).toBeGreaterThan(0);
            const lastEvent = events[events.length - 1];
            expect(lastEvent).toHaveProperty("delta");
            expect(lastEvent.delta.ui?.language).toBe("zh-CN");

            console.log("捕获到偏好变更事件，语言设置为：", lastEvent.delta.ui?.language);

            // 清理
            wenchangAdapter["engine"].off("preferencesChanged", listener);
        });
    });

    describe("实际UI集成场景", () => {
        it("模拟设置页面加载时获取所有配置", async () => {
            // 当用户打开设置页面时
            const result = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");

            expect(result.success).toBe(true);
            const settings = result.result;

            // UI层可以使用这些数据渲染设置表单
            expect(settings).toMatchObject({
                ui: {
                    theme: expect.any(String),
                    language: expect.any(String),
                    fontSize: expect.any(String),
                },
                display: {
                    viewMode: expect.any(String),
                    thumbnailSize: expect.any(Number),
                    showMetadata: expect.any(Boolean),
                },
                scan: {
                    autoScan: expect.any(Boolean),
                    scanInterval: expect.any(Number),
                    excludePatterns: expect.any(Array),
                },
            });

            console.log("设置页面数据加载成功");
        });

        it("模拟用户批量更新多个设置", async () => {
            // 用户在设置界面修改多个选项后点击保存
            const userChanges = {
                ui: {
                    theme: "dark",
                    language: "en-US",
                    fontSize: "large",
                },
                display: {
                    viewMode: "list",
                    thumbnailSize: 180,
                    showMetadata: true,
                },
                scan: {
                    autoScan: false,
                },
            };

            const result = await taiyiEngine.callEngine(
                "wenchang",
                "updatePreferences",
                userChanges,
            );

            expect(result.success).toBe(true);
            expect(result.result.success).toBe(true);

            // 验证所有更改都已应用
            const verification = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");
            expect(verification.result.ui.theme).toBe("dark");
            expect(verification.result.ui.language).toBe("en-US");
            expect(verification.result.display.viewMode).toBe("list");
            expect(verification.result.scan.autoScan).toBe(false);

            console.log("批量设置更新成功");
        });

        it("模拟快捷键切换主题场景", async () => {
            // 获取当前主题
            const currentSnapshot = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");
            const currentTheme = currentSnapshot.result.ui.theme;

            // 切换到相反的主题（模拟Ctrl+Shift+T快捷键）
            const newTheme = currentTheme === "light" ? "dark" : "light";
            const result = await taiyiEngine.callEngine("wenchang", "updatePreferences", {
                ui: { theme: newTheme },
            });

            expect(result.success).toBe(true);

            // 验证主题已切换
            const newSnapshot = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");
            expect(newSnapshot.result.ui.theme).toBe(newTheme);

            console.log(`主题已从 ${currentTheme} 切换到 ${newTheme}`);
        });
    });

    describe("性能和稳定性验证", () => {
        it("应该能够快速响应连续的偏好更新", async () => {
            const startTime = Date.now();
            const updateCount = 10;

            for (let i = 0; i < updateCount; i++) {
                const result = await taiyiEngine.callEngine("wenchang", "updatePreferences", {
                    display: { thumbnailSize: 100 + i * 10 },
                });
                expect(result.success).toBe(true);
            }

            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / updateCount;

            console.log(
                `完成 ${updateCount} 次更新，总耗时: ${totalTime}ms，平均: ${avgTime.toFixed(2)}ms`,
            );

            // 验证性能（平均每次应该在100ms以内）
            expect(avgTime).toBeLessThan(100);
        });

        it("应该能够处理无效的偏好更新", async () => {
            // 尝试设置无效值
            const result = await taiyiEngine.callEngine("wenchang", "updatePreferences", {
                ui: { theme: "invalid-theme" as any },
                display: { thumbnailSize: -100 }, // 负数
            });

            // 即使有无效值，也应该优雅处理
            expect(result.success).toBe(true);

            // 验证值被合理处理
            const snapshot = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");
            expect(["light", "dark", "auto"]).toContain(snapshot.result.ui.theme);
            expect(snapshot.result.display.thumbnailSize).toBeGreaterThan(0);

            console.log("无效值已被合理处理");
        });
    });
});
