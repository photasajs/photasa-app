/**
 * 天庭服务模块入口 - 紫微大帝殿
 * 导入所有装饰器服务以确保装饰器代码执行
 *
 * 神话背景：
 * 紫微大帝，天庭最高统治者，统御三界，掌管众神
 * 在Photasa天庭中，紫微大帝殿作为服务注册中心
 * 负责管理所有天庭神祇的注册、调度和协调
 * 确保天庭各司其职，和谐运转
 *
 * 核心职责：
 * - 神祇注册：管理所有天庭神祇的注册和发现
 * - 服务调度：协调各神祇间的协作关系
 * - 装饰器执行：确保所有神祇装饰器正确执行
 * - 启动优化：优化天庭启动流程，提升效率
 */

// 导入装饰器服务以确保装饰器执行
import "../config/config-service";
import "../window/window-service";
import "../directory/directory-service";
import "../log-viewer/log-viewer-service";
// ✅ RFC 0058: MenuService 已移除，菜单管理迁移到 TaibaijinxingAdapter
// ✅ RFC 0058: ShellService 已合并到 TaibaijinxingAdapter
import "../update/update-service";
import "../thumbnail/thumbnail-service";
import "../scan/scan-service";
import "../watch/watch-service";
import "../import/import-service";
// 神位服务导入由main/index.ts导入

// 导出装饰器相关功能
export { Service } from "./decorators/service-decorators";
export type { ServiceDecoratorOptions } from "./decorators/service-decorators";

// 导出核心服务类型
export * from "./core/service-types";

// 导出服务注册中心
export { ServiceRegistry } from "./core/service-registry";

// 导出启动优化器
export { StartupOptimizerV2 } from "./startup-optimizer-v2";
