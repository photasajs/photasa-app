# RFC 0166: ImageList 悬停操作栏（三按钮）

- **Start Date**: 2026-07-24
- **Last updated**: 2026-07-24
- **Status**: ✅ Implemented
- **Priority**: P2（用户可见：网格悬停快捷操作）
- **Area**: Photasa / Renderer / `ImageList` / `ImageListItem`
- **Depends on**: [0148](./completed/0148-tauri-rebuild-thumbnail-ui-contract.md)（单图重建缩略图契约）、[0058](../completed/0058-zhangsunwuji-service-layer.md)（`openInFinder` 经长孙无忌）
- **Related**: [0161](./0161-imagelist-tanstack-virtual-grid.md)（虚拟网格整合，与本 RFC 正交）
- **Path**: `.spec/rfc/completed/0166-imagelist-hover-action-bar.md`

## Decision

**鼠标悬停 `ImageList` 单格缩略图时，底部显示主题化浮动操作栏，提供三个快捷按钮：详情、重建缩略图、在文件管理器中打开。**

| 做                                                               | 不做                      |
| ---------------------------------------------------------------- | ------------------------- |
| 悬停显示 3 按钮浮动条                                            | 新增 IPC / Rust 命令      |
| 复用 `menu.getInfo` / `menu.rebuildThumbnail` / `menu.open` i18n | 新文案键（除非产品要求）  |
| 抽取 `ImageListItem.vue` + `image-list-hover-actions.ts`         | 改虚拟滚动架构（见 0161） |
| 悬停条仅图标；文案经 `BaseTooltip`                               | 图片项右键菜单（已移除）  |
| 重建缩略图沿用 RFC 0148 `requestThumbnail` 流                    | 贞观启奏 / 扫描队列       |

**无独立 CLI。** 用户入口：网格悬停工具栏。

## 功能定义

### 入口

`apps/photasa/src/components/ImageListItem.vue` — 由 `ImageList.vue` 虚拟行渲染。

### 三按钮行为

| 按钮               | i18n                    | 事件 / 调用                                          | 后端                        |
| ------------------ | ----------------------- | ---------------------------------------------------- | --------------------------- |
| 详情               | `menu.getInfo`          | `emit('openMeta')` → `openImageMeta`                 | `galleryMedia.fileMetadata` |
| 重建缩略图         | `menu.rebuildThumbnail` | `rebuildThumbnail(image)` prop                       | RFC 0148 `create_thumbnail` |
| 在文件管理器中打开 | `menu.open`             | `emit('openInFolder')` → `zhangSunWuJi.openInFinder` | qizou 路由                  |

### 数据流（重建缩略图）

与 RFC 0148 相同，入口为悬停工具栏：

```text
ImageListItem @click rebuild
 → ImageList.rebuildThumbnail(image)
 → requestThumbnail(...) // ImageListHelper.ts
 → markThumbnailRebuilt → getThumbnailDisplaySrc
```

### UI 契约

- 悬停条 `position: absolute; bottom: 0`；`@click.stop` 防触发预览
- 卡片点击仍打开 `MediaPreview`
- 悬停条半透明渐变叠层 + 主题阴影 `--color-image-hover-bar-shadow`；按钮半透明白色描边
- 重建中：重建按钮 `disabled` + 图标旋转

## 文件清单

| 文件                              | 变更                                  |
| --------------------------------- | ------------------------------------- |
| `ImageListItem.vue`               | 新建：悬停工具栏（无右键菜单）        |
| `image-list-hover-actions.ts`     | 新建：动作 ID / i18n / testId 常量    |
| `ImageList.vue`                   | 使用 `ImageListItem` 替换 inline 格子 |
| `__tests__/ImageListItem.test.ts` | 新建：悬停栏三按钮行为                |

## 验收

- [x] 悬停显示 3 按钮
- [x] 详情 / 打开 / 重建分别触发正确事件或 prop
- [x] 右键菜单已移除；操作仅经悬停工具栏
- [x] Vitest：`ImageListItem.test.ts`

### 验证命令

```bash
pnpm --filter @photasa/photasa exec vitest run src/components/__tests__/ImageListItem.test.ts
```

## 与 RFC 0148 边界

|      | RFC 0148                  | RFC 0166    |
| ---- | ------------------------- | ----------- |
| 范围 | 重建缩略图 IPC + 缓存破坏 | UI 悬停入口 |
| 入口 | 悬停工具栏                | 悬停工具栏  |
| Rust | `create_thumbnail`        | 无变更      |
