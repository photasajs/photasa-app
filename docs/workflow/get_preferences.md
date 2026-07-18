# 📜 工作流: 获取用户偏好设置
> 获取当前用户偏好设置

## 📑 基本信息
- **标识 (ID)**: `get_preferences`
- **版本 (Version)**: `1.0.0`
- **作者 (Author)**: Tianshu Engine

## 📥 输入参数 (Inputs)
| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `key` | `string` | ❌ | 可选的偏好键路径，如'ui.theme'，为空则返回全部 |

## 📤 输出规范 (Outputs)
定义输出：
```json
{
  "preferences": {
    "description": "偏好设置数据",
    "type": "object"
  },
  "success": {
    "description": "操作是否成功",
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
  validate_input{"验证输入参数"}
  return_validation_error["返回验证错误"]
  validate_input -- "否(False)" --> return_validation_error
  get_snapshot["获取偏好快照"]
  validate_input --> get_snapshot
  check_key_exists{"检查是否提供key"}
  extract_value["提取特定键值"]
  return_extracted["返回提取的值"]
  extract_value --> return_extracted
  check_key_exists -- "是(True)" --> extract_value
  return_full_snapshot["返回完整快照"]
  check_key_exists -- "否(False)" --> return_full_snapshot
  get_snapshot --> check_key_exists

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class validate_input condition
  class return_validation_error action
  class get_snapshot action
  class check_key_exists condition
  class extract_value action
  class return_extracted action
  class return_full_snapshot action
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

  Note over Orchestrator: 决策: 验证输入参数
  Orchestrator->>+wenchang: getCurrentSnapshot
  Note right of wenchang: 从文昌引擎获取偏好快照
  wenchang-->>-Orchestrator: 返回结果
  Note over Orchestrator: 决策: 检查是否提供key
  alt 满足条件
  Orchestrator->>Orchestrator: 内置操作 [setVariable]
  Orchestrator->>Orchestrator: 内置操作 [return]
  Note over Orchestrator: 📤 结束工作流并返回结果
  else 不满足条件
  Orchestrator->>Orchestrator: 内置操作 [return]
  Note over Orchestrator: 📤 结束工作流并返回结果
  end
```