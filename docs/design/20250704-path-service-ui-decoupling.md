# PathService 与 UI 目录树分层解耦最佳实践

## 1. 分层原则

- PathService 只聚焦于“目录/路径的底层操作”，如路径归一化、拼接、父子关系判断、根目录提取等。
- PathService 不关心 UI 层的显示、结构、渲染、DataNode、children、title、key 等 UI 相关属性。
- UI 层主导目录树结构、DataNode 类型、children 递归、UI 交互等，service 只作为工具调用。
- 分层是“自下而上”逐层解耦，service 层为上层提供原子能力，UI 层自由组合和扩展，不反向依赖 service 的结构约束。

## 2. PathService 推荐接口

- normalizePath(path: string): string
- mergePath(left: string, right: string): string
- toFileName(path: string): string
- toDirName(path: string): string
- isFileUnderFolder(file: string, folder: string): boolean
- isHiddenFile(path: string): boolean
- isAbsolutePath(path: string): boolean
- relativePath(from: string, to: string): string
- resolvePath(...segments: string[]): string
- getRoot(path: string): string

## 3. UI 层职责

- 目录树结构、DataNode 类型、children 递归、UI 交互等全部由 UI 层主导。
- 目录树算法（如 buildDataNode、cleanDataNode、traverseTree）以 UI 需求为核心，service 只作为工具调用。
- UI 层自由组织自己的数据结构（如 DataNode），只在需要时调用 PathService 的方法。

## 4. 反例（应避免）

- service 层暴露 DataNode 结构、children 递归、UI 相关属性，导致 UI 层被反向约束，失去灵活性。
- service 层参与 UI 组件的渲染、交互、状态管理等。

## 5. 推荐模式

- PathService 只提供路径/目录相关的原子操作，接口简洁、平台无关。
- UI 层自由组合、扩展、渲染自己的目录树结构。
- 目录树算法、UI 交互、渲染等全部在 UI 层实现，service 层不参与。

## 6. 典型调用链

1. UI 组件/算法层通过 DI 注入 PathService
2. 目录树算法只依赖 PathService，不直接用 path
3. 目录树结构、DataNode 类型、children 递归等全部由 UI 层主导

---

本规范为团队分层解耦、平台兼容、长期可维护的最佳实践，后续如有扩展请持续补充。
