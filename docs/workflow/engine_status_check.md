# 📜 工作流: 引擎状态检查工作流
> 通过太乙引擎检查所有注册引擎的状态

## 📑 基本信息
- **标识 (ID)**: `engine_status_check`
- **版本 (Version)**: `1.0.0`
- **作者 (Author)**: Tianshu Engine

## 📥 输入参数 (Inputs)
*无定义输入参数*

## 📤 输出规范 (Outputs)
*该工作流无显式返回定义*

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
  get_all_engine_status["获取所有引擎状态"]
  get_available_engines["获取可用引擎列表"]
  get_all_engine_status --> get_available_engines
  check_specific_engine["检查特定引擎状态"]
  get_all_engine_status --> check_specific_engine
  test_wenchang_engine["测试文昌引擎功能"]
  get_available_engines --> test_wenchang_engine
  calculate_statistics["计算统计信息"]
  get_available_engines --> calculate_statistics
  compile_detailed_report["编译详细报告"]
  calculate_statistics --> compile_detailed_report
  test_wenchang_engine --> compile_detailed_report
  compile_simple_report["编译简单报告"]
  calculate_statistics --> compile_simple_report
  return_final_result["返回最终结果"]
  compile_detailed_report --> return_final_result
  compile_simple_report --> return_final_result

  %% 🎨 单一自适应 Solarized 配色
  classDef condition fill:#b5890022,stroke:#b58900,stroke-width:2px,color:#586e75;
  classDef parallel fill:#268bd222,stroke:#268bd2,stroke-width:2px,color:#268bd2;
  classDef loop fill:#6c71c422,stroke:#6c71c4,stroke-width:2px,color:#6c71c4;
  classDef action fill:#85990022,stroke:#859900,stroke-width:2px,color:#859900;
  class get_all_engine_status action
  class get_available_engines action
  class check_specific_engine action
  class test_wenchang_engine action
  class calculate_statistics action
  class compile_detailed_report action
  class compile_simple_report action
  class return_final_result action
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
  participant builtin

  Orchestrator->>+taiyi: getAllEngineStatus
  Note right of taiyi: 通过太乙引擎获取所有注册引擎的状态
  taiyi-->>-Orchestrator: 返回结果
  Orchestrator->>+taiyi: getAvailableEngines
  Note right of taiyi: 获取当前可用的引擎列表
  taiyi-->>-Orchestrator: 返回结果
  Orchestrator->>+taiyi: getEngineStatus
  Note right of taiyi: 检查指定引擎的状态
  taiyi-->>-Orchestrator: 返回结果
  Orchestrator->>+taiyi: callEngine
  Note right of taiyi: 测试文昌引擎的基本功能
  taiyi-->>-Orchestrator: 返回结果
  Orchestrator->>+builtin: calculate
  Note right of builtin: 计算引擎状态统计
  builtin-->>-Orchestrator: 返回结果
  Orchestrator->>+builtin: compile
  Note right of builtin: 编译包含所有细节的状态报告
  builtin-->>-Orchestrator: 返回结果
  Orchestrator->>+builtin: compile
  Note right of builtin: 编译简化的状态报告
  builtin-->>-Orchestrator: 返回结果
  Orchestrator->>+builtin: return
  Note right of builtin: 返回状态检查的最终结果
  builtin-->>-Orchestrator: 返回结果
```