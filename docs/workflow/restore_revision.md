# 📜 工作流: 恢复偏好设置到指定历史版本

> 恢复偏好设置到指定历史版本

## 📑 基本信息

- **标识 (ID)**: `restore_preference_revision`
- **版本 (Version)**: `1.0.0`
- **作者 (Author)**: Tianshu Engine

## 📥 输入参数 (Inputs)

| 参数名     | 类型      | 必填 | 描述                     |
| :--------- | :-------- | :--- | :----------------------- |
| `revision` | `number`  | ✅   | 要恢复到的版本号         |
| `backup`   | `boolean` | ❌   | 是否在恢复前备份当前设置 |

## 📤 输出规范 (Outputs)

定义输出：

```json
{
    "success": {
        "description": "恢复是否成功",
        "type": "boolean"
    },
    "revision": {
        "description": "恢复到的版本号",
        "type": "number"
    },
    "snapshot": {
        "description": "恢复后的偏好快照",
        "type": "object"
    },
    "backup": {
        "description": "恢复前的备份快照",
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
  validate_revision["验证版本号"]
  backup_current["备份当前偏好设置"]
  validate_revision --> backup_current
  restore_revision["恢复到指定版本"]
  backup_current --> restore_revision
  get_restored_snapshot["获取恢复后的偏好快照"]
  restore_revision --> get_restored_snapshot
  emit_restore_event["发送偏好恢复事件"]
  get_restored_snapshot --> emit_restore_event
  format_response["格式化恢复结果"]
  emit_restore_event --> format_response

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class validate_revision action
  class backup_current action
  class restore_revision action
  class get_restored_snapshot action
  class emit_restore_event action
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
  Note right of wenchang: 验证版本号
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: getCurrentSnapshot
  Note right of wenchang: 备份当前偏好设置
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: restoreRevision
  Note right of wenchang: 恢复到指定版本
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: getCurrentSnapshot
  Note right of wenchang: 获取恢复后的偏好快照
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: emitEvent
  Note right of wenchang: 发送偏好恢复事件
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: formatResponse
  Note right of wenchang: 格式化恢复结果
  wenchang-->>-Orchestrator: 返回结果
```
