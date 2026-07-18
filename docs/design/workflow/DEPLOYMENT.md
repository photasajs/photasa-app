# GitHub Pages 部署指南

## 📋 前置条件

1. **启用 GitHub Pages**
    - 进入 GitHub 仓库：`https://github.com/systembugtj/zouwu-workflow`
    - 点击 **Settings** → **Pages**
    - 在 **Source** 部分选择：**GitHub Actions**
    - 保存设置

2. **确保 GitHub Actions 权限**
    - Settings → Actions → General
    - 确保 **Workflow permissions** 设置为：
        - ✅ Read and write permissions
        - ✅ Allow GitHub Actions to create and approve pull requests

## 🚀 部署步骤

### 方法 1：自动部署（推荐）

1. **提交所有更改**

    ```bash
    git add .
    git commit -m "docs: 添加 VitePress 文档和 GitHub Pages 配置"
    ```

2. **推送到 main 分支**

    ```bash
    git push origin main
    ```

3. **GitHub Actions 自动部署**
    - 推送后，GitHub Actions 会自动触发
    - 查看 Actions：`https://github.com/systembugtj/zouwu-workflow/actions`
    - 等待部署完成（通常 1-2 分钟）

4. **访问文档站点**
    - 部署完成后，访问：`https://systembugtj.github.io/zouwu-workflow/`
    - 首次部署可能需要几分钟才能生效

### 方法 2：手动触发部署

如果需要手动触发部署：

1. 进入 GitHub 仓库
2. 点击 **Actions** 标签
3. 选择 **Deploy Docs** 工作流
4. 点击 **Run workflow** → **Run workflow**

## 📝 更新文档

每次更新文档后：

```bash
# 1. 提交更改
git add docs/
git commit -m "docs: 更新文档内容"

# 2. 推送到 main 分支
git push origin main

# 3. GitHub Actions 会自动重新部署
```

## 🔍 检查部署状态

1. **查看 Actions**
    - 访问：`https://github.com/systembugtj/zouwu-workflow/actions`
    - 查看最新的 **Deploy Docs** 工作流运行状态

2. **查看 Pages 设置**
    - Settings → Pages
    - 查看部署状态和 URL

3. **本地预览**

    ```bash
    # 构建文档
    npm run docs:build

    # 预览构建结果
    npm run docs:preview
    ```

## ⚙️ 配置说明

### VitePress 配置

- **base URL**: `/zouwu-workflow/`（必须与仓库名称匹配）
- **构建输出**: `docs/.vitepress/dist/`
- **文档源**: `docs/*.md`

### GitHub Actions 工作流

- **触发条件**: 推送到 `main` 分支，且修改了 `docs/` 目录
- **自动部署**: 构建完成后自动部署到 GitHub Pages
- **部署分支**: `gh-pages`（由 GitHub Actions 自动管理）

## 🐛 故障排除

### 部署失败

1. **检查 Actions 日志**
    - 查看错误信息
    - 检查构建步骤是否成功

2. **检查 Pages 设置**
    - 确保 Source 设置为 **GitHub Actions**
    - 检查权限设置

3. **检查 base URL**
    - 确保 `docs/.vitepress/config.mjs` 中的 `base` 与仓库名称匹配

### 页面无法访问

1. **等待部署完成**
    - 首次部署可能需要 5-10 分钟
    - 检查 Actions 是否完成

2. **检查 URL**
    - 确保 URL 格式正确：`https://systembugtj.github.io/zouwu-workflow/`
    - 注意末尾的斜杠

3. **清除浏览器缓存**
    - 强制刷新：`Cmd+Shift+R` (Mac) 或 `Ctrl+Shift+R` (Windows)

## 📚 相关链接

- [VitePress 文档](https://vitepress.dev/)
- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
