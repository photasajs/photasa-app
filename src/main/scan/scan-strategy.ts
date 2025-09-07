/*
 * scan-strategy.ts
 *
 * 扫描策略模块 - 集中管理所有扫描决策逻辑
 * RFC 0007: 智能扫描决策与缓存优化的策略实现
 *
 * 职责:
 * - 智能扫描策略决策 (SKIP/INCREMENTAL/FULL)
 * - 文件处理策略判断
 * - 扫描深度控制策略
 * - 与folder-cache-manager的集成
 */

import fs from "fs-extra";
import path from "path";
import { PhotasaLogger } from "@common/logger";
import { getPhotasaConfig } from "../config/config-storage";
import {
    computeFolderHash,
    getCacheInfo,
    compareHashesAndDecide,
    ScanStrategy,
    type ScanDecision,
} from "./folder-cache-manager";

/**
 * 纯函数：判断是否只扫描当前层级
 * @param action - 扫描动作
 * @returns boolean - 是否只扫描一级
 */
export function shouldScanOneLevel(action: string): boolean {
    return action === "current" || action === "rescan" || action === "scan";
}

/**
 * 纯函数：判断文件是否需要处理
 * 策略逻辑:
 * - rescan动作总是需要处理
 * - 如果.photasa.json不存在，需要处理
 * - 如果文件不在配置中，需要处理
 * - 如果文件已在配置中，不需要处理
 *
 * @param filePath - 文件路径
 * @param action - 扫描动作
 * @param logger - 日志记录器
 * @returns Promise<boolean> - 是否需要处理
 */
export async function shouldProcessFile(
    filePath: string,
    action: string,
    logger: PhotasaLogger,
): Promise<boolean> {
    // 总是处理 rescan 动作
    if (action === "rescan") {
        return true;
    }

    // 检查 .photasa.json 是否存在
    const dir = path.dirname(filePath);
    const configPath = path.join(dir, ".photasa.json");

    // 如果 .photasa.json 不存在，则需要处理
    if (!fs.existsSync(configPath)) {
        return true;
    }

    try {
        // 检查文件是否在配置中
        const config = await getPhotasaConfig(dir, logger);
        // 获取文件名
        const fileName = path.basename(filePath);
        // 如果文件在配置中，则不需要处理 photoList 保存的是文件名，而不是路径
        return !config.photoList.some((photo) => photo.path === fileName);
    } catch (error) {
        logger.warn(`[shouldProcessFile] 读取配置文件失败: ${configPath}`, error);
        // 配置文件读取失败时，默认需要处理
        return true;
    }
}

/**
 * RFC 0007: 智能扫描决策 - 检查目录是否需要扫描
 *
 * 决策流程:
 * 1. 计算当前目录哈希
 * 2. 获取缓存信息
 * 3. 比较哈希决定策略
 * 4. 返回扫描策略决策
 *
 * @param folderPath - 目录路径
 * @param logger - 日志记录器
 * @returns Promise<ScanDecision> - 扫描策略决策
 */
export async function decideScanStrategy(
    folderPath: string,
    logger: PhotasaLogger,
): Promise<ScanDecision> {
    logger.debug(`[decideScanStrategy] 开始决策扫描策略: ${folderPath}`);
    try {
        // 计算当前目录哈希
        const currentHash = await computeFolderHash(folderPath);
        logger.debug(`[decideScanStrategy] 计算目录哈希完成: ${currentHash}`);

        // 获取缓存信息
        const cachedInfo = await getCacheInfo(folderPath, logger);

        if (!cachedInfo) {
            // 首次扫描
            logger.info(`[decideScanStrategy] 目录首次扫描: ${folderPath}`);
            return {
                strategy: ScanStrategy.FULL,
                reason: "首次扫描或缓存无效",
            };
        }

        // 比较哈希决定策略
        const decision = compareHashesAndDecide(cachedInfo.folderHash, currentHash, cachedInfo);

        logger.info(
            `[decideScanStrategy] 目录 ${folderPath} 扫描策略: ${decision.strategy}, 原因: ${decision.reason}`,
        );

        return decision;
    } catch (error) {
        logger.error(`[decideScanStrategy] 扫描决策失败: ${folderPath}`, error);
        // 出错时使用完整扫描作为安全选择
        return {
            strategy: ScanStrategy.FULL,
            reason: "决策失败，使用安全的完整扫描",
        };
    }
}

/**
 * 纯函数：根据扫描策略获取相应的日志信息
 * @param strategy - 扫描策略
 * @param folderPath - 目录路径
 * @returns 策略相关的日志消息对象
 */
export function getStrategyLogMessages(strategy: ScanStrategy, folderPath: string) {
    const strategyNames = {
        [ScanStrategy.SKIP]: "跳过",
        [ScanStrategy.INCREMENTAL]: "增量",
        [ScanStrategy.FULL]: "完整",
    };

    return {
        skipMessage: `[scanStrategy] 跳过未变化目录: ${folderPath}`,
        startMessage: `[scanStrategy] 开始${strategyNames[strategy]}扫描: ${folderPath}`,
        completeMessage: `[scanStrategy] ${strategyNames[strategy]}扫描完成: ${folderPath}`,
    };
}

/**
 * 纯函数：验证扫描策略参数
 * @param folderPath - 目录路径
 * @returns 验证结果
 */
export function validateStrategyParams(folderPath: string): { isValid: boolean; error?: string } {
    if (!folderPath || typeof folderPath !== "string") {
        return { isValid: false, error: "目录路径不能为空且必须为字符串" };
    }

    if (!path.isAbsolute(folderPath)) {
        return { isValid: false, error: "目录路径必须为绝对路径" };
    }

    return { isValid: true };
}

/**
 * 纯函数：创建策略决策的错误处理器
 * @param folderPath - 目录路径
 * @returns 错误处理器配置
 */
export function createStrategyErrorHandlers(folderPath: string) {
    return {
        hashComputeError: (error: unknown) =>
            `[scanStrategy] 计算目录哈希失败: ${folderPath} - ${error}`,
        cacheReadError: (error: unknown) =>
            `[scanStrategy] 读取缓存信息失败: ${folderPath} - ${error}`,
        decisionError: (error: unknown) => `[scanStrategy] 策略决策失败: ${folderPath} - ${error}`,
        fallbackMessage: `[scanStrategy] 策略决策异常，降级为完整扫描: ${folderPath}`,
    };
}
