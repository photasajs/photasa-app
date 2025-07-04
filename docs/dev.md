# 开发命名规范说明

## 1. 组件命名
- 文件名：PascalCase 或 kebab-case，如 ThemeSettings.vue 或 theme-settings.vue
- 组件名：PascalCase，如 ThemeSettings

## 2. 服务/管理器命名
- 文件名：kebab-case，结尾为 .service.ts 或 -manager.ts，如 find-photo-service.ts
- 类名：PascalCase，如 FindPhotoService

## 3. 接口定义命名
- 文件名：kebab-case，结尾为 .interface.ts，如 find-photo-service.interface.ts
- 接口名：I+PascalCase，如 IFindPhotoService
- 常量名：PascalCase，如 FindPhotoServiceKey

## 4. 典型用法示例

```
// src/renderer/src/services/find-photo-service.ts
import type { IFindPhotoService } from "@renderer/interface/find-photo-service.interface";

export class FindPhotoServiceIpc implements IFindPhotoService { /* ... */ }

// src/renderer/src/interface/find-photo-service.interface.ts
export interface IFindPhotoService { /* ... */ }
export const FindPhotoServiceKey = Symbol("FindPhotoService");

// src/renderer/src/main.ts
import { FindPhotoServiceIpc } from "@renderer/services/find-photo-service";
import { FindPhotoServiceKey } from "@renderer/interface/find-photo-service.interface";
app.provide(FindPhotoServiceKey, new FindPhotoServiceIpc());
```

## 5. 其他说明
- 所有import路径需与实际文件名严格一致，避免大小写混用。
- 统一采用kebab-case风格，便于自动导入和跨平台兼容。
- 组件、服务、接口等不同类型文件应分目录管理，结构清晰。
