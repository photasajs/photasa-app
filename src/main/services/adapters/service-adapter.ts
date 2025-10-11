/**
 * 服务适配器
 * 将现有服务适配为 IService 接口
 */

import { IService, ServiceStatus } from "../core/service-types";

/**
 * 通用服务适配器
 * 将现有服务包装为符合 IService 接口的服务
 */
export class ServiceAdapter implements IService {
    private startTime?: Date;
    private _status: ServiceStatus = {
        running: false,
        healthy: true,
    };

    constructor(
        public readonly name: string,
        private wrappedService: any,
        private initMethod?: string,
        private shutdownMethod?: string,
    ) {}

    async initialize(): Promise<void> {
        try {
            this.startTime = new Date();
            this._status.running = false;
            this._status.healthy = true;
            this._status.startTime = this.startTime;

            // 如果服务有初始化方法，调用它
            if (this.initMethod && typeof this.wrappedService[this.initMethod] === "function") {
                await this.wrappedService[this.initMethod]();
            }

            this._status.running = true;
            this._status.lastHealthCheck = new Date();
        } catch (error) {
            this._status.running = false;
            this._status.healthy = false;
            this._status.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }

    async shutdown(): Promise<void> {
        try {
            if (
                this.shutdownMethod &&
                typeof this.wrappedService[this.shutdownMethod] === "function"
            ) {
                await this.wrappedService[this.shutdownMethod]();
            }

            this._status.running = false;
        } catch (error) {
            this._status.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            // 如果服务有健康检查方法，使用它
            if (typeof this.wrappedService.healthCheck === "function") {
                const healthy = await this.wrappedService.healthCheck();
                this._status.healthy = healthy;
                this._status.lastHealthCheck = new Date();
                return healthy;
            }

            // 默认健康检查：服务正在运行且没有错误
            const healthy = this._status.running && !this._status.error;
            this._status.healthy = healthy;
            this._status.lastHealthCheck = new Date();
            return healthy;
        } catch (error) {
            this._status.healthy = false;
            this._status.error = error instanceof Error ? error.message : String(error);
            this._status.lastHealthCheck = new Date();
            return false;
        }
    }

    getStatus(): ServiceStatus {
        return { ...this._status };
    }

    /**
     * 获取被包装的原始服务
     */
    getWrappedService<T = any>(): T {
        return this.wrappedService;
    }
}
