# 📜 工作流: 重置用户偏好设置到默认值

> 重置用户偏好设置到默认值

## 📑 基本信息

- **标识 (ID)**: `reset_preferences`
- **版本 (Version)**: `1.0.0`
- **作者 (Author)**: Tianshu Engine

## 📥 输入参数 (Inputs)

| 参数名         | 类型     | 必填 | 描述                     |
| :------------- | :------- | :--- | :----------------------- | --- | ------- | ---- | ----------- |
| `scope`        | `string` | ❌   | 重置范围：all            | ui  | display | scan | performance |
| `confirmToken` | `string` | ❌   | 确认令牌，用于防止误操作 |

## 📤 输出规范 (Outputs)

定义输出：

```json
{
    "success": {
        "description": "重置是否成功",
        "type": "boolean"
    },
    "snapshot": {
        "description": "重置后的偏好快照",
        "type": "object"
    },
    "backup": {
        "description": "重置前的备份快照",
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
  validate_scope["验证重置范围"]
  backup_current["备份当前偏好设置"]
  validate_scope --> backup_current
  reset_engine["调用文昌引擎重置偏好"]
  backup_current --> reset_engine
  get_reset_snapshot["获取重置后的偏好快照"]
  reset_engine --> get_reset_snapshot
  emit_reset_event["发送偏好重置事件"]
  get_reset_snapshot --> emit_reset_event
  format_response["格式化返回结果"]
  emit_reset_event --> format_response

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class validate_scope action
  class backup_current action
  class reset_engine action
  class get_reset_snapshot action
  class emit_reset_event action
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
  Note right of wenchang: 验证重置范围
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: getCurrentSnapshot
  Note right of wenchang: 备份当前偏好设置
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: resetToDefaults
  Note right of wenchang: 调用文昌引擎重置偏好
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: getCurrentSnapshot
  Note right of wenchang: 获取重置后的偏好快照
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: emitEvent
  Note right of wenchang: 发送偏好重置事件
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: formatResponse
  Note right of wenchang: 格式化返回结果
  wenchang-->>-Orchestrator: 返回结果
```
