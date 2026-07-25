# RFC 0165 – `@photasa/base-tree` 包抽取、启动选中恢复与虚拟化保证

**Status**: ✅ Implemented  
**Created**: 2026-07-24  
**Completed**: 2026-07-24  
**Area**: Photasa / Renderer / `BaseTree` / `FolderList` / workspace package  
**Related**: [0013](../completed/0013-default-folder-selection.md), [0016](../completed/0016-basetree-component-implementation.md), [0047](../completed/0047-foldertree-persistence-initialization.md), [0161](./0161-imagelist-tanstack-virtual-grid.md), [0164](./0164-cleanup-legacy-node-packages.md)

---

## 三大交付（本 RFC 必须全部满足）

| #     | 交付                        | 含义                                                                                                                | 阶段                        | 状态                              |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------- |
| **1** | **`@photasa/base-tree` 包** | `BaseTree` / `BaseTreeNode` / 树内 `VirtualList` 迁入 `packages/@photasa/base-tree`，独立 build + test + turbo 依赖 | Phase B                     | ✅ Implemented                    |
| **2** | **启动时树显示选中**        | 重开 app 后 `currentFolder` 恢复 → 祖先展开 + 节点高亮，与 ImageList/面包屑一致                                     | Phase A                     | ✅ Implemented（手测 2026-07-24） |
| **3** | **虚拟化正确**              | `virtual=true` 下仅渲染可见扁平节点；大目录不卡顿；抽包后行为与 RFC 0016 一致、无回归                               | Phase A 约束 + Phase B 回归 | ✅ Implemented（手测 2026-07-24） |

**不在范围**：换 Naive/Ant 树；`FolderList` 进包；`@photasa/ui` 等泛名包。

---

## Summary

1. **交付 2（应用层）**：RFC 0013 只同步 `selectedKeys`，未展开 `expandedKeys`。虚拟树折叠父级时选中不可见 → `mergeExpandedKeysForCurrentFolder` + `syncTreeViewForCurrentFolder`。
2. **交付 1（包层）**：制品名 **`@photasa/base-tree`**，对齐 `BaseTree.vue`，拒绝 `ui` / `tree` / `virtual-tree`。
3. **交付 3（虚拟化）**：抽包不得破坏扁平化 + `VirtualList` 路径；`BaseTree.test.ts` 与 FolderList 集成手测作为门禁。

---

## 交付 2 – 启动时树显示选中（Phase A）

### 根因

| 状态            | Store                      | 持久化              |
| --------------- | -------------------------- | ------------------- |
| `currentFolder` | `preferenceStore.appState` | Pinia `persist`     |
| `folderTree`    | `appStateStore`            | `restore_app_state` |

虚拟树**只渲染** `expandedKeys` 下扁平可见节点。深路径父级未展开 → `selectedKeys` 已对也看不见。

### 数据流

```
currentFolder 恢复（Pinia）
  → watch([currentFolder, paths])     # paths 可能晚到
  → canonicalFolderPath(folder)
  → mergeExpandedKeysForCurrentFolder → expandedKeys
  → selectFolder → selectedKeys
```

### 变更文件（as-built）

| 文件                                                          | 变更                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/photasa/src/utils/folder-tree-expand.ts`                | `collectAncestorKeys` 规范化；`mergeExpandedKeysForCurrentFolder` |
| `apps/photasa/src/components/FolderList.vue`                  | `syncTreeViewForCurrentFolder`                                    |
| `apps/photasa/src/utils/__tests__/folder-tree-expand.test.ts` | 单元测试                                                          |

### 验收（交付 2）

- [x] Vitest：`folder-tree-expand.test.ts` 全通过
- [x] **手测**：选深路径子文件夹 → 完全退出 app → 重开 → 树**展开到该节点**且**高亮选中**
- [x] **手测**：仅根路径时根节点选中可见
- [x] **手测**：`paths` 与 `currentFolder` 路径格式不一致（`\` vs `/`）仍能对齐

### RFC 0013 补充

> 启动恢复 = `selectedKeys` + `expandedKeys`（含全部祖先），二者缺一不可。

---

## 交付 3 – 虚拟化正确（Phase A 约束 + Phase B 回归）

### 机制（RFC 0016 as-built）

```
folderTree (嵌套)
  → BaseTree flatten 为 uniqueVisibleNodes（仅 expanded 子树）
  → VirtualList 按 itemHeight 虚拟滚动
  → BaseTreeNode 渲染可见行
```

`FolderList` 固定配置：

```vue
<BaseTree
    :virtual="true"
    height="100%"
    :item-height="34"
    :auto-focus-on-expand="true"
    v-model:expandedKeys="expandedKeys"
    v-model:selectedKeys="selectedKeys"
    :tree-data="folderTree"
/>
```

### 必须保持的不变量

| 不变量                      | 说明                                                    |
| --------------------------- | ------------------------------------------------------- |
| 可见节点数 ∝ 视口           | 非整棵树 DOM；万级目录内存与滚动与展开深度相关          |
| `expandedKeys` 驱动扁平列表 | 展开/折叠改变 `VirtualList.items` 长度，不 remount 整树 |
| `item-height` 与行 CSS 一致 | FolderList `34px` 与 `.base-tree-node` line-height 对齐 |
| 选中行在展开后可达          | 交付 2 保证祖先展开后，虚拟列表包含目标 `key`           |

### 验收（交付 3）

- [x] `BaseTree.test.ts`：`virtual=true` 走 `VirtualList`；折叠时子节点不在 `items`
- [x] 抽包后：`pnpm --filter @photasa/base-tree test` 全通过（含搬过去的 `BaseTree.test.ts`）
- [x] 抽包后：Photasa `vitest run` 无 BaseTree 相关回归
- [x] **手测**：>1000 节点目录树滚动流畅；展开深路径不白屏
- [x] **手测**：交付 2 手测通过时，选中行在视口内（`auto-focus-on-expand` 或等价滚动）

### 与交付 2 的关系

虚拟化**不是**启动选中失败的根因；但未展开祖先时虚拟列表根本不包含目标节点。交付 2 修复可见性；交付 3 保证修完后性能与 RFC 0016 一致。

---

## 交付 1 – `@photasa/base-tree` workspace 包（Phase B）

### 包边界

```
packages/@photasa/base-tree/
├── src/
│   ├── BaseTree.vue
│   ├── BaseTreeNode.vue
│   ├── internal/VirtualList.vue   # 交付 3：仅树内虚拟化，不单独发包
│   ├── flatten-visible.ts         # 交付 3：纯函数可单测
│   ├── types.ts
│   └── index.ts
├── package.json                   # "name": "@photasa/base-tree"
├── vite.config.ts
└── vitest / BaseTree.test.ts      # 交付 3 门禁
```

**留在 `apps/photasa`：**

- `FolderList.vue`（交付 2 状态机）
- `utils/folder-tree-expand.ts`
- `BaseContextMenu` 等业务 UI

### `package.json`

```json
{
    "name": "@photasa/base-tree",
    "private": true,
    "peerDependencies": { "vue": "^3.5.0" },
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "import": "./dist/index.mjs"
        }
    }
}
```

### 消费与构建

```ts
import { BaseTree, type TreeNode } from "@photasa/base-tree";
```

- `apps/photasa/src/components/ui/index.ts` 过渡期可 re-export
- turbo：`@photasa/base-tree#build` ← `apps/photasa#build` 依赖
- **不**列入 [0164](./0164-cleanup-legacy-node-packages.md) 删除范围（0164 清 legacy Electron Node 引擎包）

### 与 RFC 0161

| 组件               | 归属                                    |
| ------------------ | --------------------------------------- |
| 树内 `VirtualList` | `@photasa/base-tree` internal（交付 3） |
| `VirtualizedGrid`  | 0161 / app，**本 RFC 不抽**             |

### 验收（交付 1）

- [x] `packages/@photasa/base-tree` 存在且 `pnpm --filter @photasa/base-tree build` 成功
- [x] `apps/photasa` 无 `components/ui/BaseTree.vue` 副本（`ui/index.ts` re-export）
- [x] turbo pipeline 已接线（`build` → `^build`）
- [x] 交付 3 测试门禁全绿

---

## Implementation plan

### 交付 2 — Phase A

1. [x] `mergeExpandedKeysForCurrentFolder` + `collectAncestorKeys` 规范化
2. [x] `FolderList.syncTreeViewForCurrentFolder` + `watch([currentFolder, paths])`
3. [x] `folder-tree-expand.test.ts`
4. [x] 手测签收

### 交付 1 + 3 — Phase B

1. [x] 创建 `packages/@photasa/base-tree`
2. [x] 迁移 `BaseTree` / `BaseTreeNode` / internal `VirtualList`
3. [x] 抽 `flatten-visible.ts`；搬 `BaseTree.test.ts`（交付 3）
4. [x] photasa 改 import；ui re-export
5. [x] turbo + `pnpm --filter @photasa/base-tree test`
6. [x] 手测：大目录滚动 + 启动选中（交付 2 + 3 联调）

---

## Alternatives considered

| 方案                                                      | 结论          |
| --------------------------------------------------------- | ------------- |
| 第三方 virtual tree                                       | 拒绝          |
| `@photasa/ui` / `@photasa/tree` / `@photasa/virtual-tree` | 拒绝 — 泛名   |
| `@photasa/folder-tree`                                    | 拒绝 — 业务包 |

---

## Success criteria（关 RFC 前全部勾选）

### 交付 1 — 包

- [x] `@photasa/base-tree` build/test/turbo 就绪
- [x] photasa 单一来源引用包

### 交付 2 — 启动选中

- [x] Vitest `folder-tree-expand`
- [x] 重开 app 深路径：展开 + 高亮

### 交付 3 — 虚拟化

- [x] 抽包前 `BaseTree.test.ts` 绿
- [x] 抽包后包内 + photasa 测试绿
- [x] 大目录手测滚动与选中可见

---

## References

- RFC 0013 — `currentFolder` → `selectedKeys`
- RFC 0016 — BaseTree 虚拟滚动设计
- RFC 0047 — `folderTree` 恢复
- `packages/@photasa/base-tree/src/BaseTree.vue`
- `apps/photasa/src/components/FolderList.vue`
