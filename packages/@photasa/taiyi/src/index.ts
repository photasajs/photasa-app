/**
 * 太乙引擎 - Taiyi Engine
 *
 * 神话背景：
 * 太乙真人，道教中的至高神仙，位列十二金仙之首，是阐教的重要人物。
 * 传说太乙真人法力无边，智慧超群，善于统筹协调，能够调和阴阳五行，
 * 平衡天地万物。在《封神演义》中，太乙真人不仅武艺高强，
 * 更以其卓越的组织协调能力著称，能够统领众仙，协调各方力量，
 * 确保正义之师的胜利。太乙真人还掌握着起死回生的神通，
 * 能够化解危机，重新整合破碎的秩序。
 *
 * 在本架构中，太乙引擎承担着适配器管理和引擎协调的神圣使命，
 * 就如同太乙真人统领众仙、协调各方一样，
 * 它负责管理各个专业引擎的适配器，统一调度和协调，
 * 确保不同引擎之间能够高效协作，为整个系统提供统一的调用接口，
 * 在系统出现问题时能够快速恢复和重新整合。
 *
 * 核心能力：
 * - 适配器注册和生命周期管理
 * - 跨引擎调用协调和路由
 * - 统一的错误处理和重试机制
 * - 引擎状态监控和健康检查
 * - 依赖关系解析和优先级调度
 * - 性能监控和负载均衡
 */

// ⚠️ 关键：必须先导入所有适配器，确保@Adapter装饰器在引擎初始化前执行
// Adapters are external to the engine core
// import "../adapters";

// 核心引擎
export { TaiyiEngine } from "./core/TaiyiEngine";
export type { TaiyiEngineConfig } from "./core/TaiyiEngine";
export { Adapter, AdapterPriority } from "./core/adapter-decorators";
export type { IAdapter } from "./core/adapter-decorators";
export * from "./core/workflow";
