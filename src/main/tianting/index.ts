/**
 * 服务模块入口文件
 * 导入所有装饰器服务以确保装饰器代码执行
 */

// 导入装饰器服务以确保装饰器执行
import "../config/config-service";
import "../window/window-service";
import "../directory/directory-service";
import "../log-viewer/log-viewer-service";
import "../menu/menu-service";
import "../shell/shell-service";
import "../update/update-service";
import "../thumbnail/thumbnail-service";
import "../scan/scan-service";
import "../watch/watch-service";
import "../import/import-service";
import "../deity/tianshu-service";

// 导出装饰器相关功能
export { Service } from "./decorators/service-decorators";
export type { ServiceDecoratorOptions } from "./decorators/service-decorators";

// 导出核心服务类型
export * from "./core/service-types";

// 导出服务注册中心
export { ServiceRegistry } from "./core/service-registry";

// 导出启动优化器
export { StartupOptimizerV2 } from "./startup-optimizer-v2";
