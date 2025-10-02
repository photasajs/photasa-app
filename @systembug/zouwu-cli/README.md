# @systembug/zouwu-cli

🌌 驺吾工作流命令行工具 - 基于核心包的完整CLI工具链

## 📜 项目概述

`@systembug/zouwu-cli` 是专门的命令行工具包，依赖 `@systembug/zouwu-workflow` 核心包，提供代码生成、验证和项目管理功能。采用古代中国仙侠主题的用户界面风格。

## 🌟 核心特性

### 🔧 命令行工具
- **项目初始化**: 快速创建工作流Schema项目
- **TypeScript类型生成**: 从JSON Schema自动生成完整的TypeScript接口定义
- **运行时验证器生成**: 基于Ajv生成高性能的运行时验证器
- **批量代码生成**: 支持批量处理多个Schema文件
- **工作流验证**: 验证YAML/JSON工作流文件的正确性

### 🌌 古风界面
- 采用古代中国仙侠主题的用户界面风格
- 提供本地化的中文错误提示和操作指引
- 丰富的图标和仙术主题术语

## 🚀 快速开始

### 安装

```bash
# 全局安装CLI工具
npm install -g @systembug/workflow-cli

# 或者项目本地安装
npm install --save-dev @systembug/workflow-cli
```

### CLI使用

```bash
# 初始化新项目
workflow init my-workflow-project

# 生成TypeScript类型
workflow generate-types -s workflow.schema.json -o types.ts

# 生成验证器
workflow generate-validators -s workflow.schema.json -o validators.ts

# 批量生成所有代码
workflow generate-all -s schemas/ -o generated/

# 验证工作流文件
workflow validate -f my-workflow.yml --verbose

# 显示版本信息
workflow version
```

### 编程接口

```typescript
import {
  generateTypesFromSchema,
  generateValidatorsFromSchema
} from '@systembug/workflow-schema-cli';

// 生成类型定义
await generateTypesFromSchema({
  schemaPath: './schemas/workflow.schema.json',
  outputPath: './types/workflow.types.ts',
  generateDocs: true
});

// 生成验证器
await generateValidatorsFromSchema({
  schemaPath: './schemas/workflow.schema.json',
  outputPath: './validators/workflow.validators.ts',
  strict: true,
  chineseErrors: true
});
```

## 🔧 命令详解

### `init` - 项目初始化

```bash
workflow-schema init [目录] [选项]
```

创建完整的工作流Schema项目结构，包括：
- 基础Schema文件
- 配置文件
- 示例工作流
- 目录结构

### `generate-types` - 类型生成

```bash
workflow-schema generate-types -s <schema文件> -o <输出文件> [选项]
```

从JSON Schema生成TypeScript类型定义，支持：
- 完整的接口定义
- 文档注释生成
- 自定义名称前缀

### `generate-validators` - 验证器生成

```bash
workflow-schema generate-validators -s <schema文件> -o <输出文件> [选项]
```

生成基于Ajv的运行时验证器，提供：
- 严格模式验证
- 中文错误信息
- 高性能验证

### `generate-all` - 批量生成

```bash
workflow-schema generate-all -s <schema目录> -o <输出目录> [选项]
```

批量处理整个Schema目录，一次性生成所有类型和验证器。

### `validate` - 工作流验证

```bash
workflow-schema validate -f <工作流文件> [选项]
```

验证YAML/JSON工作流文件的正确性，支持：
- 结构验证
- 详细错误报告
- 自定义Schema

## 📚 依赖关系

本包依赖以下核心包：
- `@systembug/workflow-schema` - 核心Schema定义和验证器
- `commander` - CLI框架
- `chalk` - 彩色输出
- `json-schema-to-typescript` - TypeScript类型生成

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

---

🌌 专注于命令行工具，让工作流开发更加高效便捷！
