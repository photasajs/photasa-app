import { randomUUID } from "node:crypto";
import type { FileOperation, ScanAction } from "@common/scan-types";
import type { FileObservation, ShunfengerCommand, CommandDispatcher, WatchProfile } from "./types";

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

        const command: ShunfengerCommand = {
            id: randomUUID(),
            type: observation.isDirectory ? "scan-command" : "file-operation",
            profileId: profile.id,
            createdAt: Date.now(),
            payload: observation.isDirectory
                ? {
                      action: this.createScanAction(observation, profile),
                      source: "watch",
                      priority: profile.priority ?? this.options.defaultPriority,
                  }
                : {
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
            priority: profile.priority === "user" ? 0 : 10,
            timestamp: Date.now(),
            source: "auto",
            retryCount: 0,
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
