import { ServiceMetadata, ServicePriority } from "../core/service-types";

/**
 * 服务配置定义
 * 定义所有服务的元数据、优先级、依赖关系和启动参数
 */
export const serviceConfig: ServiceMetadata[] = [
    // ==================== 关键服务 ====================
    // 这些服务在启动时必须立即初始化

    {
        name: "config",
        displayName: "配置服务",
        priority: ServicePriority.Critical,
        lazyLoad: false,
        description: "管理应用程序配置和设置",
    },

    {
        name: "window",
        displayName: "窗口服务",
        priority: ServicePriority.Critical,
        dependencies: ["config"],
        lazyLoad: false,
        description: "管理应用窗口的创建和控制",
    },

    // ==================== 重要服务 ====================
    // 窗口显示后立即初始化的服务

    {
        name: "logViewer",
        displayName: "日志查看器服务",
        priority: ServicePriority.Important,
        lazyLoad: false,
        description: "提供日志查看和管理功能",
    },

    {
        name: "menu",
        displayName: "菜单服务",
        priority: ServicePriority.Important,
        dependencies: ["window"],
        lazyLoad: false,
        description: "管理应用程序菜单",
    },

    {
        name: "shell",
        displayName: "Shell 服务",
        priority: ServicePriority.Important,
        lazyLoad: false,
        description: "提供系统 Shell 交互功能",
    },

    // ==================== 后台服务 ====================
    // 延迟初始化的服务，按优先级顺序加载

    {
        name: "update",
        displayName: "更新服务",
        priority: ServicePriority.Background,
        startupDelay: 0,
        retryOnFailure: true,
        maxRetries: 3,
        lazyLoad: false,
        description: "管理应用程序更新检查和安装",
    },

    {
        name: "thumbnail",
        displayName: "缩略图服务",
        priority: ServicePriority.Background,
        startupDelay: 500,
        dependencies: ["logViewer"],
        lazyLoad: false,
        description: "生成和管理图片缩略图",
    },

    {
        name: "scan",
        displayName: "扫描服务",
        priority: ServicePriority.Background,
        startupDelay: 1000,
        dependencies: ["logViewer", "config"],
        lazyLoad: false,
        description: "扫描和索引照片文件",
    },

    {
        name: "watch",
        displayName: "文件监视服务",
        priority: ServicePriority.Background,
        startupDelay: 1500,
        lazyLoad: true, // 按需加载
        description: "监视文件系统变化",
    },

    {
        name: "import",
        displayName: "导入服务",
        priority: ServicePriority.Background,
        startupDelay: 2000,
        lazyLoad: true, // 按需加载
        description: "处理照片导入操作",
    },
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

    for (const config of serviceConfig) {
        // 检查重复的服务名称
        if (names.has(config.name)) {
            errors.push(`Duplicate service name: ${config.name}`);
        }
        names.add(config.name);

        // 检查依赖是否存在
        if (config.dependencies) {
            for (const dep of config.dependencies) {
                if (!serviceConfig.find((s) => s.name === dep)) {
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
