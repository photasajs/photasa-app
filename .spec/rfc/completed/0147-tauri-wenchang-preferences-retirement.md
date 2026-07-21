# RFC 0147: preference 域退出 zouwu（贞观对齐）

- **Start Date**: 2026-07-21
- **Last updated**: 2026-07-21
- **Status**: ✅ Implemented
- **Priority**: P0（监控路径无法添加；主题/语言/缩略图等 preference 变更同根因）
- **Area**: Photasa / Tauri / application preferences (`~/.photasa/preferences/`)
- **Depends on**: [0137](../0137-tauri-zhenguan-direct-ipc-migration.md)、[0107](../0107-tauri-wenchang-preferences-storage.md)、[0140](../0140-tauri-zouwu-adapter-to-command-migration.md)、[0142](./0142-tauri-zhenguan-config-commands-personification.md)、[0145](./0145-tauri-siming-adapter-retirement.md)
- **Path**: `.spec/rfc/completed/0147-tauri-wenchang-preferences-retirement.md`
- **Supersedes**: `0147-tauri-watch-path-add-preferences-bridge.md`、`0147-tauri-wenchang-preferences-bridge-retirement.md`（含错误的 `*-bridge.ts` 方案）

## Decision

**一事一 RFC = preference 整域**。删 `PreferencesAdapter`，无 adapter。

**IPC 唯一入口 = 袁天罡 `YuanTianGangService.executeZhaoling`**，内联 `invoke("preferences_get" | "preferences_update")`（**功能名 command**，非 `wenchang_*` / 非神名）——对齐 RFC **0142** 与 **0145 设计铁律**（`invoke` 写在 `yuantiangang.ts` 本体，禁止 `*-bridge.ts`）。

| 做                                                    | 不做                                       |
| ----------------------------------------------------- | ------------------------------------------ |
| `yuantiangang.ts` → `invoke(PREFERENCES_COMMANDS.*)`  | `wenchang-bridge.ts` 或任何 `*-bridge.ts`  |
| `preferences-delta.ts` 纯函数 `buildPreferencesDelta` | bridge 里藏 invoke                         |
| 删 `preferences_adapter.rs` + registry                | adapter 换壳                               |
| UI 只调褚遂良                                         | `preferenceStore.addPath`、组件直 `invoke` |

## 贞观三文书（本 RFC 相关）

| 文书              | 路径                                                                |
| ----------------- | ------------------------------------------------------------------- |
| **奏折 zouzhe**   | UI → 褚遂良 → **房玄龄**（delta、matter-sync）                      |
| **启奏 qizou**    | 袁天罡（持久化成功后）→ **李世民** → 尉迟恭 + 魏征                  |
| **上书 shangshu** | UI 简单操作 → 杜如晦 → qizou → 李世民（**不经** preference 奏折链） |

## 贞观职责（实现版）

| 人                | 职责                                                    | 禁止                                |
| ----------------- | ------------------------------------------------------- | ----------------------------------- |
| **UI**            | 褚遂良（preference）；shangshu（解耦操作）              | `invoke`、`preferenceStore.addPath` |
| **褚遂良**        | 奏折；`approved` 门控                                   | 直 IPC、启奏路径完成                |
| **房玄龄**        | paths delta、matter-sync（acknowledged 后写 Store）     | 直调 Rust                           |
| **袁天罡**        | `executeZhaoling` 内唯一 `invoke`；路径持久化成功后启奏 | 改 Pinia、zouwu、bridge 文件        |
| **李世民**        | 路由启奏                                                | 持久化                              |
| **尉迟恭 / 魏征** | 吃圣旨                                                  | 写 `preferences.json`               |

```text
奏折：UI → 褚遂良 → 房玄龄 → 袁天罡.executeZhaoling
         → invoke(preferences_update) → 房玄龄 matter-sync

启奏（paths only，持久化成功后）：
  袁天罡 → add_path_completed / remove_path_completed
         → 李世民 → 尉迟恭 + 魏征
```

主题/语言/缩略图：奏折链同上，**无启奏**。

## 实现摘要

| 项            | 结果                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust commands | `apps/photasa/src-tauri/src/commands/preferences.rs` — `preferences_get`、`preferences_update`；`PreferencesState` + `photasa-preference::PreferencesStore` |
| 删除          | `adapters/preferences_adapter.rs`；`tianshu.rs` 零 `PreferencesAdapter`                                                                                     |
| TS 直连       | `yuantiangang.ts` `PREFERENCE_ZHAOLING_MATTERS` 分支；`preferences-delta.ts`；`tauri-command-names.ts` `PREFERENCES_COMMANDS`                               |
| Intent        | `intent.ts` 移除全部 preference → zouwu 映射                                                                                                                |
| 贞观 UI       | `App.vue` → `chuSuiLiang.addPath`；`GeneralSettings.vue` 已用褚遂良                                                                                         |
| 启奏来源      | `event-routing.yml` `add_path_completed` / `remove_path_completed` 的 `when.from: "袁天罡"`                                                                 |
| 尉迟恭        | `scan_queue_cleanup_*` 改内部日志，不启奏                                                                                                                   |

## Acceptance（已验证）

1. ✅ `preferences_adapter.rs` 不存在；`PreferencesAdapter` registry 零命中
2. ✅ `wenchang-bridge.ts` 不存在
3. ✅ `invoke("preferences_` 仅 `yuantiangang.ts`（测试 mock 除外）
4. ✅ `intent.ts` 无 preference → zouwu 映射
5. ✅ UI → 褚遂良 → 房玄龄 → 袁天罡；无 `preferenceStore.addPath`（`App.vue`）
6. ✅ `approved` 后袁天罡启奏；褚遂良不启奏路径完成
7. ✅ `cargo test -p photasa -p photasa-preference` 78 passed；vitest preference/yuantiangang/router 相关套件通过

```bash
test ! -f apps/photasa/src-tauri/src/adapters/preferences_adapter.rs
test ! -f apps/photasa/src/services/yuantiangang/wenchang-bridge.ts
rg 'invoke\("preferences_' apps/photasa/src --glob '!**/__tests__/**'  # 仅 yuantiangang.ts
```

## Checklist

- [x] `commands/preferences.rs` + 删 adapter
- [x] `yuantiangang.ts` PREFERENCE 分支 + 内联 `invoke`（无 bridge）
- [x] `preferences-delta.ts`
- [x] `intent.ts` 清映射
- [x] 褚遂良 `approved` 门控；`App.vue`；尉迟恭 cleanup
- [x] 袁天罡启奏 `add_path_completed` / `remove_path_completed`；`event-routing.yml` from 袁天罡
- [x] 测试 + 验收

## Related

- **0142**：贞观 IPC 范式（`executeZhaoling` 内 `invoke`）
- **0145**：folder tree 同范式 + 设计铁律（禁止 bridge 文件）
- **0137**：袁天罡唯一 IPC 边界
