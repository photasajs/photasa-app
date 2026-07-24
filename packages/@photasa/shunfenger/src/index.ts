/**
 * 顺风耳引擎 - 天庭听风殿
 *
 * 神话背景：
 * 顺风耳，千里眼的好友，拥有超凡的听力，能够听到千里之外的细微声响。
 * 传说中，顺风耳原为轩辕黄帝手下的两员大将之一，与千里眼并肩作战，
 * 一个负责观察，一个负责聆听，共同守护着天下苍生。
 *
 * 在本架构中，顺风耳引擎专职监听文件系统的变化，
 * 就如同神话中的顺风耳能够听到远方的动静一样，
 * 它能敏锐地捕捉到文件的创建、修改、删除等变化，
 * 并将这些变化及时传递给其他引擎进行处理。
 *
 * 核心能力：
 * - 文件系统事件监听
 * - 变化事件的归一化处理
 * - 高效的事件缓冲和批处理
 * - 多配置文件的管理
 */

import path from "path";
import os from "os";
import type { FSWatcher } from "chokidar";
import { loggers } from "@photasa/common";
import type {
    CommandDispatcher,
    EngineEventListener,
    FileObservation,
    StartWatchingRequest,
    WatchProfile,
} from "./types";
import { StatusBus } from "./status-bus";
import { ProfileStore } from "./profile-store";
import { EventBuffer } from "./event-buffer";
import { CommandAdapter } from "./command-adapter";
import { WatcherFactory } from "./watcher-factory";
import { createObservationFromChokidar } from "./observation";

const logger = loggers.shunfenger || loggers.watch;

export interface ShunfengerEngineOptions {
    storageRoot?: string;
    defaultDebounceMs?: number;
    defaultPriority?: "user" | "background";
}

export interface ShunfengerEngine {
    initialize(): Promise<void>;
    configure(profile: WatchProfile): Promise<void>;
    startWatching(request: StartWatchingRequest): Promise<void>;
    removeProfile(profileId: string): Promise<void>;
    listProfiles(): WatchProfile[];
    pause(profileId?: string): Promise<void>;
    resume(profileId?: string): Promise<void>;
    flush(): Promise<void>;
    onEvent(listener: EngineEventListener): () => void;
    setCommandDispatcher(dispatcher: CommandDispatcher): void;
    shutdown(): Promise<void>;
}

class ShunfengerEngineImpl implements ShunfengerEngine {
    private readonly options: Required<ShunfengerEngineOptions>;
    private readonly statusBus = new StatusBus();
    private readonly profileStore: ProfileStore;
    private readonly eventBuffer: EventBuffer;
    private readonly commandAdapter: CommandAdapter;
    private readonly watcherFactory = new WatcherFactory();
    private watcher: FSWatcher | null = null;
    private activeProfileId: string | null = null;

    constructor(options: ShunfengerEngineOptions) {
        this.options = {
            storageRoot: options.storageRoot ?? path.join(os.homedir(), ".photasa", "watch"),
            defaultDebounceMs: options.defaultDebounceMs ?? 500,
            defaultPriority: options.defaultPriority ?? "background",
        };
        this.profileStore = new ProfileStore(path.join(this.options.storageRoot, "profiles.json"));
        this.eventBuffer = new EventBuffer({
            debounceMs: this.options.defaultDebounceMs,
            maxBatchSize: 500,
        });
        this.commandAdapter = new CommandAdapter({
            defaultPriority: this.options.defaultPriority,
        });
    }

    async initialize(): Promise<void> {
        logger.info("[Shunfenger] Initializing engine");
        await this.profileStore.initialize();
        this.eventBuffer.setListener(this.handleObservation.bind(this));
        this.statusBus.emit({
            type: "status",
            state: "initializing",
            timestamp: Date.now(),
        });
        this.statusBus.emit({
            type: "status",
            state: "ready",
            timestamp: Date.now(),
        });
    }

    async configure(profile: WatchProfile): Promise<void> {
        await this.profileStore.upsert(profile);
        this.statusBus.emit({
            type: "status",
            profileId: profile.id,
            state: "ready",
            timestamp: Date.now(),
        });
    }

    async startWatching(request: StartWatchingRequest): Promise<void> {
        await this.profileStore.upsert(request.profile);
        this.activeProfileId = request.profile.id;

        await this.closeWatcher();
        this.eventBuffer.clear();

        this.watcher = this.watcherFactory.create({
            paths: request.paths,
            options: request.options,
        });

        const profileId = request.profile.id;
        const enqueue = (kind: FileObservation["kind"], filePath: string, isDirectory: boolean) => {
            const observation = createObservationFromChokidar(kind, filePath, isDirectory, profileId);
            this.eventBuffer.enqueue(observation);
        };

        this.watcher
            .on("add", (filePath) => enqueue("add", filePath, false))
            .on("addDir", (filePath) => enqueue("addDir", filePath, true))
            .on("change", (filePath) => enqueue("change", filePath, false))
            .on("unlink", (filePath) => enqueue("delete", filePath, false))
            .on("unlinkDir", (filePath) => enqueue("deleteDir", filePath, true))
            .on("error", (error) => {
                logger.error("[Shunfenger] 天劫降临，监听中断", error);
                this.statusBus.emit({
                    type: "status",
                    profileId,
                    state: "error",
                    error: error instanceof Error ? error : new Error(String(error)),
                    timestamp: Date.now(),
                });
            })
            .on("ready", () => {
                logger.info("[Shunfenger] 顺风耳已就位，开始聆听文件变化");
                this.statusBus.emit({
                    type: "status",
                    profileId,
                    state: "ready",
                    timestamp: Date.now(),
                });
            });

        logger.info("[Shunfenger] 启动文件监听", request.paths);
    }

    async removeProfile(profileId: string): Promise<void> {
        await this.profileStore.remove(profileId);
        this.statusBus.emit({
            type: "status",
            profileId,
            state: "paused",
            timestamp: Date.now(),
            message: "profile removed",
        });
    }

    listProfiles(): WatchProfile[] {
        return this.profileStore.list();
    }

    async pause(): Promise<void> {
        this.eventBuffer.clear();
        await this.closeWatcher();
        this.activeProfileId = null;
        this.statusBus.emit({
            type: "status",
            state: "paused",
            timestamp: Date.now(),
        });
    }

    async resume(): Promise<void> {
        this.statusBus.emit({
            type: "status",
            state: "ready",
            timestamp: Date.now(),
        });
    }

    async flush(): Promise<void> {
        this.statusBus.emit({
            type: "status",
            state: "flushing",
            timestamp: Date.now(),
        });
        this.eventBuffer.forceFlush();
        this.statusBus.emit({
            type: "status",
            state: "ready",
            timestamp: Date.now(),
        });
    }

    onEvent(listener: EngineEventListener): () => void {
        return this.statusBus.on(listener);
    }

    setCommandDispatcher(dispatcher: CommandDispatcher): void {
        this.commandAdapter.setDispatcher(dispatcher);
    }

    async shutdown(): Promise<void> {
        await this.flush();
        await this.closeWatcher();
        this.activeProfileId = null;
        this.eventBuffer.clear();
        this.statusBus.emit({
            type: "status",
            state: "paused",
            timestamp: Date.now(),
            message: "engine shutdown",
        });
    }

    private handleObservation(observation: FileObservation): void {
        const profileId = observation.profileId || this.activeProfileId;
        if (!profileId) {
            logger.warn("[Shunfenger] 收到无 profile 的观察事件", observation.path);
            return;
        }

        const profile = this.profileStore.get(profileId);
        if (!profile) {
            logger.warn("[Shunfenger] Received observation for unknown profile", profileId);
            return;
        }
        this.statusBus.emit({
            type: "observation",
            observation,
            timestamp: Date.now(),
        });
        this.commandAdapter.handleObservation(observation, profile);
    }

    private async closeWatcher(): Promise<void> {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }
}

export function createShunfengerEngine(options: ShunfengerEngineOptions = {}): ShunfengerEngine {
    return new ShunfengerEngineImpl(options);
}

// 导出类型
export type {
    WatchProfile,
    FileObservation,
    WatchEventKind,
    ShunfengerEngineEvent,
    ShunfengerStatusEvent,
    ShunfengerObservationEvent,
    ShunfengerCommandEvent,
    ShunfengerCommand,
    ShunfengerFileOperationCommand,
    ShunfengerScanCommand,
    CommandDispatcher,
    EngineEventListener,
    ObservationListener,
    StartWatchingRequest,
} from "./types";

// 导出内部组件（用于测试）
export { StatusBus } from "./status-bus";
export { ProfileStore } from "./profile-store";
export { EventBuffer } from "./event-buffer";
export { CommandAdapter } from "./command-adapter";
export { WatcherFactory } from "./watcher-factory";
export { createObservationFromChokidar, isMediaFile } from "./observation";
