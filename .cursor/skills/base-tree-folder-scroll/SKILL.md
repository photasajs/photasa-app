---
name: base-tree-folder-scroll
description: >-
    Debug and implement FolderList / @photasa/base-tree scroll behavior: expand jump-to-top,
    startup restore scrollToNode, virtual vs non-virtual sidebar, TanStack VirtualList pitfalls.
    Use when the folder tree jumps on expand, scroll resets, or when changing BaseTree virtual
    mode, expandedKeys watchers, or folderTree sync in FolderList.vue.
---

# BaseTree / FolderList 滚动（Photasa 侧栏树）

## 何时读本技能

- 展开树节点后侧栏**跳回顶部**或意外滚动
- 启动恢复 `currentFolder` 滚动行为不对（滚多次 / 不滚 / 滚错位置）
- 修改 `FolderList.vue`、`@photasa/base-tree` 的 `VirtualList`、`expandedKeys` / `folderTree` watch
- 评估侧栏是否应 `virtual=true` 或 `virtual=false`

**权威 as-built**：`.spec/rfc/completed/0165-base-tree-package-and-folder-restore.md` → **Amendment — 2026-07-25**

## 架构速查

```
FolderList.vue
  .tree-container (overflow-auto)  ← 侧栏唯一滚动容器（virtual=false）
  BaseTree (@photasa/base-tree)
    virtual=false → BaseTreeNode 递归 DOM
    virtual=true  → internal/VirtualList (TanStack) + 扁平 uniqueVisibleNodes
```

| 状态                     | Store             |
| ------------------------ | ----------------- |
| `currentFolder`, `paths` | `preferenceStore` |
| `folderTree`             | `appStateStore`   |

## 根因检查清单（按顺序，勿跳过）

### 1. 应用层是否在偷偷滚动？（最常见）

在 `FolderList.vue` 搜索：

- `scrollToNode` / `scrollIntoView`
- `scrollRestoredFolderIntoViewOnce`
- `syncTreeViewForCurrentFolder`

**红线**：`watch(folderTree)` / `watch(folderTree, { deep: true })` **不得**调用 `scrollToNode`。树数据更新（扫描、reconcile）≠ 用户要滚动的时机。

**正确模式**：

| 时机                           | 动作                                                                 |
| ------------------------------ | -------------------------------------------------------------------- |
| `currentFolder` / `paths` 变化 | `syncTreeViewForCurrentFolder`（展开祖先 + 选中 + **一次**恢复滚动） |
| `folderTree.length` 0→N        | 补一次 `scrollRestoredFolderIntoViewOnce`                            |
| `folderTree` 其它更新          | 仅 `mergeExpandedKeysForCurrentFolder`，**不滚动**                   |
| 用户 `@expand`                 | `markTreeScrollRestoreComplete()`，禁止后续自动滚                    |

### 2. 滚动容器是否唯一？

**侧栏（FolderList）**：`virtual=false` + `.tree-container { overflow-auto }`。

禁止：外层 `overflow-auto` + 内层 `VirtualList` 再 `overflow-auto`（双层滚动必出跳顶）。

### 3. 虚拟列表（仅 `virtual=true` 时）

文件：`packages/@photasa/base-tree/src/internal/VirtualList.vue`

| 反模式                                                  | 正模式                                             |
| ------------------------------------------------------- | -------------------------------------------------- |
| `` getItemKey: `${key}-${index}` ``                     | `String(item.key)`                                 |
| 未向 `useVirtualizer` 传 `getItemKey`                   | `computed(() => ({ getItemKey, count, ... }))`     |
| 在 `watch(items)` **之后**保存 `scrollTop`              | `handleNodeExpand` 内先 `captureScrollOffset()`    |
| `items.length` 变化时无条件 `measure()` + `scrollToTop` | 仅长度剧变（>100）回顶；否则 `restoreScrollOffset` |

### 4. 勿用 `auto-focus-on-expand`（FolderList）

展开/切换文件夹不应 `scrollToNode`。启动恢复滚动单独用 `didRestoreScrollIntoView` / `onTreeExpand` 门禁。

## 推荐 as-built（FolderList 侧栏）

```vue
<div class="flex-1 min-h-0 overflow-auto tree-container">
    <BaseTree
        ref="folderTreeRef"
        :virtual="false"
        v-model:expandedKeys="expandedKeys"
        v-model:selectedKeys="selectedKeys"
        :tree-data="folderTree"
        @expand="onTreeExpand"
    />
</div>
```

## 验证

```bash
# 包内滚动 / 虚拟化回归
pnpm --filter @photasa/base-tree exec vitest run

# 手测（必须）
# 1. 滚到深层 → 展开 → 不跳顶
# 2. 退出重开 → 深路径仅滚一次入视口
```

集成测试（无 VirtualList mock）：`packages/@photasa/base-tree/src/__tests__/BaseTree.scroll.integration.test.ts`

## 何时用 `virtual=true`

- 非侧栏、或单测证明手测通过的大目录场景
- 启用前必须：稳定 `getItemKey`、展开前 `captureScrollOffset`、**单**滚动容器、手测展开不跳顶

侧栏 `FolderList` 默认 **`virtual=false`**（RFC 0165 Amendment 2026-07-25）。

## 关联

- RFC 0165 Amendment — `.spec/rfc/completed/0165-base-tree-package-and-folder-restore.md`
- `apps/photasa/src/utils/folder-tree-expand.ts` — 祖先展开纯函数
- `tauri-debug-investigate` — WebView 内 DOM/日志（若需 MCP 截图验证滚动）
