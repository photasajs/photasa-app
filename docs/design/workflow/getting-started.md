# 快速开始

本指南将帮助您快速开始使用 Zouwu Workflow。

## 安装

### 安装核心包

```bash
npm install @systembug/zouwu-workflow
```

### 安装 CLI 工具

```bash
npm install -g @systembug/zouwu-cli
```

### 安装表达式解析器

```bash
npm install @systembug/zouwu-expression-parser
```

## 基本使用

### 使用核心包验证工作流

```typescript
import { validateWorkflow } from '@systembug/zouwu-workflow';

const workflow = {
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
                message: 'Hello, World!',
            },
        },
    ],
};

const result = validateWorkflow(workflow);
if (result.valid) {
    console.log('工作流验证通过');
} else {
    console.error('验证失败:', result.errors);
}
```

### 使用 CLI 工具

```bash
# 初始化新项目
workflow init my-workflow-project

# 生成 TypeScript 类型
workflow generate-types -s workflow.schema.json -o types.ts

# 验证工作流文件
workflow validate -f my-workflow.yml
```

### 使用表达式解析器

```typescript
import { extractTemplateExpressions } from '@systembug/zouwu-expression-parser';

const result = extractTemplateExpressions('Hello \{\{inputs.name\}\}!');
console.log(result.variables); // [{ type: 'inputs', path: 'name', ... }]
```

## 下一步

- 阅读 [工作流规范文档](./zouwu-workflow-specification-v1.0.md)
- 查看各包的详细文档
- 探索示例工作流
