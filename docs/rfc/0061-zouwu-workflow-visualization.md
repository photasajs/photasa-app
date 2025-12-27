# RFC 0061: 驺吾工作流可视化 (Workflow Visualization)

- **Start Date**: 2025-12-27
- **Status**: Draft
- **Author**: AI (Antigravity)

## Summary

本 RFC 提议为 `zouwu` CLI 添加工作流可视化功能，通过将 YAML 定义转换为 Mermaid 流程图源码，直观展现工作流的执行拓扑结构。

## Motivation

随着工作流逻辑复杂度的增加（包含大量的 `condition` 分支、`parallel` 并行和 `loop` 循环），仅通过阅读 YAML 文件难以快速建立全局逻辑概念。
可视化支持将：

1. **降低理解成本**：通过图形化界面快速识别关键路径。
2. **加速调试**：直白地发现逻辑断路或死循环。
3. **文档化**：自动生成可嵌入 Markdown 文档的流程图。

## Detailed Design

### 1. 节点映射 (Node Mapping)

| 步骤类型 (Type)    | Mermaid 节点形状 | 交互/连线逻辑                            |
| :----------------- | :--------------- | :--------------------------------------- |
| **Action/Builtin** | `[矩形]`         | 默认流转线                               |
| **Condition**      | `{菱形}`         | 分支标记 `onTrue` (是) 和 `onFalse` (否) |
| **Parallel**       | `[[双边矩形]]`   | 指向多个并行分支的起始步骤               |
| **Loop**           | `((圆形))`       | 包含内部步骤流转，尾步骤连回起点的粗点线 |

### 2. 连线与递归逻辑 (Recursion Logic)

- **Top-Down 驱动**：默认采用 `graph TD` 布局，符合人类阅读工作流的自然习惯。
- **深度优先遍历 (DFS)**：生成器递归遍历 `steps`、`onTrue`、`onFalse` 及 `branches`。
- **隐式与显式连线**：
    - **隐式**：父节点 (如 Condition) 自动指向其子分支的首个步骤。
    - **显式**：通过解析 `dependsOn` 属性，建立跨分支或同级的强制时序连线。
- **循环回溯**：在 `loop` 结构中，最后一个步骤会自动通过 `-. "回归" .->` 虚线连回循环起始节点，形成闭环。

### 3. 样式语义化 (Styling & Semantics)

为了提升可读性，生成的 Mermaid 源码中内置了专用的 CSS 类定义：

```mermaid
classDef condition fill:#fff4dd,stroke:#d4a017,stroke-width:2px;
classDef parallel fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
classDef loop fill:#f3e5f5,stroke:#4a148c,stroke-width:2px;
classDef action fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px;
```

### 4. CLI 接口与输出格式

新增 `zouwu graph` 命令：

```bash
# 基础用法：输出 Mermaid 源码
zouwu graph -i my-workflow.yml

# 输出为包装好的 Markdown 文件
zouwu graph -i my-workflow.yml -o workflow-doc.md

# 指定方向
zouwu graph -i my-workflow.yml -d LR
```

## Drawbacks

- **布局复杂性**：对于极其庞大的工作流，Mermaid 的自动布局可能会产生交叉线，影响观感。
- **静态分析局限**：无法预测运行时的动态跳转（如 `goto`，如果未来支持）。

## Alternatives

- **Cytoscape.js/GoJS**: 交互性更强，但难以直接集成到 CLI 和 GitHub Markdown。
- **自定义 Web 预览器**: 开发成本较高。

## Unresolved Questions

- 是否需要支持子图 (subgraph) 来更好地表示嵌套的循环或并行区间？
- 是否支持直接生成 SVG/PNG 图片（需要依赖额外的人界工具如 `mermaid-cli`）？
