# 📜 工作流: 获取扫描队列

> 从千里眼引擎管理的存储中恢复扫描队列

## 📑 基本信息

- **标识 (ID)**: `get_scanning_queue`
- **版本 (Version)**: `1.0.0`
- **作者 (Author)**: Tianshu Engine

## 📥 输入参数 (Inputs)

| 参数名   | 类型     | 必填 | 描述                                   |
| :------- | :------- | :--- | :------------------------------------- |
| `source` | `string` | ❌   | 获取来源标识（startup/manual/refresh） |

## 📤 输出规范 (Outputs)

工作流执行完成后返回如下结构：

```json
{
    "success": true,
    "queue": "{{steps.restore_queue}}",
    "queueSize": "{{steps.calculate_size}}",
    "source": "{{inputs.source}}",
    "timestamp": "{{now()}}"
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
  restore_queue["千里眼恢复扫描队列"]
  calculate_size["计算队列大小"]
  restore_queue --> calculate_size
  format_response["格式化返回结果"]
  calculate_size --> format_response

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class restore_queue action
  class calculate_size action
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
  Note right of taiyi: 调用千里眼引擎从~/.photasa/scan/scanning.json恢复扫描队列
  taiyi-->>-Orchestrator: 返回结果
  Orchestrator->>Orchestrator: 内置操作 [arrayCount]
  Orchestrator->>Orchestrator: 内置操作 [return]
  Note over Orchestrator: 📤 结束工作流并返回结果
```
