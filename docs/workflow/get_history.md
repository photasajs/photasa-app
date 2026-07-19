# 📜 工作流: 获取偏好设置变更历史

> 获取偏好设置变更历史

## 📑 基本信息

- **标识 (ID)**: `get_preference_history`
- **版本 (Version)**: `1.0.0`
- **作者 (Author)**: Tianshu Engine

## 📥 输入参数 (Inputs)

| 参数名   | 类型     | 必填 | 描述                   |
| :------- | :------- | :--- | :--------------------- |
| `limit`  | `number` | ❌   | 返回的历史记录数量限制 |
| `offset` | `number` | ❌   | 历史记录的偏移量       |

## 📤 输出规范 (Outputs)

定义输出：

```json
{
    "data": {
        "description": "偏好设置历史记录",
        "type": "array"
    },
    "count": {
        "description": "返回的记录数量",
        "type": "number"
    },
    "success": {
        "description": "获取是否成功",
        "type": "boolean"
    }
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
  validate_params["验证输入参数"]
  get_history_from_engine["从文昌引擎获取历史记录"]
  validate_params --> get_history_from_engine
  format_response["格式化历史数据"]
  get_history_from_engine --> format_response

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class validate_params action
  class get_history_from_engine action
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
  participant wenchang

  Orchestrator->>+wenchang: validate
  Note right of wenchang: 验证输入参数
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: getHistory
  Note right of wenchang: 从文昌引擎获取历史记录
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: formatResponse
  Note right of wenchang: 格式化历史数据
  wenchang-->>-Orchestrator: 返回结果
```
