# @systembug/zouwu-workflow

核心 Schema 包，提供工作流 Schema 定义和运行时验证器。

## 主要功能

- JSON Schema 定义
- TypeScript 类型支持
- 运行时验证器
- 表达式解析集成

## 安装

```bash
npm install @systembug/zouwu-workflow
```

## 使用示例

```typescript
import { validateWorkflow } from '@systembug/zouwu-workflow';

const result = validateWorkflow(workflowData);
if (result.valid) {
    console.log('工作流验证通过');
}
```
