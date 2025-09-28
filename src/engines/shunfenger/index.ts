import path from "path";
import os from "os";
import type { FSWatcher } from "chokidar";
import { loggers } from "@common/logger";
import type {
    CommandDispatcher,
    EngineEventListener,
    FileObservation,
    WatchProfile,
} from "./types";
import { StatusBus } from "./status-bus";
import { ProfileStore } from "./profile-store";
import { EventBuffer } from "./event-buffer";
import { CommandAdapter } from "./command-adapter";
// import { WatcherFactory } from "./watcher-factory";

const logger = loggers.watch;

export interface ShunfengerEngineOptions {
    storageRoot?: string;
    defaultDebounceMs?: number;
    defaultPriority?: "user" | "background";
}

export interface ShunfengerEngine {
    initialize(): Promise<void>;
    configure(profile: WatchProfile): Promise<void>;
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
    // TODO: WatcherFactory将在后续版本中用于多类型文件监视器创建
    // private readonly watcherFactory = new WatcherFactory();
    private watcher: FSWatcher | null = null;

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
        await this.closeWatcher();
        this.eventBuffer.clear();
        this.statusBus.emit({
            type: "status",
            state: "paused",
            timestamp: Date.now(),
            message: "engine shutdown",
        });
    }

    private handleObservation(observation: FileObservation): void {
        const profile = this.profileStore.get(observation.profileId);
        if (!profile) {
            logger.warn(
                "[Shunfenger] Received observation for unknown profile",
                observation.profileId,
            );
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
