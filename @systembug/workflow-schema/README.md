# @systembug/workflow-schema

🌌 天枢工作流Schema核心包 - 基于RFC 0039的Schema定义和运行时验证器

## 📜 项目概述

`@systembug/workflow-schema` 是核心Schema包，基于[RFC 0039: 天枢工作流语法规范](../../../docs/rfc/0039-tianshu-workflow-syntax-specification.md)设计，为天枢引擎工作流系统提供JSON Schema定义、TypeScript类型和运行时验证器。

**📦 相关包**：
- `@systembug/workflow-cli` - 命令行工具包，提供代码生成和项目管理功能

## 🌟 核心特性

### ✅ JSON Schema定义
- **工作流主Schema**: 定义完整的工作流结构和语法
- **步骤类型Schema**: 详细定义各种步骤类型（condition、action、builtin、loop、parallel、workflow）
- **模板语法Schema**: 支持`{{}}`模板变量和JavaScript表达式

### 🔧 运行时验证器
- **基于Ajv的验证器**: 高性能的JSON Schema验证
- **中文错误信息**: 提供本地化的中文错误提示
- **严格类型检查**: 确保工作流结构的正确性

### 📚 TypeScript类型支持
- **完整类型定义**: 基于Schema生成的TypeScript接口
- **模板语法类型**: 支持变量引用和表达式的类型定义
- **强类型保证**: 编译时类型检查支持

## 🚀 快速开始

### 安装

```bash
npm install @systembug/workflow-schema
# 或者全局安装CLI工具
npm install -g @systembug/workflow-schema
```

### CLI使用

```bash
# 初始化新项目
workflow-schema init my-workflow-project

# 生成TypeScript类型
workflow-schema generate-types -s workflow.schema.json -o types.ts

# 生成验证器
workflow-schema generate-validators -s workflow.schema.json -o validators.ts

# 批量生成所有代码
workflow-schema generate-all -s schemas/ -o generated/

# 验证工作流文件
workflow-schema validate -f my-workflow.yml --verbose
```

### 编程接口

```typescript
import {
  validateWorkflow,
  generateTypesFromSchema,
  WorkflowDefinition
} from '@systembug/workflow-schema';

// 验证工作流
const workflow: WorkflowDefinition = {
  id: 'example_workflow',
  name: '示例工作流',
  version: '1.0.0',
  steps: [
    {
      id: 'hello_world',
      type: 'builtin',
      action: 'log',
      input: {
        level: 'info',
        message: 'Hello, World!'
      }
    }
  ]
};

const result = validateWorkflow(workflow);
if (result.valid) {
  console.log('🌌 工作流验证通过');
} else {
  console.error('❌ 验证失败:', result.errors);
}

// 生成类型定义
await generateTypesFromSchema({
  schemaPath: './schemas/workflow.schema.json',
  outputPath: './types/workflow.types.ts',
  generateDocs: true
});
```

## 📋 工作流语法示例

### 基础工作流结构

```yaml
id: "preference_update"
name: "偏好设置更新"
description: "更新用户偏好设置的完整流程"
version: "1.0.0"
author: "天枢引擎"

triggers:
  - intent: "update_preferences"

inputs:
  - name: "delta"
    type: "object"
    required: true
    description: "偏好设置变更数据"

steps:
  - id: "validate_input"
    type: "condition"
    description: "验证输入数据"
    condition:
      operator: "exists"
      value: "{{inputs.delta}}"
    onTrue:
      - id: "apply_changes"
        type: "action"
        service: "wenchang"
        action: "applyDelta"
        input:
          delta: "{{inputs.delta}}"
        output_schema:
          type: "object"
          properties:
            success: { type: "boolean" }
            data: { type: "object" }
    onFalse:
      - id: "return_error"
        type: "builtin"
        action: "error"
        input:
          message: "输入数据无效"
          code: "INVALID_INPUT"

  - id: "return_result"
    type: "builtin"
    action: "return"
    input:
      success: "{{steps.apply_changes.output.success}}"
      data: "{{steps.apply_changes.output.data}}"
    dependsOn: ["validate_input"]
```

## 🔧 开发指南

### 项目结构

```
@systembug/workflow-schema/
├── schemas/                    # JSON Schema定义
│   ├── workflow.schema.json    # 主工作流Schema
│   ├── step-types.schema.json  # 步骤类型Schema
│   └── template-syntax.schema.json # 模板语法Schema
├── src/
│   ├── cli/                   # CLI工具
│   ├── generators/            # 代码生成器
│   ├── schemas/               # Schema加载器
│   ├── types/                 # TypeScript类型定义
│   ├── validators/            # 验证器
│   └── index.ts              # 主入口
├── scripts/
│   ├── build.js              # 构建脚本
│   └── test.js               # 测试脚本
└── README.md
```

### 构建和测试

```bash
# 编译TypeScript
npm run compile

# 运行测试
npm run test

# 构建发布包
npm run build

# 开发模式
npm run dev
```

## 📚 参考文档

- [RFC 0039: 天枢工作流语法规范](../../../docs/rfc/0039-tianshu-workflow-syntax-specification.md)
- [工作流设计最佳实践](./docs/best-practices.md)
- [API参考文档](./docs/api-reference.md)
- [CLI工具完整指南](./docs/cli-guide.md)

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 🌟 致谢

- 感谢天枢引擎团队的设计理念
- 感谢开源社区的JSON Schema和Ajv项目
- 感谢所有贡献者的努力

---

🌌 让工作流开发充满古典韵味，同时保持现代化的技术水准！