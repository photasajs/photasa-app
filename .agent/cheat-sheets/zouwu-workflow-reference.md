# 驺吾(Zouwu)工作流代理速查表 (Cheat Sheet for AI Agent)

> 📜 仙术纲领：本速查表旨在为维护驺吾工作流系统的 AI 代理提供快速参考，确保在命名空间、校验逻辑及可视化方面的一致性。

## 1. 命名空间映射 (Package Mapping)

| 旧包名 (Old)              | 新包名 (New)                  | 目录位置 (Location)                    |
| :------------------------ | :---------------------------- | :------------------------------------- |
| `tianshu`                 | `@systembug/tianshu`          | `packages/@systembug/tianshu`          |
| `zouwu-workflow`          | `@zouwu-wf/workflow`          | `packages/@zouwu-wf/workflow`          |
| `zouwu-expression-parser` | `@zouwu-wf/expression-parser` | `packages/@zouwu-wf/expression-parser` |
| `workflow-cli`            | `@zouwu-wf/cli`               | `packages/@zouwu-wf/cli`               |

## 2. 核心校验规范 (Core Validation Rules)

### 🚫 RFC 0037: 占位符拦截

- **规则**：严禁使用 `${variable}` 格式的占位符。
- **强制使用**：必须使用双花括号 `{{variable}}`。
- **实现位置**：`WorkflowValidator.validateStrictFormatting`。

### 🚫 RFC 0045: 显式路径保护

- **规则**：YAML 定义中严禁显式出现 `.output` (如 `steps.id.output`)。
- **推荐格式**：直接访问 `steps.id` 或 `steps.id.fieldName`。
- **背景**：`.output` 是引擎运行时的内部实现细节。

## 3. CLI 工具指令 (Zouwu CLI Commands)

入口命令：`zouwu` (在 `@photasa/desktop` 中可通过 `npm run workflow:validate` 触发)

| 指令 (Command)   | 功能 (Function)        | 常用参数 (Options)                                    |
| :--------------- | :--------------------- | :---------------------------------------------------- |
| `validate`       | 校验工作流 YAML 语法   | `-d <dir>`, `-c <context.json>`                       |
| `graph`          | 生成 Mermaid 流程图    | `-i <file>`, `-d <dir> -o <out_dir>`, `--no-markdown` |
| `generate-types` | 从 Schema 生成 TS 类型 | `-s <schema>`, `-o <out.ts>`                          |

## 4. 可视化映射参考 (Mermaid Mapping)

- **Condition**：`id{"label"}` (菱形)。
- **Parallel**：`id[["label"]]` (双边矩形)。
- **Loop**：`id(( "label" ))` (圆形)，尾步骤虚线回连。
- **Action**：`id["label"]` (标准矩形)。

---

🌌 _维持好品味，严守典制。_
