/**
 * 路径文书总管司
 * 朝廷路径文书处理的总协调机构
 *
 * 治理之道：
 * 1. 直接委派：各类文书直接委派给专职文官处理
 * 2. 文案传递：所需典籍通过文案传递，便于查验
 * 3. 官员协作：支持文官协同处理复杂政务
 * 4. 即事即办：无需繁琐仪式，有政务直接处理
 *
 * 唐代官制精神：
 * - 消除繁复的衙门层级
 * - 明确的官员职责划分
 * - 简政便民，高效务实
 * - 便于内政监察和考核
 */

import type { StrategyContext } from "./types";
import type { Zouzhe } from "@renderer/interfaces/fang-xuan-ling.interface";
import { executeStrategy, type StrategyDependencies } from "./path-handlers";

/**
 * 文书总管司
 * 协调各路文官处理不同类型的文书，消除繁复的衣门层级
 */
export class PathOperationStrategy {
    private dependencies: StrategyDependencies;

    constructor(context: StrategyContext) {
        this.dependencies = {
            logger: context.logger,
            preferenceService: context.preferenceService,
        };
    }

    /**
     * 处理奏折文书
     * 调遣对应文官处理来自民间的奏折
     * @param zouzhe 奏折内容
     */
    async execute(zouzhe: Zouzhe): Promise<void> {
        await executeStrategy(zouzhe, this.dependencies);
    }

    /**
     * 获取所有文官信息
     * 用于内政监察和官员考核
     */
    getAvailableWenguan(): Array<{ matter: string; wenguanName: string }> {
        return Object.entries(WENGUAN_REGISTRY).map(([matter, wenguan]) => ({
            matter,
            wenguanName: wenguan.name,
        }));
    }
}

// 导出文官处理函数和类型作为主要接口
export { executeStrategy } from "./path-handlers";
export type { StrategyContext } from "./types";
import { WENGUAN_REGISTRY } from "./path-handlers";

// 向后兼容的别名（保持旧制度兼容）
export const StrategyExecutor = PathOperationStrategy;
