/**
 * 文昌引擎 - Wenchang Engine
 *
 * 神话背景：
 * 文昌帝君，道教中掌管文运和智慧的神祇，位列北斗七星之文昌星。
 * 传说文昌帝君本名张亚子，因德行高尚、才学渊博而位列仙班，
 * 主管天下读书人的功名利禄，保佑学子金榜题名，文思敏捷。
 * 文昌星照耀之处，必有文运昌盛、智慧汇聚之象，
 * 凡虔诚供奉文昌帝君者，皆能得其庇佑，学业有成，文采飞扬。
 *
 * 在本架构中，文昌引擎承担着偏好管理和配置存储的神圣使命，
 * 就如同文昌帝君庇佑学子的智慧选择一样，
 * 它负责记录用户的各种偏好设置，智能管理配置变更，
 * 确保用户的个性化需求得到完美保存和快速响应，
 * 为整个系统提供稳定可靠的配置管理服务。
 *
 * 核心能力：
 * - 用户偏好的持久化存储和快速检索
 * - 配置变更的版本控制和历史追踪
 * - 智能的增量更新和变更通知机制
 * - 多环境配置的同步和备份恢复
 * - 配置验证和格式标准化处理
 * - 高效的缓存机制和性能优化
 */

// 核心引擎
export { WenchangEngine } from "./core/WenchangEngine";
export type {
    WenchangEngineConfig,
    UserPreferences,
    PreferenceSnapshot,
    PreferenceDelta,
    PreferenceChangeEvent,
} from "./core/WenchangEngine";

// 适配器
export { WenchangAdapter } from "./adapters/WenchangAdapter";
export type { WenchangAdapterConfig } from "./adapters/WenchangAdapter";
