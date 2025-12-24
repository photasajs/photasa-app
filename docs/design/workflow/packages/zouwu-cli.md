# @systembug/zouwu-cli

命令行工具包，提供代码生成、验证和项目管理功能。

## 主要功能

- 代码生成（TypeScript 类型、验证器）
- 工作流验证
- 项目初始化

## 安装

```bash
npm install -g @systembug/zouwu-cli
```

## 使用示例

```bash
# 初始化项目
workflow init my-project

# 生成类型
workflow generate-types -s schema.json -o types.ts

# 验证工作流
workflow validate -f workflow.yml
```
