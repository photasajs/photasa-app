/**
 * 引擎模块统一入口
 *
 * 神话背景：
 * 在古代神话中，各路神仙各司其职，但需要一个统一的入口来协调众神。
 * 本文件就如同神界的"神籍册"，记录和统一管理所有神位引擎。
 *
 * 架构说明：
 * - 太乙(Taiyi): 适配器管理引擎，负责统筹调度各个引擎
 * - 天枢(Tianshu): 工作流编排引擎，负责复杂任务的分解和调度
 * - 文昌(Wenchang): 偏好管理引擎，负责用户设置和配置管理
 * - 马良(MaLiang): 图像处理引擎，负责各种格式的图像处理
 * - 顺风耳(Shunfenger): 音频处理引擎，负责音频文件的处理
 * - 司簿(Sibu): 缓存和存储引擎，负责数据的快速访问
 */

// 太乙 - 适配器管理引擎
export * from "./taiyi";

// 天枢 - 工作流编排引擎 (Moved to @photasa/tianshu)
export * from "@photasa/tianshu";

// 文昌 - 偏好管理引擎
export * from "./wenchang";

// 马良 - 图像处理引擎
export * from "./maliang";

// 顺风耳 - 音频处理引擎
export * from "./shunfenger";

// 思补 - 缓存存储引擎
export * from "./sibu";

// 引擎通用类型和接口
export type { EngineCallResult } from "./workflow";
