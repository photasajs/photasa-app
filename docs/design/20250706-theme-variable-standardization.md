# 主题变量标准化文档

## 文档信息
- **文件名**: 20250706-theme-variable-standardization.md
- **创建时间**: 2025-07-06
- **作者**: AI Assistant
- **关联需求**: 主题变量标准化，确保 JSON 和 CSS 文件的一致性

## 问题描述

### 原始问题
用户指出 `--color-primary-rgb` 变量应该在 theme.json 文件中定义，而不仅仅在 CSS 文件中。这涉及到主题系统的数据一致性和标准化管理。

### 规范要求
- 所有主题颜色变量都应该在 theme.json 中定义
- CSS 文件中的变量应该与 JSON 文件保持一致
- 新增变量需要同时更新 JSON 和 CSS 文件

## 解决方案

### 1. 主题 JSON 文件更新

在所有四个主题的 theme.json 文件中添加 `primary-rgb` 字段：

#### Light Theme
```json
{
    "colors": {
        "primary": "#0066b8",
        "primary-rgb": "0, 102, 184",
        "primary-light": "#3794ff"
    }
}
```

#### Dark Theme
```json
{
    "colors": {
        "primary": "#3794ff",
        "primary-rgb": "55, 148, 255",
        "primary-light": "#9cdcfe"
    }
}
```

#### Solarized Light & Dark
```json
{
    "colors": {
        "primary": "#268bd2",
        "primary-rgb": "38, 139, 210",
        "primary-light": "#b3cde3"
    }
}
```

### 2. CSS 变量对应关系

确保 CSS 文件中的变量与 JSON 定义保持一致：

```css
:root,
[data-theme] {
    --color-primary: #[hex-value];
    --color-primary-rgb: [r, g, b];
    --color-primary-light: #[hex-value];
}
```

### 3. 使用场景

`primary-rgb` 变量主要用于需要透明度效果的场景：

```css
/* 语言选择器激活状态的阴影 */
.locale-dropdown-item-active {
    box-shadow: 0 2px 8px rgba(var(--color-primary-rgb), 0.3);
}

/* 其他可能的使用场景 */
.button-hover {
    background: rgba(var(--color-primary-rgb), 0.1);
}

.focus-ring {
    box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}
```

## 标准化规范

### 1. 命名约定
- **JSON 字段**: 使用短横线分隔，如 `primary-rgb`
- **CSS 变量**: 使用 `--color-` 前缀，如 `--color-primary-rgb`

### 2. 颜色格式
- **十六进制**: `#0066b8` (用于主色值)
- **RGB 值**: `0, 102, 184` (用于透明度效果)
- **RGBA**: `rgba(0,0,0,0.07)` (用于阴影等)

### 3. 文件同步要求
- 新增颜色变量必须同时在 JSON 和 CSS 文件中定义
- 颜色值必须保持完全一致
- 支持所有四个内置主题

## 文件变更清单

### 修改的 JSON 文件
1. `src/renderer/src/themes/light/theme.json`
2. `src/renderer/src/themes/dark/theme.json`
3. `src/renderer/src/themes/solarized-light/theme.json`
4. `src/renderer/src/themes/solarized-dark/theme.json`

### 对应的 CSS 文件
1. `src/renderer/src/themes/light/theme.css`
2. `src/renderer/src/themes/dark/theme.css`
3. `src/renderer/src/themes/solarized-light/theme.css`
4. `src/renderer/src/themes/solarized-dark/theme.css`

## 验证检查

### 1. 完整性检查
```bash
# 检查所有 JSON 文件是否包含 primary-rgb
grep -r "primary-rgb" src/renderer/src/themes/*/theme.json

# 检查所有 CSS 文件是否包含对应变量
grep -r "--color-primary-rgb" src/renderer/src/themes/*/theme.css
```

### 2. 一致性验证
确保每个主题的 JSON 和 CSS 文件中的颜色值完全匹配：

| 主题 | JSON primary-rgb | CSS --color-primary-rgb |
|------|------------------|-------------------------|
| Light | "0, 102, 184" | 0, 102, 184 |
| Dark | "55, 148, 255" | 55, 148, 255 |
| Solarized Light | "38, 139, 210" | 38, 139, 210 |
| Solarized Dark | "38, 139, 210" | 38, 139, 210 |

## 未来扩展

### 1. 自动化同步
考虑开发脚本自动从 JSON 文件生成 CSS 变量，确保一致性。

### 2. 变量验证
添加构建时检查，验证 JSON 和 CSS 文件的变量一致性。

### 3. 类型定义
更新 TypeScript 类型定义，包含新增的变量字段。

## 总结

通过在 theme.json 文件中标准化定义 `primary-rgb` 变量，我们实现了：

- ✅ 主题数据的中心化管理
- ✅ JSON 和 CSS 文件的一致性
- ✅ 标准化的变量命名和格式
- ✅ 完整的四主题支持

这为未来的主题系统扩展和维护奠定了良好的基础。
