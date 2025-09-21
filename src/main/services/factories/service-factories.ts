/**
 * 服务工厂映射
 * 定义所有服务的创建工厂函数
 */

import { ServiceFactory } from "../core/service-types";

/**
 * 服务工厂映射表
 * 将服务名称映射到对应的工厂函数
 *
 * 注意：所有服务现在都使用 @Service 装饰器模式！
 * 已迁移的服务：config、window、logViewer、menu、shell、update、thumbnail、scan、watch、import
 */
export const serviceFactories: Record<string, ServiceFactory> = {
    // 所有服务都已迁移到 @Service 装饰器模式
};

/**
 * 获取服务工厂
 */
export function getServiceFactory(serviceName: string): ServiceFactory | undefined {
    return serviceFactories[serviceName];
}

/**
 * 注册自定义服务工厂
 */
export function registerServiceFactory(serviceName: string, factory: ServiceFactory): void {
    serviceFactories[serviceName] = factory;
}

/**
 * 获取所有注册的服务名称
 */
export function getRegisteredServiceNames(): string[] {
    return Object.keys(serviceFactories);
}
