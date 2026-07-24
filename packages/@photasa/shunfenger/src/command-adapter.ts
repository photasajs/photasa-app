import { randomUUID } from "node:crypto";
import type { FileOperation, ScanAction } from "@photasa/common";
import type {
    FileObservation,
    ShunfengerFileOperationCommand,
    ShunfengerScanCommand,
    CommandDispatcher,
    WatchProfile,
} from "./types";

export interface CommandAdapterOptions {
    defaultPriority: "user" | "background";
}

export class CommandAdapter {
    private dispatcher: CommandDispatcher | null = null;
    private readonly options: CommandAdapterOptions;

    constructor(options: CommandAdapterOptions) {
        this.options = options;
    }

    setDispatcher(dispatcher: CommandDispatcher): void {
        this.dispatcher = dispatcher;
    }

    handleObservation(observation: FileObservation, profile: WatchProfile): void {
        if (!this.dispatcher) return;

        if (observation.isDirectory) {
            const command: ShunfengerScanCommand = {
                id: randomUUID(),
                type: "scan-command",
                profileId: profile.id,
                createdAt: Date.now(),
                payload: {
                    action: this.createScanAction(observation, profile),
                    source: "watch",
                    priority: profile.priority ?? this.options.defaultPriority,
                },
            };
            this.dispatcher(command);
            return;
        }

        const command: ShunfengerFileOperationCommand = {
            id: randomUUID(),
            type: "file-operation",
            profileId: profile.id,
            createdAt: Date.now(),
            payload: {
                operation: this.createFileOperation(observation, profile),
            },
        };
        this.dispatcher(command);
    }

    private createScanAction(observation: FileObservation, profile: WatchProfile): ScanAction {
        return {
            path: observation.path,
            action: "scan",
            thumbnailSize: profile.thumbnailSize,
            operationType: "directory",
            source: "auto",
            fileOperationId: observation.id,
        };
    }

    private createFileOperation(
        observation: FileObservation,
        profile: WatchProfile,
    ): FileOperation {
        const type = this.mapObservationKind(observation);
        return {
            id: observation.id,
            type,
            path: observation.path,
            timestamp: Date.now(),
            priority: profile.priority === "user" ? 0 : 10,
            retryCount: 0,
            metadata: {
                thumbnailSize: profile.thumbnailSize,
                isFile: !observation.isDirectory,
                lastModified: observation.metadata?.mtimeMs,
                fileSize: observation.metadata?.size,
            },
        };
    }

    private mapObservationKind(observation: FileObservation): FileOperation["type"] {
        switch (observation.kind) {
            case "deleteDir":
                return "deleteDir";
            case "addDir":
                return "addDir";
            case "delete":
                return "delete";
            case "change":
                return "change";
            case "add":
            default:
                return "add";
        }
    }
}
