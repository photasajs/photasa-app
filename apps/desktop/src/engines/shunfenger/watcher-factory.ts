import chokidar, { type FSWatcher, type WatchOptions } from "chokidar";
import { loggers } from "@photasa/common";

const logger = loggers.shunfenger;

/**
 * 文件系统监听器工厂选项
 */
export interface WatcherFactoryOptions {
    paths: string[];
    options: WatchOptions;
}

/**
 * 文件系统监听器工厂
 * 负责创建文件系统监听器
 */
export class WatcherFactory {
    create(options: WatcherFactoryOptions): FSWatcher {
        logger.debug("创建文件系统监听器", options);
        return chokidar.watch(options.paths, options.options);
    }
}
