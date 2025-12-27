# 📜 工作流: 打开外部链接
> 接收外部链接 URL，通过太白金星适配器打开

## 📑 基本信息
- **标识 (ID)**: `shell_openExternal`
- **版本 (Version)**: `1.0.0`
- **作者 (Author)**: Tianshu Engine

## 📥 输入参数 (Inputs)
| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `url` | `string` | ✅ | 要打开的外部链接 URL |

## 📤 输出规范 (Outputs)
定义输出：
```json
{
  "success": {
    "description": "是否成功打开链接",
    "type": "boolean",
    "path": "success"
  },
  "message": {
    "description": "操作结果消息",
    "type": "string",
    "path": "message"
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
  open_external["太白金星：打开外部链接"]

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class open_external action
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
  participant taibaijinxing

  Orchestrator->>+taibaijinxing: openExternal
  taibaijinxing-->>-Orchestrator: 返回结果
```