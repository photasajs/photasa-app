import fs from "fs-extra";
import path from "path";

async function globalTeardown() {
    // 清理临时测试数据
    const tempDbDir = path.join(__dirname, "../test-data/temp-db");

    try {
        if (await fs.pathExists(tempDbDir)) {
            await fs.remove(tempDbDir);
        }
    } catch (error) {
        console.warn("⚠️ Warning: Could not clean up temp test data:", error);
    }

    console.log("🧹 Global teardown completed");
}

export default globalTeardown;
