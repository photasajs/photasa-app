import type { FileOperation, ScanAction } from "@photasa/common";

export type WatchEventKind =
    | "add"
    | "change"
    | "delete"
    | "addDir"
    | "deleteDir"
    | "ready"
    | "error";

export interface WatchProfile {
    id: string;
    rootPath: string;
    recursive: boolean;
    ignoreGlobs: string[];
    thumbnailSize: number;
    autoStart: boolean;
    priority: "user" | "background";
    createdAt: number;
    updatedAt: number;
}

export interface FileObservationMetadata {
    size?: number;
    mtimeMs?: number;
    ctimeMs?: number;
    hash?: string;
    thumbnailSize?: number;
}

export interface FileObservation {
    id: string;
    path: string;
    kind: WatchEventKind;
    isDirectory: boolean;
    isMediaFile: boolean;
    detectedAt: number;
    profileId: string;
    metadata?: FileObservationMetadata;
}

export type ShunfengerStatusState = "initializing" | "ready" | "paused" | "error" | "flushing";

export interface ShunfengerStatusEvent {
    type: "status";
    profileId?: string;
    state: ShunfengerStatusState;
    pendingEvents?: number;
    backlogSize?: number;
    message?: string;
    error?: Error;
    timestamp: number;
}

export interface ShunfengerObservationEvent {
    type: "observation";
    observation: FileObservation;
    timestamp: number;
}

export interface ShunfengerCommandEvent {
    type: "command";
    command: ShunfengerCommand;
    timestamp: number;
}

export type ShunfengerEngineEvent =
    | ShunfengerStatusEvent
    | ShunfengerObservationEvent
    | ShunfengerCommandEvent;

export type ShunfengerCommandType = "scan-command" | "file-operation";

export interface ScanCommandPayload {
    action: ScanAction;
    source: "watch";
    priority: "user" | "background";
}

export interface FileOperationPayload {
    operation: FileOperation;
}

export interface ShunfengerCommand {
    id: string;
    type: ShunfengerCommandType;
    profileId: string;
    payload: ScanCommandPayload | FileOperationPayload;
    createdAt: number;
}

export type CommandDispatcher = (command: ShunfengerCommand) => void;

export type ObservationListener = (event: FileObservation) => void;

export type EngineEventListener = (event: ShunfengerEngineEvent) => void;
