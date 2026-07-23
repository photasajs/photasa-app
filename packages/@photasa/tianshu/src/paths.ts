import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 解析天枢工作流目录（包内 workflows/，与 dist 同级）
 */
export function resolveTianshuWorkflowsDir(): string {
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    return path.join(packageRoot, "workflows");
}
