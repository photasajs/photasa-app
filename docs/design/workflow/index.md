# Zouwu Workflow

🌌 驺吾工作流 - 基于 Nx Monorepo 的工作流 Schema 定义和验证系统

## 📜 项目概述

Zouwu Workflow 是一个基于 Nx 的 monorepo 项目，提供完整的工作流 Schema 定义、TypeScript 类型生成、运行时验证器和命令行工具。项目采用古代中国仙侠主题，以"驺吾"（五彩斑斓、仁德守护的神兽）命名。

## 🌟 核心特性

- **JSON Schema 定义**：完整的工作流结构定义，支持多种步骤类型
- **TypeScript 类型支持**：自动生成类型定义，提供编译时类型检查
- **运行时验证器**：基于 Ajv 的高性能验证，支持中文错误信息
- **CLI 工具**：提供代码生成、验证和项目管理功能
- **Monorepo 架构**：使用 Nx 管理多包项目，支持代码共享和统一构建

## 📦 项目结构

```
zouwu-workflow/
├── packages/
│   └── @systembug/
│       ├── zouwu-workflow/          # 核心 Schema 包
│       ├── zouwu-cli/               # CLI 工具包
│       └── zouwu-expression-parser/  # 表达式解析器包
└── docs/                            # 文档目录
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发命令

```bash
# 格式化代码
npm run format

# 检查代码格式
npm run format:check

# 运行 ESLint
npm run lint

# 自动修复 ESLint 问题
npm run lint:fix
```

## 📚 包说明

### @systembug/zouwu-workflow

核心 Schema 包，提供：

- **Schema 定义**：工作流、步骤类型、模板语法的 JSON Schema
- **类型定义**：TypeScript 接口和类型
- **验证器**：运行时工作流验证功能

### @systembug/zouwu-cli

命令行工具包，提供：

- **代码生成**：从 Schema 生成 TypeScript 类型和验证器
- **工作流验证**：验证 YAML/JSON 工作流文件
- **项目初始化**：快速创建工作流项目结构

### @systembug/zouwu-expression-parser

表达式解析器包，提供：

- **表达式解析**：解析 `\{\{...\}\}` 模板语法
- **变量提取**：提取和识别变量引用
- **表达式验证**：验证变量引用的有效性

## 🔧 开发规范

### 代码风格

- **缩进**：4 空格（所有文件类型，包括 JSON）
- **分号**：使用分号
- **引号**：单引号
- **行宽**：100 字符

### 工具配置

- **EditorConfig**：`.editorconfig` 配置编辑器行为
- **Prettier**：`.prettierrc` 配置代码格式化
- **ESLint**：`.eslintrc.json` 配置代码检查

## 📖 相关文档

- [工作流规范文档](./zouwu-workflow-specification-v1.0.md)
- [核心包文档](/packages/zouwu-workflow)
- [CLI 工具文档](/packages/zouwu-cli)
- [表达式解析器文档](/packages/zouwu-expression-parser)

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## 📄 许可证

MIT License - 详见各包的 LICENSE 文件

---

🌌 让工作流开发充满古典韵味，同时保持现代化的技术水准！
