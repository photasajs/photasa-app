# RFC 0147: 文昌 preference 域退出 zouwu（贞观对齐）

- **Start Date**: 2026-07-21
- **Last updated**: 2026-07-21
- **Status**: ⏳ Planned
- **Priority**: P0（监控路径无法添加；主题/语言/缩略图等 preference 变更同根因）
- **Area**: Photasa / Tauri / application preferences (`~/.photasa/preferences/`)
- **Depends on**: [0137](./0137-tauri-zhenguan-direct-ipc-migration.md)（**袁天罡唯一 IPC**）、[0107](./0107-tauri-wenchang-preferences-storage.md)、[0140](./0140-tauri-zouwu-adapter-to-command-migration.md)、[0142](./completed/0142-tauri-zhenguan-config-commands-personification.md)（**`executeZhaoling` 内 `invoke` 范式**）、[0145](./completed/0145-tauri-siming-adapter-retirement.md)（司命域退场；adapter 删除对齐）
- **Path**: `.spec/rfc/0147-tauri-wenchang-preferences-retirement.md`
- **Supersedes**: `0147-tauri-watch-path-add-preferences-bridge.md`、`0147-tauri-wenchang-preferences-bridge-retirement.md`（含错误的 `*-bridge.ts` 方案）

## Decision

**一事一 RFC = preference 整域**。删 `PreferencesAdapter`，无 adapter。

**IPC 唯一入口 = 袁天罡 `YuanTianGangService.executeZhaoling`**，在方法内直接 `invoke("wenchang_*")`——对齐 RFC **0142** 魏征 `get_photasa_config` / `fix_photasa_config` 写法。

**禁止 `wenchang-bridge.ts`（或任何 `*-bridge.ts` 承载 invoke）**：

| 做                                                                                        | 不做                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------------------- |
| `yuantiangang.ts` → `invoke("wenchang_update_preferences" \| "wenchang_get_preferences")` | 新建 `wenchang-bridge.ts` 再包一层 invoke |
| 删 `preferences_adapter.rs` + registry                                                    | 保留 adapter 换壳                         |
| delta 纯函数可抽 `preferences-delta.ts`（**无 invoke**，仅单测）                          | 把 invoke 藏进 bridge 模块                |
| 组件只调褚遂良                                                                            | 组件 / store 直 `invoke`                  |

RFC 0137：**只有袁天罡** import Tauri IPC primitive 并调用 Rust command。不是「bridge 文件」，是**人**。

## Zhenguan Golden Rule

`preferences.json` 归 **褚遂良**；魏征管 `appState` / `.photasa.json`（0142）。

| 人                | 职责                                              | 禁止                                  |
| ----------------- | ------------------------------------------------- | ------------------------------------- |
| **UI**            | 只调褚遂良                                        | `invoke`、`preferenceStore.addPath`   |
| **褚遂良**        | 奏折；paths 持久化成功后才启奏                    | 直 IPC、失败仍启奏                    |
| **房玄龄**        | paths delta、matter-sync                          | 直调 Rust                             |
| **袁天罡**        | **`executeZhaoling` 内唯一 `invoke(wenchang_*)`** | 改 Pinia、zouwu workflow、另建 bridge |
| **李世民**        | 路由启奏                                          | 持久化                                |
| **尉迟恭 / 魏征** | 吃圣旨                                            | 写 preferences.json                   |

```text
奏折：UI → 褚遂良 → 房玄龄 → 袁天罡.executeZhaoling → invoke(wenchang_*) → 房玄龄 matter-sync

启奏（paths only, approved 后）：
  褚遂良 → add_path_completed → 李世民 → 尉迟恭 + 魏征
```

## 1. Problem

- 上述 preference matter 仍走 `sendFuluToTianshu` → zouwu → 生产 workflow 缺失（0107）
- 褚遂良不检查 `approved`；`App.vue` 绕过奏折链
- 尉迟恭 `scan_queue_cleanup_*` 误启奏

## 2. Scope

### In scope

1. Rust `commands/wenchang.rs`：`wenchang_update_preferences`、`wenchang_get_preferences`
2. **`yuantiangang.ts`**：`executeZhaoling` 拦截全部 preference matter，**内联 `invoke`**（同 0142 config 分支）
3. 可选 **`preferences-delta.ts`**：纯函数 `buildPreferencesDelta(command, context)`，**禁止 invoke**
4. `intent.ts` 移除 preference → zouwu 映射
5. 删 `preferences_adapter.rs` + registry
6. 褚遂良 `approved` 门控；`App.vue` → `chuSuiLiang.addPath`
7. 尉迟恭 cleanup 改内部日志

### Out of scope

- `switch_current_folder`、shell/menu/engine zouwu

**2026-07-21 复核更正**：`siming-bridge.ts` 已不存在——0145 已把 folder tree 的 `invoke()` 收回 `yuantiangang.ts::executeZhaoling` 主体（见 0145"设计铁律"节），当前只剩 `folder-tree-payload.ts`（纯函数）等辅助文件。原文档这条"待处理技术债"已过期，不构成 0147 的前置或并行任务。

## 3. 设计

### 3.0 贞观流转（添加监控路径）

```text
GeneralSettings → 褚遂良.addPath
  → 房玄龄.processZouzhe(ADD_PATH)
  → 袁天罡.executeZhaoling(ADD_PATH)
       └─ invoke("wenchang_update_preferences", { delta, source })  // 仅此一处 IPC
  → 房玄龄 matter-sync
  → approved 后：启奏 add_path_completed → 李世民
```

主题/语言/缩略图：同上奏折链，**无启奏**。  
`GET_PREFERENCES`：`invoke("wenchang_get_preferences")` 在 `executeZhaoling` 内。

### 3.1 `yuantiangang.ts`（唯一 invoke 落点）

在 `sendFuluToTianshu` **之前**（与 0142 魏征 config、`scan-queue-bridge` 队列 matter 同级位置）：

```typescript
const WENCHANG_MATTERS = new Set<string>([
    ZOUZHE_MATTERS.THEME_CHANGE,
    ZOUZHE_MATTERS.LANGUAGE_CHANGE,
    ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE,
    ZOUZHE_MATTERS.ADD_PATH,
    ZOUZHE_MATTERS.REMOVE_PATH,
    ZOUZHE_MATTERS.ADD_SCAN_FOLDER,
    ZOUZHE_MATTERS.UPDATE_PREFERENCES,
    ZOUZHE_MATTERS.GET_PREFERENCES,
]);

if (WENCHANG_MATTERS.has(zhaoling.command)) {
    const { invoke } = await import("@tauri-apps/api/core");
    if (zhaoling.command === ZOUZHE_MATTERS.GET_PREFERENCES) {
        data = await invoke("wenchang_get_preferences");
    } else {
        const delta = buildPreferencesDelta(zhaoling.command, zhaoling.context ?? {});
        data = await invoke("wenchang_update_preferences", {
            delta,
            source: zhaoling.source,
        });
    }
    return { acknowledged: true, command: zhaoling.command, data, metadata: { engineName: "wenchang-direct" }, ... };
}
```

`buildPreferencesDelta` 可放在同文件 private 方法或 `preferences-delta.ts`（纯函数，vitest 单测）。

**不得**存在 `wenchang-bridge.ts`；`grep wenchang-bridge apps/photasa/src` 零命中。

### 3.2 Rust

`photasa-preference::PreferencesStore` + `Mutex` state；`commands/wenchang.rs` 零 `zouwu_core`。

### 3.3 褚遂良启奏门控

```typescript
const response = await this.fangXuanLingService.processZouzhe(zouzhe);
if (!response.approved) throw new Error(response.instruction ?? "偏好持久化未获准");
this.emitQizou("add_path_completed", ...); // paths only, after approved
```

## 4. Acceptance

1. `preferences_adapter.rs` 不存在；`PreferencesAdapter` registry 零命中
2. **`test ! -f apps/photasa/src/services/yuantiangang/wenchang-bridge.ts`**
3. `invoke("wenchang_` 仅出现在 `yuantiangang.ts`（及 `__tests__` mock），不在其他贞观 service / 组件
4. `intent.ts` 无 preference → zouwu 映射
5. 贞观：UI → 褚遂良 → 房玄龄 → 袁天罡；无 `preferenceStore.addPath`
6. `approved` 后才 `add_path_completed` / `remove_path_completed`
7. 手动 + `cargo test` + `vitest`（`yuantiangang` preference 分支、`preferences-delta` 若存在）

```bash
test ! -f apps/photasa/src-tauri/src/adapters/preferences_adapter.rs
test ! -f apps/photasa/src/services/yuantiangang/wenchang-bridge.ts
rg 'invoke\("wenchang_' apps/photasa/src --glob '!**/__tests__/**'  # 仅 yuantiangang.ts
```

## 5. Checklist

- [ ] `commands/wenchang.rs` + 删 adapter
- [ ] `yuantiangang.ts` WENCHANG 分支 + 内联 `invoke`（无 bridge 文件）
- [ ] `preferences-delta.ts`（可选纯函数）
- [ ] `intent.ts` 清映射
- [ ] 褚遂良 `approved` 门控；`App.vue`；尉迟恭 cleanup
- [ ] 测试 + 验收

## 6. Related

- **0142**：贞观 IPC 正确范式（`executeZhaoling` 内 `invoke`）
- **0137**：袁天罡唯一 IPC 边界
- **0145**：adapter 删除对齐；`siming-bridge.ts` 已消除（收回 `yuantiangang.ts` 主体），非本 RFC 需要处理的技术债
