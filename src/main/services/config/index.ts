/**
 * 服务配置模块
 * 导出所有服务配置相关的功能
 */

export {
    serviceConfig,
    getServiceConfig,
    getServicesByPriority,
    getServiceDependencies,
    sortServicesByDependency,
    validateServiceConfig,
    servicePriorities,
} from "./service-config";

export {
    ServiceConfigValidator,
    validateConfig,
    getServiceStats,
} from "./service-config-validator";

// 重新导出类型
export type { ServiceMetadata } from "../core/service-types";
