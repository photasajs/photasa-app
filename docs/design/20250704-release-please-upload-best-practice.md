# Picasa-Vue 项目 Release Please + 产物自动上传最佳实践文档

## 1. 方案概述

本项目采用 [release-please](https://github.com/googleapis/release-please) 进行自动版本管理、changelog 生成与 Release PR 创建，并结合 GitHub Actions 实现三平台产物自动构建与上传。通过 workflow_run 事件串联 release-please 与产物上传，确保自动化链路稳定、可维护、无递归触发隐患。

---

## 2. 工作流结构

### 2.1 release-please 工作流

**文件**：`.github/workflows/release.yml`

**核心配置**：
```yaml
name: Release Please

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - name: Release Please
        uses: google-github-actions/release-please-action@v4
        with:
          release-type: node
```

**说明**：
- 仅在 main 分支 push 时触发，自动检测 conventional commits，生成/更新 Release PR。
- 合并 Release PR 后，自动 bump 版本、生成 changelog、创建正式 Release。

---

### 2.2 产物上传工作流

**文件**：`.github/workflows/upload-release-assets.yml`

**核心配置**：
```yaml
# 说明：
# 本 workflow 采用 on: workflow_run 触发，解决 release-please 创建 Release 时 on: release 不会被激活的问题。
# 详见：https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run
# 注意：workflows 名称需与 release-please workflow 的 name 字段完全一致。

name: Upload Release Assets

on:
  workflow_run:
    workflows: ["Release Please"]
    types:
      - completed

jobs:
  build-and-upload:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        build_script: [build:linux, build:mac, build:win]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Build app
        run: npm run ${{ matrix.build_script }}

      - name: Upload Release Asset
        uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/**
            out/**
            release/**
            build/**
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**说明**：
- 采用 workflow_run 触发，确保 release-please 创建 Release 后自动构建并上传产物。
- 支持三平台并行构建，自动上传所有产物到最新 Release。

---

## 3. 关键注意事项

1. **递归保护机制**
   - GitHub Actions 默认禁止 workflow 触发 workflow（如 on: release 被另一个 workflow 触发的 release 事件不会激活），必须用 workflow_run 串联。
2. **workflows 名称需完全一致**
   - workflow_run 的 workflows 字段需与 release-please workflow 的 name 字段完全一致（区分大小写）。
3. **权限配置**
   - release-please 需 contents/pull-requests/issues: write 权限，产物上传需 contents: write。
   - 默认 GITHUB_TOKEN 足够，无需 PAT，除非有跨仓库或特殊权限需求。
4. **产物路径与构建脚本**
   - 请确保 build 脚本输出路径与 upload-release-assets.yml 中 files 字段一致。
5. **多平台支持**
   - matrix 配置可灵活扩展，支持更多平台或自定义构建脚本。

---

## 4. 常见问题与排查

- **Release PR 未生成**
  - 检查 main 分支是否有实际变更，workflow 是否被触发，PR 页面有无未合并 Release PR。
- **产物上传 workflow 未激活**
  - 检查是否采用 workflow_run 触发，workflows 名称是否一致。
- **权限报错**
  - 检查 workflow permissions 字段，GITHUB_TOKEN 是否有 write 权限。
- **产物未上传或上传失败**
  - 检查构建脚本输出路径、softprops/action-gh-release 日志、GITHUB_TOKEN 权限。

---

## 5. 团队协作与维护建议

- **文档同步**
  - 所有 workflow 变更需同步更新本文档，便于新成员理解自动化链路。
- **分支策略**
  - 仅允许 main 分支合并 Release PR，避免多分支混乱。
- **安全合规**
  - 避免在 workflow 中明文暴露 PAT，优先用 GITHUB_TOKEN。
- **日志与监控**
  - 定期检查 Actions 页面，关注失败日志，及时修复。

---

## 6. 参考链接

- [release-please 官方文档](https://github.com/googleapis/release-please)
- [GitHub Actions workflow_run 事件](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release)

---

如需进一步定制（如多包、draft、changelog 风格、产物签名等），可补充 .release-please-config.json 或扩展 workflow。
