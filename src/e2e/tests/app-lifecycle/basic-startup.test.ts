import { test, expect } from "../../fixtures/electron-app";

test.describe("基础启动测试", () => {
    test("验证测试环境配置", async () => {
        // 验证基本的测试环境
        expect(process.cwd()).toBeTruthy();
        console.log("当前工作目录:", process.cwd());

        // 这个测试不需要启动 Electron，只检查环境
        const packageJsonPath = `${process.cwd()}/package.json`;
        const fs = require("fs");
        const packageJsonExists = fs.existsSync(packageJsonPath);
        expect(packageJsonExists).toBe(true);

        console.log("✅ 测试环境验证通过");
    });

    test.skip("应用构建验证", async () => {
        // 这个测试被跳过，用于手动验证构建
        const fs = require("fs");
        const mainPath = `${process.cwd()}/out/main/index.js`;
        const rendererPath = `${process.cwd()}/out/renderer`;

        console.log("检查构建文件:");
        console.log("- 主进程:", fs.existsSync(mainPath) ? "✅" : "❌");
        console.log("- 渲染进程:", fs.existsSync(rendererPath) ? "✅" : "❌");

        if (!fs.existsSync(mainPath)) {
            console.log("⚠️  请先运行 'npm run build' 构建应用");
        }
    });
});
