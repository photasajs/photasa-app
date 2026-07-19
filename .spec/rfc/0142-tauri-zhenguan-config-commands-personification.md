# RFC 0142: Tauri config commands personification (文件夹配置命令拟人化设计对齐)

- **Start Date**: 2026-07-19
- **Status**: Draft
- **Priority**: P1
- **Area**: Photasa / Renderer / Zhenguan Design / Config
- **Depends on**: [0138](./0138-tauri-photasa-config-crate.md)（已完成，Config 机制层独立）、[0137](./0137-tauri-zhenguan-direct-ipc-migration.md)（Zhenguan 直连 Tauri IPC 规范）
- **Path**: `.spec/rfc/0142-tauri-zhenguan-config-commands-personification.md`

## 1. Decision

重构前端 UI 组件（如 `FolderList.vue`） and API 调用链中对 `.photasa.json` 文件夹级配置的调用。废除目前组件直接越权调用原始 Tauri 命令（`invoke`） or 直接导入 `utils/api.ts` 兼容层函数的做法，完全将配置管理职能归口于**应用运行时状态监察官员 — 魏征（WeiZheng）**，使其符合贞观拟人化设计（Zouzhe/Zhaoling 系统与直连 IPC 规范）。

---

## 2. 背景与现状分析

在现有的 Tauri 移植版实现中，前端获取与修改 `.photasa.json` 配置的链路违背了贞观拟人化设计原则（RFC 0048 & 0137）：

1. **越权直连**：`FolderList.vue` 等组件直接从 `@renderer/utils/api` 导入 `getPhotasaConfig` 和 `fixPhotasaConfig`。
2. **底层实现绕过**：这些工具函数直接通过 `window.api`（`legacy-api.ts`）直连 Tauri 接口，完全绕过了**房玄龄（Store 自动化与持久化）**与**袁天罡（唯一传输边界）**。
3. **职责归属**：`.photasa.json` 文件夹配置解析出的 `currentFolderConfig` 属于 `appState`（应用运行时状态）的一部分。根据拟人化朝廷分工，`appState` 完全属于 **魏征（WeiZheng）** 的监察与管理职责范围。褚遂良（ChuSuiLiang）仅管理应用级偏好（`preferences.json`）和监控路径，不应对单个文件夹内的文书配置进行直接干预。

---

## 3. 设计方案

根据拟人化系统分工，`.photasa.json` 文件夹配置的读取与维护工作应完全由 **魏征（WeiZhengService）** 接管。

### 3.1 流程重构（以修复配置为例）

```text
UI 交互 (FolderList.vue)
  └─ 调用魏征：weiZheng.fixFolderConfig(folder)
       └─ 发送奏折：FangXuanLing.processZouzhe({ matter: "fix_folder_config", ... })
            └─ 房玄龄发诏令：YuanTianGang.executeZhaoling(...)
                 └─ 袁天罡直连 IPC：invoke("fix_photasa_config", { folder })
```

### 3.2 步骤 1: 增设 Zouzhe 奏折事务与官员职责映射

在 `apps/photasa/src/interfaces/fang-xuan-ling.interface.ts` 中新增 Zouzhe 事项定义：

```typescript
export const ZOUZHE_MATTERS = {
    // ...
    GET_FOLDER_CONFIG: "get_folder_config", // 获取文件夹配置
    FIX_FOLDER_CONFIG: "fix_folder_config", // 修复文件夹配置
    RESET_FOLDER_CONFIG: "reset_folder_config", // 重置文件夹配置
    ADD_PHOTO_TO_LIST: "add_photo_to_list", // 照片归档到配置
    REMOVE_PHOTO_FROM_LIST: "remove_photo_from_list", // 从配置中移除照片
} as const;
```

### 3.3 步骤 2: 袁天罡直连 IPC 映射与响应解析

在 `apps/photasa/src/services/yuantiangang/yuantiangang.ts` 的 `executeZhaoling` 中直连对应的 Rust 命令，不再经过 `.zouwu` 工作流（避免生产包打包遗漏风险，符合 RFC 0137 直连规范）：

```typescript
// in yuantiangang.ts -> executeZhaoling
switch (zhaoling.command) {
    case ZOUZHE_MATTERS.GET_FOLDER_CONFIG:
        const config = await invoke("get_photasa_config", { folder: zhaoling.context.folder });
        return {
            acknowledged: true,
            data: config,
            blessing: "天界文书已取回",
            timestamp: Date.now(),
        };

    case ZOUZHE_MATTERS.FIX_FOLDER_CONFIG:
        await invoke("fix_photasa_config", { folder: zhaoling.context.folder });
        return {
            acknowledged: true,
            data: null,
            blessing: "天界文书已修缮",
            timestamp: Date.now(),
        };

    case ZOUZHE_MATTERS.RESET_FOLDER_CONFIG:
        await invoke("reset_photasa_config", { folder: zhaoling.context.folder });
        return {
            acknowledged: true,
            data: null,
            blessing: "天界文书已重置",
            timestamp: Date.now(),
        };

    case ZOUZHE_MATTERS.ADD_PHOTO_TO_LIST:
        await invoke("add_to_photo_list", { photoPath: zhaoling.context.photoPath });
        return {
            acknowledged: true,
            data: null,
            blessing: "照片已登入天界文书",
            timestamp: Date.now(),
        };

    case ZOUZHE_MATTERS.REMOVE_PHOTO_FROM_LIST:
        const updatedConfig = await invoke("remove_from_photo_list", {
            photoPath: zhaoling.context.photoPath,
        });
        return {
            acknowledged: true,
            data: updatedConfig,
            blessing: "照片已从天界文书除名",
            timestamp: Date.now(),
        };
}
```

### 3.4 步骤 3: 魏征服务层接口扩张

在 `apps/photasa/src/services/weizheng/weizheng.ts` 中新增对应业务接口：

```typescript
export class WeiZhengService implements IService {
    // ...
    async getFolderConfig(folder: string): Promise<any> {
        const response = await this.fangXuanLingService.processZouzhe({
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.GET_FOLDER_CONFIG,
            content: { folder },
            priority: ZOUZHE_PRIORITIES.NORMAL,
        });
        return response.data;
    }

    async fixFolderConfig(folder: string): Promise<any> {
        const response = await this.fangXuanLingService.processZouzhe({
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.FIX_FOLDER_CONFIG,
            content: { folder },
            priority: ZOUZHE_PRIORITIES.NORMAL,
        });
        return response.data;
    }

    async resetFolderConfig(folder: string): Promise<any> {
        const response = await this.fangXuanLingService.processZouzhe({
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.RESET_FOLDER_CONFIG,
            content: { folder },
            priority: ZOUZHE_PRIORITIES.NORMAL,
        });
        return response.data;
    }
}
```

### 3.5 步骤 4: 改造 UI 组件，去除直连

改写 `FolderList.vue` 的依赖注入，使用 `useWeiZheng` (或 `inject(GUANYUAN_NAMES.WEI_ZHENG)`) 替换对 `@renderer/utils/api` 函数的直接导入：

```diff
- import { fixPhotasaConfig, getPhotasaConfig } from "@renderer/utils/api";
+ const weiZheng = useWeiZheng();

  async function fixConfig(): Promise<void> {
-     const config = await fixPhotasaConfig(photasa.path);
+     const config = await weiZheng.fixFolderConfig(photasa.path);
      photasa.config = config;
  }
```
