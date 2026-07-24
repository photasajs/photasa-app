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
 * - 顺风耳(Shunfenger): 文件监听引擎，负责文件系统变化监听
 * - 千里眼(Qianliyan): 文件扫描引擎，负责文件系统扫描和媒体发现
 * - 司簿(Sibu): 缓存和存储引擎，负责数据的快速访问
 */

// 太乙 - 适配器管理引擎
// export * from "./taiyi"; // Moved to @photasa/taiyi

// 天枢 - 工作流编排引擎 (Moved to @photasa/tianshu)
export * from "@photasa/tianshu";

// 马良 - 图像处理引擎 (Moved to @photasa/maliang)
export * from "@photasa/maliang";

// 顺风耳 - 文件监听引擎 (Moved to @photasa/shunfenger)
export * from "@photasa/shunfenger";

// 千里眼 - 文件扫描引擎 (Moved to @photasa/qianliyan)
export * from "@photasa/qianliyan";

// 思补 - 缓存存储引擎
export * from "./adapters/SibuAdapter"; // Export adapter instead of folder

// 跨引擎契约见 @photasa/engine-contracts（避免与顺风耳 FileObservation 类型冲突，不在此 re-export）
