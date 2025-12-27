# 📜 工作流: 导入用户偏好设置
> 导入用户偏好设置

## 📑 基本信息
- **标识 (ID)**: `import_preferences`
- **版本 (Version)**: `1.0.0`
- **作者 (Author)**: Tianshu Engine

## 📥 输入参数 (Inputs)
| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `data` | `string` | ✅ | 要导入的偏好设置JSON数据 |
| `backup` | `boolean` | ❌ | 是否在导入前备份当前设置 |

## 📤 输出规范 (Outputs)
定义输出：
```json
{
  "success": {
    "description": "导入是否成功",
    "type": "boolean"
  },
  "snapshot": {
    "description": "导入后的偏好快照",
    "type": "object"
  },
  "backup": {
    "description": "导入前的备份快照",
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
  validate_data["验证导入数据格式"]
  backup_current["备份当前偏好设置"]
  validate_data --> backup_current
  import_to_engine["导入偏好到文昌引擎"]
  backup_current --> import_to_engine
  get_imported_snapshot["获取导入后的偏好快照"]
  import_to_engine --> get_imported_snapshot
  emit_import_event["发送偏好导入事件"]
  get_imported_snapshot --> emit_import_event
  format_response["格式化导入结果"]
  emit_import_event --> format_response

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class validate_data action
  class backup_current action
  class import_to_engine action
  class get_imported_snapshot action
  class emit_import_event action
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
  Note right of wenchang: 验证导入数据格式
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: getCurrentSnapshot
  Note right of wenchang: 备份当前偏好设置
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: importPreferences
  Note right of wenchang: 导入偏好到文昌引擎
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: getCurrentSnapshot
  Note right of wenchang: 获取导入后的偏好快照
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: emitEvent
  Note right of wenchang: 发送偏好导入事件
  wenchang-->>-Orchestrator: 返回结果
  Orchestrator->>+wenchang: formatResponse
  Note right of wenchang: 格式化导入结果
  wenchang-->>-Orchestrator: 返回结果
```