# 上下文

文件名：20250704-css-variable-standard.md
创建于：2025-07-04
创建者：AI
关联协议：RIPER-5 + 多维 + 代理协议 + AI开发规范

# 任务描述

制定全局 CSS 变量标准，确保所有 UI 组件样式均通过 var(--color-xxx) 变量引用，便于主题切换和统一维护。

# 项目概览

picasa-vue 前端主题化与样式变量体系设计，目标是消除所有硬编码色值，实现主题切换一致性和可维护性。

---

# 变量体系标准

## 1. 变量分层与命名规范

- 基础色：如 --color-bg、--color-text、--color-border、--color-shadow
- 功能色：如 --color-primary、--color-success、--color-warning、--color-danger、--color-info
- 组件专用色：如 --color-btn-bg、--color-card-bg、--color-toolbar-bg
- 命名统一采用 --color-[用途]，组件专用建议 --color-[组件]-[用途]
- 所有样式、JS/TSX 动态 style、SVG fill/stroke，均用 var(--color-xxx)
- 禁止任何硬编码色值
- 主题切换仅需切换变量值，无需改动组件代码

## 2. 变量清单（建议）

```css
:root,
[data-theme] {
    --color-bg: #fff;
    --color-bg-secondary: #f5f5f5;
    --color-text: #222;
    --color-text-secondary: #888;
    --color-border: #e5e7eb;
    --color-shadow: rgba(0, 0, 0, 0.07);
    --color-primary: #1976d2;
    --color-primary-light: #4f8cff;
    --color-success: #4caf50;
    --color-warning: #ff9800;
    --color-danger: #f44336;
    --color-info: #1890ff;
    --color-info-bg: #e6f7ff;
    --color-btn-bg: var(--color-primary);
    --color-btn-hover: #1565c0;
    --color-card-bg: #fafafa;
    --color-card-border: #e0e0e0;
    --color-placeholder: #b6c2d1;
    --color-disabled: #bdbdbd;
    --color-skeleton-from: #e5e7eb;
    --color-skeleton-to: #f3f4f6;
    --color-toolbar-bg: #2d2d2d;
    --color-white: #fff;
    --color-black: #000;
    --color-white-alpha: rgba(255, 255, 255, 0.7);
}
```

## 3. 色值 → 变量名映射表（部分示例）

| 原色值                      | 建议变量名             | 用途/备注        |
| --------------------------- | ---------------------- | ---------------- |
| #fff                        | --color-white          | 纯白/背景/字体   |
| #222                        | --color-text           | 主文本色         |
| #888                        | --color-text-secondary | 次文本/说明/禁用 |
| #b6c2d1                     | --color-placeholder    | 占位/禁用        |
| #e5e7eb                     | --color-border         | 主边框/骨架屏    |
| #f3f4f6                     | --color-skeleton-to    | 骨架屏           |
| #fafafa                     | --color-card-bg        | 卡片/面板背景    |
| #f5f5f5                     | --color-bg-secondary   | 次级背景         |
| #eee                        | --color-bg-secondary   | 次级背景         |
| #1890ff                     | --color-info           | 信息色/链接色    |
| #1976d2                     | --color-primary        | 主色             |
| #1565c0                     | --color-btn-hover      | 按钮悬停         |
| #4f8cff                     | --color-primary-light  | 主色亮           |
| #00e0ff                     | --color-accent         | 强调色           |
| #ccc                        | --color-placeholder    | 占位/说明        |
| #aaa                        | --color-disabled       | 禁用/说明        |
| #2d2d2d                     | --color-toolbar-bg     | 工具栏背景       |
| #fff/rgba(255,255,255,0.7)  | --color-white-alpha    | 半透明白         |
| #000a/#0004/rgba(0,0,0,0.5) | --color-shadow         | 阴影/分隔线      |
| #e6f7ff                     | --color-info-bg        | 信息背景         |
| #bdbdbd                     | --color-disabled       | 禁用             |
| #f44336                     | --color-danger         | 错误色           |
| #ff9800                     | --color-warning        | 警告色           |
| #4caf50                     | --color-success        | 成功色           |

## 4. 实施检查清单

1. 梳理所有硬编码色值，建立“色值→变量名”映射表
2. 在 theme.css/theme.json 中声明所有变量
3. 批量替换所有组件样式中的硬编码色值为 var(--color-xxx)
4. 检查所有动态 style/JSX/TSX 代码，确保用变量
5. 骨架屏、SVG fill、渐变等特殊场景也用变量
6. 主题切换时仅切换变量值，无需改动组件代码
7. 编写/补充相关测试，确保主题切换生效

# 最终审查

本标准文档已覆盖变量体系设计、命名规范、映射表与实施步骤，满足主题化、可维护性和团队协作需求。
