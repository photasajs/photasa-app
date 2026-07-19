# 📜 工作流: 恢复应用状态

> 从司命引擎恢复完整appState，包括folderTree, currentFolder等

## 📑 基本信息

- **标识 (ID)**: `restore_app_state`
- **版本 (Version)**: `1.0.0`

## 📥 输入参数 (Inputs)

| 参数名 | 类型 | 必填 | 描述 |
| :----- | :--- | :--- | :--- |

## 📤 输出规范 (Outputs)

工作流执行完成后返回如下结构：

```json
{
    "data": "{{steps.restore_app_state}}"
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
  restore_app_state["司命：恢复完整应用状态"]
  format_response["返回完整appState"]
  restore_app_state --> format_response

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class restore_app_state action
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
```
