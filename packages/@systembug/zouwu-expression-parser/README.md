# @systembug/zouwu-expression-parser

🌌 驺吾工作流表达式解析器 - 解析和验证 `{{...}}` 模板语法

## 📜 项目概述

`@systembug/zouwu-expression-parser` 是专门用于解析和验证驺吾工作流中模板表达式的独立包。它提供了完整的 `{{...}}` 语法解析、变量提取和验证功能。

## 🌟 核心特性

### ✅ 表达式解析

- **模板提取**：从字符串中提取所有 `{{...}}` 模板表达式
- **变量识别**：识别 `inputs`、`variables`、`steps`、`loopContext`、`branchContext` 等变量类型
- **路径解析**：解析变量路径，支持嵌套属性访问
- **默认值支持**：支持 `{{variable || 'default'}}` 语法

### 🔧 验证功能

- **变量验证**：验证引用的变量是否存在
- **路径验证**：验证变量路径的有效性
- **递归验证**：支持递归验证对象和数组中的模板表达式

### 📚 TypeScript 支持

- **完整类型定义**：提供完整的 TypeScript 类型
- **类型安全**：编译时类型检查支持

## 🚀 快速开始

### 安装

```bash
npm install @systembug/zouwu-expression-parser
```

### 使用示例

```typescript
import {
    extractTemplateExpressions,
    validateTemplateExpression,
    parseTemplateExpression,
} from '@systembug/zouwu-expression-parser';

// 提取模板表达式
const result = extractTemplateExpressions('Hello {{inputs.name}}!');
console.log(result.hasTemplate); // true
console.log(result.variables); // [{ type: 'inputs', path: 'name', ... }]

// 验证表达式
const availableVars = new Set(['inputs.name', 'inputs.age']);
const validation = validateTemplateExpression(
    '{{inputs.name}} is {{inputs.age}} years old',
    availableVars
);
console.log(validation.valid); // true

// 解析单个表达式
const parsed = parseTemplateExpression('{{inputs.userName}}', 'inputs.userName');
console.log(parsed); // { type: 'inputs', path: 'userName', ... }
```

## 📋 API 参考

### `extractTemplateExpressions(text: string)`

从字符串中提取所有模板表达式。

**参数**：

- `text`: 要解析的字符串

**返回**：`ExpressionParseResult` 对象，包含：

- `hasTemplate`: 是否包含模板表达式
- `variables`: 提取的变量引用数组
- `original`: 原始字符串
- `expressions`: 所有表达式内容数组

### `validateTemplateExpression(text, availableVariables, path?)`

验证字符串中的模板表达式。

**参数**：

- `text`: 要验证的字符串
- `availableVariables`: 可用变量集合
- `path`: 可选的路径（用于错误报告）

**返回**：`ExpressionValidationResult` 对象

### `parseTemplateExpression(template, expression)`

解析单个模板表达式。

**参数**：

- `template`: 完整的模板字符串（包含 `{{}}`）
- `expression`: 表达式内容（不包含 `{{}}`）

**返回**：`TemplateVariableReference` 对象或 `null`

## 🔧 支持的表达式格式

### 简单变量引用

```typescript
'{{inputs.userName}}';
'{{variables.requestId}}';
'{{steps.stepId.output}}';
```

### 带默认值

```typescript
'{{inputs.name || "default"}}';
'{{variables.count || 0}}';
```

### 嵌套属性

```typescript
'{{inputs.user.profile.name}}';
'{{steps.validate.output.result}}';
```

### 循环变量

```typescript
'{{currentFile}}';
'{{fileIndex}}';
'{{loopContext.index}}';
```

## 🧪 测试

项目使用 **Jest** 作为测试框架，配合 **ts-jest** 提供 TypeScript 支持。

### 为什么选择 Jest？

- ✅ **功能全面**：内置断言、mock、覆盖率等功能
- ✅ **TypeScript 支持**：通过 ts-jest 完美支持 TypeScript
- ✅ **零配置**：开箱即用的配置
- ✅ **社区支持**：广泛使用，文档丰富
- ✅ **快照测试**：支持快照测试功能
- ✅ **覆盖率报告**：内置代码覆盖率统计

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式（自动运行变更的测试）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 测试覆盖率

项目目标达到 80% 以上的测试覆盖率，包括：

- 单元测试：覆盖所有核心函数
- 边界测试：测试边界情况和错误处理
- 集成测试：测试函数之间的协作

## 📚 依赖关系

本包是独立包，不依赖其他驺吾工作流包。

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

## 📄 许可证

MIT License

---

🌌 专注于表达式解析，让模板语法处理更加专业！
