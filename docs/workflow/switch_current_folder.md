# 📜 工作流: 切换当前文件夹
> 切换当前文件夹，自动获取.photasa.json配置并更新appState

## 📑 基本信息
- **标识 (ID)**: `switch_current_folder`
- **版本 (Version)**: `1.0.0`
- **作者 (Author)**: Tianshu Engine

## 📥 输入参数 (Inputs)
| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `folder` | `string` | ✅ | 目标文件夹路径 |
| `source` | `string` | ❌ | 切换来源标识 |

## 📤 输出规范 (Outputs)
工作流执行完成后返回如下结构：
```json
{
  "success": true,
  "data": {
    "appState": {
      "currentFolder": "{{inputs.folder}}",
      "currentFolderConfig": "{{steps.get_folder_config.result.config}}"
    },
    "metadata": {
      "configExists": "{{steps.get_folder_config.result.exists}}",
      "source": "{{inputs.source}}"
    }
  },
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
  validate_folder["验证文件夹路径"]
  check_validation{"检查验证结果"}
  return_validation_error["返回验证错误"]
  check_validation -- "否(False)" --> return_validation_error
  validate_folder --> check_validation
  get_folder_config["获取文件夹配置"]
  check_validation --> get_folder_config
  log_config_result["记录配置获取结果"]
  get_folder_config --> log_config_result
  build_appstate_delta["构造appState更新数据"]
  log_config_result --> build_appstate_delta
  update_appstate["更新appState"]
  build_appstate_delta --> update_appstate
  log_update_result["记录更新结果"]
  update_appstate --> log_update_result
  format_response["格式化返回结果"]
  log_update_result --> format_response

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class validate_folder action
  class check_validation condition
  class return_validation_error action
  class get_folder_config action
  class log_config_result action
  class build_appstate_delta action
  class update_appstate action
  class log_update_result action
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

  Orchestrator->>Orchestrator: 内置操作 [validate]
  Note over Orchestrator: 决策: 检查验证结果
  Orchestrator->>+taiyi: callEngine
  Note right of taiyi: 调用司簿引擎读取.photasa.json配置
  taiyi-->>-Orchestrator: 返回结果
  Orchestrator->>Orchestrator: 内置操作 [log]
  Orchestrator->>Orchestrator: 内置操作 [transform]
  Orchestrator->>+taiyi: callEngine
  Note right of taiyi: 调用司命引擎持久化appState
  taiyi-->>-Orchestrator: 返回结果
  Orchestrator->>Orchestrator: 内置操作 [log]
  Orchestrator->>Orchestrator: 内置操作 [return]
  Note over Orchestrator: 📤 结束工作流并返回结果
```