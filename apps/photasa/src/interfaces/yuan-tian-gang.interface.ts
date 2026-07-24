/**
 * 袁天罡钦天监服务接口契约
 * 负责与天界(Main进程)通信，处理房玄龄的诏令
 */

import type { Zhaoling, ZhaolingResponse } from "./fang-xuan-ling.interface";
export type { Zhaoling, ZhaolingResponse } from "./fang-xuan-ling.interface";
/**
 * 符箓数据结构
 * 符箓：袁天罡向天枢发送的天界通信文书
 */
export interface Fulu {
    intent: string; // 祈请意图
    context?: Record<string, unknown>; // 上下文信息
    timestamp: number; // 发送时间
    source: string; // 来源
    urgency: "critical" | "high" | "normal"; // 紧急程度
}

export interface FuluResponse {
    success: boolean; // 天枢是否响应
    intent: string; // 原始意图
    context?: Record<string, unknown>; // 原始上下文
    timestamp: number; // 回馈时间
    response?: unknown; // 天枢回馈内容
    error?: string; // 错误信息
    blessing?: string; // 天枢加持
}

import type { Emitter } from "mitt";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type { ImportProgress, ImportResult, LogEntry } from "@photasa/common";

type Unlisten = () => void;

export interface UpdateCapability {
    check(): Promise<{ hasUpdate: boolean; version?: string; info?: unknown }>;
    download(): Promise<void>;
    install(): Promise<void>;
    status(): Promise<Record<string, unknown>>;
    version(): Promise<string>;
    configure(patch: Record<string, unknown>): Promise<boolean>;
    onAvailable(callback: (data: { version: string; info?: unknown }) => void): Promise<Unlisten>;
    onProgress(callback: (progress: number) => void): Promise<Unlisten>;
    onDownloaded(callback: (info: unknown) => void): Promise<Unlisten>;
    onError(callback: (error: string) => void): Promise<Unlisten>;
    onStatus(callback: (status: unknown) => void): Promise<Unlisten>;
}

export interface LogViewerCapability {
    open(): Promise<{ success: boolean; message: string }>;
    close(): Promise<{ success: boolean; message: string }>;
    onEntry(callback: (entry: LogEntry) => void): Promise<Unlisten>;
    onToggle(callback: () => void): Promise<Unlisten>;
}

export interface WindowCapability {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    unmaximize(): Promise<void>;
    closeWindow(): Promise<void>;
    closeSplashscreen(): Promise<void>;
    reload(): Promise<void>;
    isMac(): Promise<boolean>;
    isMaximized(): Promise<boolean>;
    onMaximized(callback: () => void): Promise<Unlisten>;
    onUnmaximized(callback: () => void): Promise<Unlisten>;
    onMaximizedState(callback: (state: boolean) => void): Promise<Unlisten>;
}

export interface ImportEventPort {
    ready(): Promise<void>;
    onProgress(callback: (progress: ImportProgress) => void): () => void;
    onComplete(callback: (result: ImportResult) => void): () => void;
    onError(callback: (error: { importId?: string; error: Error }) => void): () => void;
    onPreviewProgress(callback: (progress: unknown, files?: unknown[]) => void): () => void;
}

/**
 * 袁天罡钦天监服务接口
 * 接收房玄龄的诏令，与天枢引擎通信
 */
export interface IYuanTianGangService {
    readonly importEvents: ImportEventPort;
    readonly updates: UpdateCapability;
    readonly logs: LogViewerCapability;
    readonly windows: WindowCapability;
    readonly desktop: UpdateCapability & LogViewerCapability & WindowCapability;
    /**
     * 接收并执行房玄龄的诏令
     * @param zhaoling 诏令
     * @returns 执行结果
     */
    executeZhaoling(zhaoling: Zhaoling): Promise<ZhaolingResponse>;

    /**
     * 设置启奏事件总线
     * @param qizouBus mitt事件总线
     */
    setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void;
}

/**
 * Vue注入令牌
 * 用于provide/inject的类型安全标识
 */
export const YUAN_TIAN_GANG_TOKEN = Symbol("袁天罡");
