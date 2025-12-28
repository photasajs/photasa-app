import { loggers } from "@photasa/common";
import { validateServiceConfig, serviceConfig, sortServicesByDependency } from "./service-config";

const logger = loggers.main;

/**
 * 服务配置验证器
 * 在应用启动时验证服务配置的正确性
 */
export class ServiceConfigValidator {
    /**
     * 执行配置验证
     * @returns 验证是否通过
     */
    static validate(): boolean {
        logger.info("Validating service configuration...");

        const { valid, errors } = validateServiceConfig();

        if (!valid) {
            logger.error("Service configuration validation failed:");
            errors.forEach((error) => logger.error(`  - ${error}`));
            return false;
        }

        logger.info("Service configuration validation passed");

        // 打印服务加载顺序（调试用）
        if (process.env.DEBUG_SERVICES) {
            this.printServiceLoadOrder();
        }

        return true;
    }

    /**
     * 打印服务加载顺序（用于调试）
     */
    private static printServiceLoadOrder(): void {
        logger.debug("Service load order by priority:");

        // 按优先级分组打印
        const priorities = ["critical", "important", "background"] as const;

        for (const priority of priorities) {
            const services = serviceConfig.filter((s) => s.priority === priority);
            const sorted = sortServicesByDependency(services);

            logger.debug(`  ${priority.toUpperCase()} services:`);
            sorted.forEach((service, index) => {
                const deps = service.dependencies
                    ? ` (depends on: ${service.dependencies.join(", ")})`
                    : "";
                const lazy = service.lazyLoad ? " [LAZY]" : "";
                const delay = service.startupDelay ? ` [delay: ${service.startupDelay}ms]` : "";
                logger.debug(`    ${index + 1}. ${service.name}${lazy}${delay}${deps}`);
            });
        }
    }

    /**
     * 获取服务统计信息
     */
    static getStatistics(): {
        total: number;
        byPriority: Record<string, number>;
        lazyLoaded: number;
        withDependencies: number;
        withStartupDelay: number;
    } {
        const stats = {
            total: serviceConfig.length,
            byPriority: {
                critical: 0,
                important: 0,
                background: 0,
            },
            lazyLoaded: 0,
            withDependencies: 0,
            withStartupDelay: 0,
        };

        for (const service of serviceConfig) {
            stats.byPriority[service.priority]++;

            if (service.lazyLoad) {
                stats.lazyLoaded++;
            }

            if (service.dependencies && service.dependencies.length > 0) {
                stats.withDependencies++;
            }

            if (service.startupDelay && service.startupDelay > 0) {
                stats.withStartupDelay++;
            }
        }

        return stats;
    }

    /**
     * 打印服务统计信息
     */
    static printStatistics(): void {
        const stats = this.getStatistics();

        logger.info("Service Configuration Statistics:");
        logger.info(`  Total services: ${stats.total}`);
        logger.info(`  By priority:`);
        logger.info(`    - Critical: ${stats.byPriority.critical}`);
        logger.info(`    - Important: ${stats.byPriority.important}`);
        logger.info(`    - Background: ${stats.byPriority.background}`);
        logger.info(`  Lazy loaded: ${stats.lazyLoaded}`);
        logger.info(`  With dependencies: ${stats.withDependencies}`);
        logger.info(`  With startup delay: ${stats.withStartupDelay}`);
    }
}

// 导出便捷函数
export const validateConfig = () => ServiceConfigValidator.validate();
export const getServiceStats = () => ServiceConfigValidator.getStatistics();
