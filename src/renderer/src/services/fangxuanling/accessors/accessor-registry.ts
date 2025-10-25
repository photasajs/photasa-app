import { loggers } from "@common/logger";

const logger = loggers.app;

/**
 * Store Accessor注册表
 *
 * 职责：
 * - 统一管理所有Store的Accessor实例
 * - 提供类型安全的访问接口
 * - 支持动态注册新的Accessor
 *
 * 设计原则：
 * - ✅ 可扩展：添加新Store无需修改FangXuanLing核心代码
 * - ✅ 类型安全：通过泛型保证类型推断
 * - ✅ 只读访问：所有Accessor都是只读的
 *
 * @example
 * ```typescript
 * const registry = new AccessorRegistry();
 * registry.register('scanning', new ScanningAccessor(store));
 * const scanning = registry.get('scanning'); // 类型安全
 * ```
 */
export class AccessorRegistry {
    private accessors = new Map<string, unknown>();

    /**
     * 注册Accessor
     * @param key Accessor键名
     * @param accessor Accessor实例
     */
    register<T>(key: string, accessor: T): void {
        if (this.accessors.has(key)) {
            logger.warn(`🏛️ 房玄龄：Accessor "${key}" 已存在，将被覆盖`);
        }
        this.accessors.set(key, accessor);
        logger.debug(`🏛️ 房玄龄：注册Accessor "${key}"`);
    }

    /**
     * 获取Accessor
     * @param key Accessor键名
     * @returns Accessor实例，如果不存在则返回null
     */
    get<T>(key: string): T | null {
        const accessor = this.accessors.get(key);
        if (!accessor) {
            logger.error(`🏛️ 房玄龄：Accessor "${key}" 不存在`);
            return null;
        }
        return accessor as T;
    }

    /**
     * 检查Accessor是否存在
     * @param key Accessor键名
     */
    has(key: string): boolean {
        return this.accessors.has(key);
    }

    /**
     * 获取所有已注册的Accessor键名
     */
    keys(): string[] {
        return Array.from(this.accessors.keys());
    }

    /**
     * 清空所有Accessor
     */
    clear(): void {
        logger.info("🏛️ 房玄龄：清空所有Accessor");
        this.accessors.clear();
    }
}
