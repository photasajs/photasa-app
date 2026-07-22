# 主题与插件包格式与API设计（更新版）

> **历史文档**：撰写时面向 legacy main/renderer。Tauri 实现见 `.spec/rfc/`。

## 1. 主题包（Theme Package）

### 本地存储方案

- 桌面端/桌面应用：所有主题包解压后存储于 `userData/themes/{themeId}/` 目录。
- 每个主题包为独立文件夹，包含 `theme.json`、`theme.css`、`preview.png` 等静态资源。
- 主题管理器维护一个主题索引（如 `themes/index.json`），记录所有已安装主题的元信息。

### 目录结构

```
userData/
 themes/
 retro-80s/
 theme.json
 theme.css
 preview.png
 dark-classic/
 theme.json
 theme.css
 preview.png
 ...
 themes/index.json // 主题索引（可选）
```

### 主题包的安装/导入/导出/删除

- 安装/导入：上传zip包，解压到 `userData/themes/{themeId}/`，校验 `theme.json` 合法性。
- 导出：将主题文件夹重新打包为zip，供用户分享或备份。
- 删除：直接移除对应主题文件夹。

### 主题包的加载与切换

- 启动时扫描 `themes/` 目录，读取所有 `theme.json`，构建主题列表。
- 切换主题时，按需加载对应目录下的 `theme.css` 和图片资源。
- 仅允许注入CSS变量和样式，不加载或执行任何JS。

### 安全与隔离

- 只允许读取静态资源（json、css、图片），不加载js。
- 主题包目录与插件包目录分开，互不影响。

### theme.json 字段说明

| 字段        | 类型   | 说明                              | 是否必填 |
| ----------- | ------ | --------------------------------- | -------- |
| name        | string | 主题名称                          | 是       |
| id          | string | 主题唯一ID（建议小写短横线风格）  | 是       |
| author      | string | 作者                              | 是       |
| version     | string | 版本号                            | 是       |
| description | string | 主题描述                          | 是       |
| preview     | string | 预览图片路径                      | 否       |
| colors      | object | 主题主色、背景、文本等CSS变量定义 | 是       |
| css         | string | 附加样式文件路径（如有）          | 否       |

#### colors 示例

```json
"colors": {
 "primary": "#ff00cc",
 "background": "#1a0033",
 "accent": "#00fff7",
 "text": "#fffbe6",
 "card": "#2d004d",
 "button": "#ff00cc",
 "border": "#00fff7"
}
```

### 主题包API设计

- 主题管理器负责读取`theme.json`，将`colors`映射为全局CSS变量（如`--color-primary`）。
- 若有`css`字段，则动态加载并应用该样式文件。
- 主题切换时，卸载旧主题变量/样式，加载新主题。
- 支持主题预览、描述、作者、版本等元信息展示。
- 支持主题包的导入、导出、删除、热切换。

---

## 2. 插件包（Plugin Package）

### 目录结构

```
my-cool-plugin/
 plugin.json
 main.js
 icon.png
 README.md
```

### plugin.json 字段说明

| 字段             | 类型   | 说明                                   | 是否必填 |
| ---------------- | ------ | -------------------------------------- | -------- |
| name             | string | 插件名称                               | 是       |
| id               | string | 插件唯一ID（建议小写短横线风格）       | 是       |
| author           | string | 作者                                   | 是       |
| version          | string | 版本号                                 | 是       |
| description      | string | 插件描述                               | 是       |
| icon             | string | 插件图标路径                           | 否       |
| main             | string | 插件主入口JS文件路径                   | 是       |
| activationEvents | array  | 激活事件（如onStartup、onCommand:xxx） | 是       |
| contributes      | object | 插件扩展点声明（命令、菜单等）         | 否       |

#### contributes 示例

```json
"contributes": {
 "commands": [
 {
 "command": "imageExifView",
 "title": "查看图片EXIF信息"
 }
 ],
 "menus": {
 "photoContext": [
 {
 "command": "imageExifView",
 "title": "查看EXIF"
 }
 ]
 }
}
```

### 插件API设计

- 插件主入口`main.js`需导出`activate(context)`和`deactivate()`方法。
- `context`对象暴露受控API（如注册命令、菜单、事件监听、访问受限数据等）。
- 插件运行在沙箱环境，禁止直接访问敏感API。
- 插件管理器负责插件的安装、启用、禁用、卸载、热加载。
- 支持插件包的导入、导出、更新、删除。

---

## 3. 扩展建议

- 主题/插件包均可通过zip压缩分发，安装时自动解压到本地目录。
- 主题/插件市场可通过API或静态json获取可用列表，支持一键安装。
- 插件API可逐步扩展，支持更多扩展点（如面板、设置、快捷键等）。
- 主题/插件包需校验元数据合法性，防止恶意代码。

---

## 4. 开发者指引

- 主题开发者需提供`theme.json`和主色配置，建议附带预览图和自定义CSS。
- 插件开发者需实现`plugin.json`和`main.js`，并严格遵循API规范。
- 推荐为每个主题/插件编写`README.md`，说明功能、用法和兼容性。
- 提交主题/插件前请本地测试，确保无安全隐患和兼容性问题。
