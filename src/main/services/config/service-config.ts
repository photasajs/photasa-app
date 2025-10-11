import { ServiceMetadata } from "../core/service-types";
import { getDecoratedServiceRegistry } from "../decorators/service-decorators";

/**
 * 服务配置定义
 * 定义所有服务的元数据、优先级、依赖关系和启动参数
 */
export const serviceConfig: ServiceMetadata[] = [
    // ==================== 关键服务 ====================
    // 这些服务在启动时必须立即初始化
    // 注意：config 和 window 服务现在使用 @Service 装饰器，已从此配置中移除
    // ==================== 重要服务 ====================
    // 窗口显示后立即初始化的服务
    // 注意：logViewer、menu 和 shell 服务现在使用 @Service 装饰器，已从此配置中移除
    // ==================== 后台服务 ====================
    // 延迟初始化的服务，按优先级顺序加载
    // 注意：update、thumbnail、scan、watch 和 import 服务现在使用 @Service 装饰器，已从此配置中移除
    // 所有服务现在都使用 @Service 装饰器模式！
];

/**
 * 根据服务名称获取服务配置
 */
export function getServiceConfig(name: string): ServiceMetadata | undefined {
    return serviceConfig.find((config) => config.name === name);
}

/**
 * 根据优先级获取服务列表
 */
export function getServicesByPriority(
    priority: "critical" | "important" | "background",
): ServiceMetadata[] {
    return serviceConfig.filter((config) => config.priority === priority);
}

/**
 * 获取服务的依赖列表
 */
export function getServiceDependencies(name: string): string[] {
    const config = getServiceConfig(name);
    return config?.dependencies || [];
}

/**
 * 按依赖顺序排序服务
 */
export function sortServicesByDependency(services: ServiceMetadata[]): ServiceMetadata[] {
    const sorted: ServiceMetadata[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function visit(service: ServiceMetadata) {
        if (visited.has(service.name)) return;
        if (visiting.has(service.name)) {
            throw new Error(`Circular dependency detected: ${service.name}`);
        }

        visiting.add(service.name);

        // 先访问依赖
        if (service.dependencies) {
            for (const depName of service.dependencies) {
                const dep = services.find((s) => s.name === depName);
                if (dep) {
                    visit(dep);
                }
            }
        }

        visiting.delete(service.name);
        visited.add(service.name);
        sorted.push(service);
    }

    for (const service of services) {
        visit(service);
    }

    return sorted;
}

/**
 * 验证服务配置的完整性
 */
export function validateServiceConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const names = new Set<string>();

    // 获取装饰器服务列表
    const decoratedRegistry = getDecoratedServiceRegistry();
    const decoratedServices = decoratedRegistry.getAllServices();

    // 创建所有服务名称的集合（传统 + 装饰器）
    const allServiceNames = new Set<string>();
    serviceConfig.forEach((config) => allServiceNames.add(config.name));
    decoratedServices.forEach((service) => allServiceNames.add(service.name));

    for (const config of serviceConfig) {
        // 检查重复的服务名称
        if (names.has(config.name)) {
            errors.push(`Duplicate service name: ${config.name}`);
        }
        names.add(config.name);

        // 检查依赖是否存在（包括装饰器服务）
        if (config.dependencies) {
            for (const dep of config.dependencies) {
                if (!allServiceNames.has(dep)) {
                    errors.push(`Service ${config.name} depends on non-existent service: ${dep}`);
                }
            }
        }

        // 检查延迟加载服务不应该被其他非延迟加载服务依赖
        if (config.lazyLoad) {
            const dependents = serviceConfig.filter(
                (s) => !s.lazyLoad && s.dependencies?.includes(config.name),
            );
            if (dependents.length > 0) {
                errors.push(
                    `Lazy-loaded service ${config.name} is depended on by non-lazy services: ${dependents
                        .map((d) => d.name)
                        .join(", ")}`,
                );
            }
        }
    }

    // 检查装饰器服务与传统服务之间的重复名称
    for (const decoratedService of decoratedServices) {
        if (names.has(decoratedService.name)) {
            errors.push(
                `Duplicate service name between traditional and decorated services: ${decoratedService.name}`,
            );
        }
    }

    // 检查循环依赖
    try {
        sortServicesByDependency(serviceConfig);
    } catch (error) {
        if (error instanceof Error && error.message.includes("Circular dependency")) {
            errors.push(error.message);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// 导出优先级分组，便于使用
export const servicePriorities = {
    critical: getServicesByPriority("critical"),
    important: getServicesByPriority("important"),
    background: getServicesByPriority("background"),
};

// 导出默认配置
export default serviceConfig;
