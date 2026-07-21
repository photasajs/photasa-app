# 📜 工作流: 更新文件夹树

> 接收文件夹树，恢复现有，替换/合并，持久化，返回完整树

## 📑 基本信息

- **标识 (ID)**: `update_folder_tree`
- **版本 (Version)**: `1.0.0`

## 📥 输入参数 (Inputs)

| 参数名 | 类型    | 必填 | 描述                              |
| :----- | :------ | :--- | :-------------------------------- |
| `tree` | `array` | ✅   | 要更新的文件夹树数组 FolderNode[] |

## 📤 输出规范 (Outputs)

工作流执行完成后返回如下结构：

```json
{
    "success": true,
    "folderTree": "{{steps.update_tree}}",
    "nodeCount": "{{steps.count_nodes}}",
    "persisted": true
}
```

## 📊 流程执行图 (Flowchart)

```mermaid
%%{init: {
            'theme': 'base',
            'themeVariables': {
                'fontFamily': 'Inter, system-ui, sans-serif',
                'primaryTextColor': '#586e75',
                'mainBkg': 'transparent',
                'nodeBorder': '#93a1a1',
                'lineColor': '#839496'
            }
        } }%%
graph TD
  restore_tree["司命：恢复当前文件夹树"]
  update_tree["替换文件夹树（全量更新）"]
  restore_tree --> update_tree
  persist_tree["司命：持久化文件夹树"]
  update_tree --> persist_tree
  count_nodes["计算节点数量"]
  persist_tree --> count_nodes
  format_response["返回完整文件夹树"]
  count_nodes --> format_response

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class restore_tree action
  class update_tree action
  class persist_tree action
  class count_nodes action
  class format_response action
```

## 🔄 服务交互时序 (Sequence Diagram)

```mermaid
%%{init: {
              'theme': 'base',
              'themeVariables': {
                'fontFamily': 'Inter, system-ui, sans-serif',
                'primaryTextColor': '#586e75',
                'mainBkg': 'transparent',
                'actorBkg': 'transparent',
                'actorBorder': '#93a1a1',
                'actorTextColor': '#586e75',
                'signalColor': '#839496',
                'signalTextColor': '#586e75',
                'labelBoxBkgColor': 'transparent',
                'labelBoxBorderColor': '#93a1a1',
                'labelTextColor': '#586e75',
                'loopTextColor': '#586e75',
                'noteBkgColor': '#eee8d588',
                'noteTextColor': '#586e75'
              }
            } }%%
sequenceDiagram
  autonumber
  participant Orchestrator
  participant taiyi

  Orchestrator->>+taiyi: callEngine
  taiyi-->>-Orchestrator: 返回结果
  Orchestrator->>Orchestrator: 内置操作 [return]
  Note over Orchestrator: 📤 结束工作流并返回结果
  Orchestrator->>+taiyi: callEngine
  taiyi-->>-Orchestrator: 返回结果
  Orchestrator->>Orchestrator: 内置操作 [arrayCount]
  Orchestrator->>Orchestrator: 内置操作 [return]
  Note over Orchestrator: 📤 结束工作流并返回结果
```
