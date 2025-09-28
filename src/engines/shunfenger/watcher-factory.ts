import chokidar, { type FSWatcher, type WatchOptions } from "chokidar";
import { loggers } from "@common/logger";

const logger = loggers.watch;

export interface WatcherFactoryOptions {
    paths: string[];
    options: WatchOptions;
}

export class WatcherFactory {
    create(options: WatcherFactoryOptions): FSWatcher {
        logger.debug("[WatcherFactory] Creating watcher", options);
        return chokidar.watch(options.paths, options.options);
    }
}
