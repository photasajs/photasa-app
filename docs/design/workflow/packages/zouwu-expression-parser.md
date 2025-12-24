# @systembug/zouwu-expression-parser

表达式解析器包，提供 `\{\{...\}\}` 模板语法的解析和验证功能。

## 主要功能

- 表达式解析
- 变量提取
- 表达式验证

## 安装

```bash
npm install @systembug/zouwu-expression-parser
```

## 使用示例

```typescript
import { extractTemplateExpressions } from '@systembug/zouwu-expression-parser';

const result = extractTemplateExpressions('Hello \{\{inputs.name\}\}!');
console.log(result.variables);
```
