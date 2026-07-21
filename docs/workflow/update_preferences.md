# 📜 工作流: 更新用户偏好设置

> 更新用户偏好设置

## 📑 基本信息

- **标识 (ID)**: `update_preferences`
- **版本 (Version)**: `1.0.0`
- **作者 (Author)**: Tianshu Engine

## 📥 输入参数 (Inputs)

| 参数名   | 类型     | 必填 | 描述                     |
| :------- | :------- | :--- | :----------------------- |
| `delta`  | `object` | ✅   | 要更新的偏好设置增量对象 |
| `source` | `string` | ❌   | 更新来源标识             |

## 📤 输出规范 (Outputs)

定义输出：

```json
{
    "success": {
        "description": "更新是否成功",
        "type": "boolean"
    },
    "updated": {
        "description": "实际更新的偏好项",
        "type": "object"
    },
    "snapshot": {
        "description": "更新后的完整偏好快照",
        "type": "object"
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
  validate_delta["验证偏好更新数据"]
  simple_test["简单测试步骤"]
  validate_delta --> simple_test
  check_validation{"check_validation"}
  return_validation_error["return_validation_error"]
  check_validation -- "否(False)" --> return_validation_error
  simple_test --> check_validation
  sanitize_values["清理和验证偏好值"]
  check_validation --> sanitize_values
  update_engine["调用文昌引擎更新偏好"]
  sanitize_values --> update_engine
  get_updated_snapshot["获取更新后的偏好快照"]
  update_engine --> get_updated_snapshot
  emit_change_event["发送偏好变更事件"]
  get_updated_snapshot --> emit_change_event
  format_response["格式化返回结果"]
  emit_change_event --> format_response

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class validate_delta action
  class simple_test action
  class check_validation condition
  class return_validation_error action
  class sanitize_values action
  class update_engine action
  class get_updated_snapshot action
  class emit_change_event action
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
  Note right of wenchang: 验证偏好更新数据
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>Orchestrator: 内置操作 [log]
  Note over Orchestrator: 决策: check_validation
  Orchestrator->>+wenchang: sanitize
  Note right of wenchang: 清理和验证偏好值
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: updatePreferences
  Note right of wenchang: 调用文昌引擎更新偏好
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: getCurrentSnapshot
  Note right of wenchang: 获取更新后的偏好快照
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: emitEvent
  Note right of wenchang: 发送偏好变更事件
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: formatResponse
  Note right of wenchang: 格式化返回结果
  wenchang-->>-Orchestrator: 返回结果
```
