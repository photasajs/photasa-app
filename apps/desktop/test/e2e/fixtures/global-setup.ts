import { FullConfig } from "@playwright/test";
import fs from "fs-extra";
import path from "path";

async function globalSetup(_config: FullConfig) {
    // 确保测试结果目录存在
    await fs.ensureDir("test-results");

    // 清理之前的测试数据
    const testDataDir = path.join(__dirname, "../test-data");

    // 确保测试数据目录存在
    await fs.ensureDir(testDataDir);

    // 创建临时测试数据库目录（如果需要）
    const tempDbDir = path.join(testDataDir, "temp-db");
    await fs.ensureDir(tempDbDir);

    console.log("🔧 Global setup completed");
}

export default globalSetup;
