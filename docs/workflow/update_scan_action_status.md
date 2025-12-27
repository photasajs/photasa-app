# 📜 工作流: 更新扫描任务状态
> 支持pending→processing→failed状态转换，更新状态机字段（startedAt, error, retryCount等）

## 📑 基本信息
- **标识 (ID)**: `update_scan_action_status`
- **版本 (Version)**: `1.0.0`

## 📥 输入参数 (Inputs)
| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `path` | `string` | ✅ | 任务路径（唯一标识符） |
| `status` | `string` | ✅ | 新状态: pending | processing | failed |
| `updates` | `object` | ❌ | 额外字段更新（如startedAt, error, retryCount, maxRetries, progress） |

## 📤 输出规范 (Outputs)
工作流执行完成后返回如下结构：
```json
{
  "success": true,
  "task": "{{steps.merge_updates}}",
  "queue": "{{steps.replace_task}}",
  "queueSize": "{{steps.replace_task.length}}",
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
  restore_queue["千里眼：恢复当前队列"]
  find_task_index["查找任务索引"]
  restore_queue --> find_task_index
  validate_task_exists["验证任务存在"]
  find_task_index --> validate_task_exists
  get_current_task["获取当前任务"]
  validate_task_exists --> get_current_task
  merge_updates["合并状态更新"]
  get_current_task --> merge_updates
  replace_task["替换队列中的任务"]
  merge_updates --> replace_task
  persist_queue["千里眼：持久化队列"]
  replace_task --> persist_queue
  format_response["返回更新结果"]
  persist_queue --> format_response

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class restore_queue action
  class find_task_index action
  class validate_task_exists action
  class get_current_task action
  class merge_updates action
  class replace_task action
  class persist_queue action
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
  Orchestrator->>Orchestrator: 内置操作 [arrayFind]
  Orchestrator->>Orchestrator: 内置操作 [conditional]
  Orchestrator->>Orchestrator: 内置操作 [arrayGet]
  Orchestrator->>Orchestrator: 内置操作 [objectMerge]
  Orchestrator->>Orchestrator: 内置操作 [arraySet]
  Orchestrator->>+taiyi: callEngine
  taiyi-->>-Orchestrator: 返回结果
  Orchestrator->>Orchestrator: 内置操作 [return]
  Note over Orchestrator: 📤 结束工作流并返回结果
```