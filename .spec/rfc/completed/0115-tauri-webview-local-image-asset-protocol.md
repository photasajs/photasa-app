# RFC 0115: Tauri WebView 本地图片加载（Asset 协议）

- **Start Date**: 2026-06-06
- **Status**: Implemented
- **Depends on**: RFC 0069（缩略图）、RFC 0073（UI/适配层）、RFC 0075（legacy-api）、[Tauri Asset Protocol 文档](https://v2.tauri.app/security/asset-protocol)
- **Related**: RFC 0102（RAW 占位缩略图）、RFC 0098（Electron `registerFileProtocol` 对照）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Electron 的 `file://` + `protocol.registerFileProtocol("file", …)` **仅作行为对照**，不是 Tauri 的实现路径。
- Tauri 下显示本地文件必须使用 **`convertFileSrc()` → asset 协议 URL**，并由 `tauri.conf.json` 的 `security.assetProtocol` 授权路径。
- `fs:scope`（capabilities）管 **`@tauri-apps/plugin-fs` IPC 读写**，**不**管 `<img src>` 能否加载。

## Summary

Photasa（Tauri）在图库列表/预览中无法显示缩略图，控制台报 `Not allowed to load local resource: file:///…`。根因是 WebView 从 `http://localhost:1421`（Vite dev）加载页面时 **禁止** 以 `file://` 作为子资源 URL，且 HTML meta CSP 未放行 Tauri 的 asset 协议。本 RFC 规定：**磁盘路径 → `convertFileSrc` → `asset://localhost/…`（macOS/Linux）**，并在前端/Rust/CSP 三层对齐，使图库应用能正常读图。

## Context / Problem

### 现象

- 选择文件夹后 `photoList` 可能有数据，但网格缩略图空白。
- DevTools：`Not allowed to load local resource: file:///Volumes/…/.photasaoriginals/thumbnail-….png`
- 预加载同样失败（`image-prefetch.ts` 创建 `Image` 并赋值 `src`）。

### 误解（曾导致错误排查方向）

| 机制                                     | 实际作用                             | 能否修复 `<img src="file://…">` |
| ---------------------------------------- | ------------------------------------ | ------------------------------- |
| `capabilities/default.json` → `fs:scope` | `@tauri-apps/plugin-fs` 读写字库路径 | **否**                          |
| CSP 增加 `file:`                         | 仍被 WebView 跨源策略拒绝            | **否**（引擎层限制）            |
| Rust `file_url_from_path` 返回 `file://` | 与 Electron preload 形状一致         | **在 Tauri WebView 中无效**     |

### Electron 为何能用 `file://`

主进程注册自定义 file 协议，WebView 请求 `file://` 时由主进程映射到磁盘路径：

```typescript
// apps/desktop/src/main/index.ts
protocol.registerFileProtocol("file", (request, callback) => {
    const pathname = decodeURIComponent(request.url.replace("file:///", ""));
    callback(pathname);
});
```

preload 的 `fileUrlFromPath()` 产出 `file://` URL，与上述拦截配合。**Tauri 无等价 `registerFileProtocol("file")`。**

### Tauri 官方机制

1. **`convertFileSrc(absolutePath)`**（`@tauri-apps/api/core`）将绝对路径转为 WebView 可加载 URL。
2. **`app.security.assetProtocol`**（`tauri.conf.json`）定义允许从磁盘送入 WebView 的路径 scope。
3. **CSP `img-src` / `media-src`** 必须包含 `asset:`、`asset://localhost`、`http(s)://asset.localhost`。

平台差异（Tauri 2 内建 `core.js`）：

- **macOS / Linux / iOS**：`asset://localhost/{encodeURIComponent(absolutePath)}`
- **Windows / Android**：`{protocolScheme}://asset.localhost/{encoded}`（常为 `http` 或 `https`）

**注意**：整段路径用 `encodeURIComponent` 编码（含 `/` → `%2F`），不是按 path segment 分段编码。

## Goals

1. 图库列表、预览、`BaseImage` 预加载能在 Tauri WebView 中显示本地缩略图/原图。
2. 保留 Electron 路径下 `file://` 行为（`toFileProtocol` 命名可保留，运行时分支）。
3. 统一 URL 编解码：`convertFileSrc` ↔ Rust invoke ↔ 缓存键。
4. 文档化「为何不能靠 CSP 放行 `file://`」以免回归。

## Non-Goals

- 在 Tauri 中复刻 Electron `registerFileProtocol("file")`（平台不支持）。
- 用 `@tauri-apps/plugin-fs` 读文件再转 `blob:` 作为默认路径（性能差，仅作极端回退）。
- 修改 `.photasa.json` on-disk 格式。

## Proposed Solution

### 数据流（Tauri）

```
.photoList 相对路径
    → toAbsoluteMediaPath(folder, relative)
    → convertFileSrc(absolute)          // media-url.ts
    → asset://localhost/%2FVolumes%2F…
    → WebView <img src="…">           // assetProtocol.scope 校验
    → 显示 PNG/JPEG
```

Rust invoke（缩略图生成、元数据）走反向：

```
asset:// 或 file:// 或绝对路径
    → webviewMediaUrlToAbsolutePath()
    → normalize_path (Rust)
    → create_thumbnail / get_file_metadata
```

### 三层配置

**1. `tauri.conf.json`**

```json
"security": {
  "csp": {
    "img-src": "'self' asset: asset://localhost http://asset.localhost https://asset.localhost blob: data:",
    "media-src": "'self' asset: asset://localhost http://asset.localhost https://asset.localhost blob: data:"
  },
  "assetProtocol": {
    "enable": true,
    "scope": {
      "requireLiteralLeadingDot": false,
      "allow": ["$HOME/**", "/Volumes/**", "**"]
    }
  }
}
```

**2. `index.html` meta CSP** — 必须与 Tauri CSP 一致；**不得**仅写 `file:` 而不写 `asset:`（曾导致 dev 下 asset 图被拦）。

**3. 前端 `media-url.ts`**

- `toWebviewMediaUrl` / `ensureWebviewMediaUrl`：Tauri 下调用 `convertFileSrc`。
- `parseAssetWebviewUrl` / `isAssetWebviewUrl`：正确解析 `asset://localhost/…`（此前只处理 `https://asset.localhost`，与 macOS 实际 URL 不符）。
- `isTauriRuntime()`：`isTauri()` 或 `window.__TAURI_INTERNALS__.convertFileSrc` 存在。

### 曾发现的实现 bug

| Bug                                               | 后果                                               | 修复                             |
| ------------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| `import.meta.env.TAURI_PLATFORM` 判断 Tauri       | Vite 未接 Tauri 插件，恒为 `false`，仍产 `file://` | 改用 `isTauri()`                 |
| `index.html` CSP 含 `file:`、无 `asset:`          | 与 Tauri 机制冲突                                  | 对齐 asset CSP                   |
| `file_url_from_path`（Rust）返回 `file://`        | invoke 路径仍不可显示                              | 改为 `asset://localhost/…`       |
| `legacy-api.fileUrlFromPath` 调 Rust 产 `file://` | 同上                                               | Tauri 分支用 `toWebviewMediaUrl` |
| `webviewMediaUrlToAbsolutePath` 未识别 `asset://` | invoke 传错路径                                    | `parseAssetWebviewUrl`           |
| `image-prefetch` / `BaseImage` 直接用传入 `src`   | 遗留 `file://` 未转换                              | `ensureWebviewMediaUrl`          |

## Implementation Details

### 前端

| 文件                                                 | 职责                                            |
| ---------------------------------------------------- | ----------------------------------------------- |
| `apps/photasa/src/utils/media-url.ts`                | 路径 ↔ WebView URL 转换核心                     |
| `apps/photasa/src/common/image.ts`                   | `toFileProtocol` → `toWebviewMediaUrl`          |
| `apps/photasa/src/utils/image-prefetch.ts`           | 预加载前 `ensureWebviewMediaUrl`                |
| `apps/photasa/src/components/ui/BaseImage.vue`       | `actualSrc` 与 `@error` 回退均走 asset URL      |
| `apps/photasa/src/api/legacy-api.ts`                 | `fileUrlFromPath`、`getFileMetadata` 路径规范化 |
| `apps/photasa/src/utils/thumbnail-fallback-cache.ts` | 缓存键识别 `asset://`                           |

### Rust

| 文件                                               | 职责                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/photasa/src-tauri/src/commands/path.rs`      | `file_url_from_path` 产出 asset URL；`encode_uri_component` 对齐 JS |
| `apps/photasa/src-tauri/tauri.conf.json`           | `assetProtocol` + CSP                                               |
| `apps/photasa/src-tauri/capabilities/default.json` | `fs:scope`（IPC 读写，与显示无关但图库仍需）                        |

### Electron 对照（不变）

| 环境     | WebView URL                                            |
| -------- | ------------------------------------------------------ |
| Electron | `file://…` + `registerFileProtocol`                    |
| Tauri    | `asset://localhost/…` 或 `http(s)://asset.localhost/…` |

API 名称 **`toFileProtocol` / `fileUrlFromPath`** 保留语义「转为可在 WebView 加载的本地媒体 URL」，实现按运行时分支。

## Alternatives

### A. 全量 `blob:` URL（fs 插件读文件）

- **原理**：Rust/JS 读文件 → `Blob` → `URL.createObjectURL`。
- **缺点**：大图内存与 IPC 开销高；违背 Tauri 推荐（文档建议优先 `convertFileSrc`）。
- **结论**：不采用为默认路径。

### B. CSP 仅添加 `file:`

- **原理**：认为 CSP 是唯一步骤。
- **缺点**：WebView 仍拒 cross-origin `file://`；无法替代 asset 协议。
- **结论**：已证伪。

### C. 自定义 Tauri 协议名 `photasa-media`

- **原理**：`convertFileSrc(path, 'photasa-media')` + 注册 handler。
- **缺点**：需额外 Rust 注册与 CSP；asset 协议已内置 scope。
- **结论**：不采用；使用标准 `asset`。

## Risks

- **`tauri.conf` / capability 变更需完全重启 `tauri dev`**，热更新不生效。
- **scope 过宽**（如 `"**"`）暴露用户全盘可读路径给 WebView；生产应收紧到图库常用目录（与 `fs:scope` 协同审查）。
- **路径含 `#`、`?`**：须与 `encodeURIComponent` 一致；特殊字符需单测覆盖。
- **历史文件夹**无 `.photasaoriginals`：`BaseImage` 应回退 `preview`/`raw`（已有逻辑）。

## Testing Strategy

### 单元测试

```bash
cd apps/photasa
pnpm exec vitest run src/utils/__tests__/media-url.test.ts
pnpm exec vitest run src/utils/__tests__/thumbnail-fallback-cache.test.ts
```

- `convertFileSrc` mock 使用 `asset://localhost/${encodeURIComponent(path)}`。
- `ensureWebviewMediaUrl`：`file://` → asset URL。
- `parseAssetWebviewUrl` round-trip。

### Rust

```bash
cd apps/photasa/src-tauri
cargo test commands::path::tests::file_url_from_path
```

### 手动验收

1. 完全重启 `tauri dev`。
2. 选择含图片的文件夹（如 `/Volumes/…`）。
3. DevTools → Elements：`<img src>` 应为 `asset://localhost/…`，**不是** `file://`。
4. 无 `Not allowed to load local resource`。
5. 扫描后 `.photasaoriginals/thumbnail-*.png` 存在且网格有图。

## Implementation Checklist

- [x] `media-url.ts`：`ensureWebviewMediaUrl`、`parseAssetWebviewUrl`、`isAssetWebviewUrl`
- [x] `index.html` CSP 对齐 asset（移除误导性 `file:` img-src）
- [x] `tauri.conf.json` CSP + `assetProtocol.scope`
- [x] `image-prefetch.ts`、`BaseImage.vue` 加载前转换 URL
- [x] `legacy-api.ts`：`fileUrlFromPath`、`getFileMetadata` 路径规范化
- [x] `path.rs`：`file_url_from_path` 返回 asset URL
- [x] Vitest + Rust 单测
- [ ] 生产 scope 收紧评审（后续 hardening，非阻塞）

## Dependencies

- Tauri 2 `protocol-asset` feature（`apps/photasa/src-tauri/Cargo.toml` 已启用）
- `@tauri-apps/api` `convertFileSrc` / `isTauri`
- 扫描写 `photoList` + 缩略图生成（RFC 0068/0069/0105）

## Unresolved Questions

- 是否在 `legacy-api` 层 deprecate 名称 `fileUrlFromPath` 并 alias 为 `webviewMediaUrlFromPath`（破坏性小，可后续 RFC）。
- Windows 生产包 `http://asset.localhost` vs `https` 与 `use_https_scheme` 的一致性（需在 Windows CI 实机验证）。

---

## Revision Log

### 2026-06-09: 特殊字符路径 CSP 修复

**问题**：路径含特殊字符（如 `Luigi's Mension`、空格）时，`asset://localhost/%2F...` URL 被 WebKit CSP 拒绝：

```
Refused to load asset://localhost/%2FVolumes%2FSUCAI%2FTest%2FLuigi's%20Mension%2F.photasaoriginals%2Fthumbnail-*.png
because it does not appear in the img-src directive of the Content Security Policy.
```

**根因**：原始 CSP `img-src` 仅含 `asset:` 和 `http://asset.localhost`，未包含 `asset://localhost`。macOS WKWebView 上 `convertFileSrc` 产出 `asset://localhost/...` URL，CSP 未匹配此 origin。

**修复**：

1. **`tauri.conf.json` CSP** — `img-src` 和 `media-src` 加入 `asset://localhost`：
    ```json
    "img-src": "'self' asset: asset://localhost http://asset.localhost https://asset.localhost blob: data:"
    ```
2. **`media-url.ts` 重构** — 增强 URL 解析，新增：
    - `isAssetWebviewUrl()` — 识别 `asset://` 和 `http(s)://asset.localhost` 双格式
    - `parseAssetWebviewUrl()` — 正确 decode `asset://localhost/{encodeURIComponent(path)}`
    - `ensureWebviewMediaUrl()` — 兼容遗留 `file://`、asset URL、磁盘绝对路径
    - `isTauriRuntime()` fallback 到 `__TAURI_INTERNALS__` 检测
    - `absoluteThumbnailPathForSource()` 先调 `webviewMediaUrlToAbsolutePath()` 再算路径

**评估过的替代方案**：

| 方案                                                                                | 结论                                                                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 禁用 CSP（`csp: null`）                                                             | 不采用 — 虽然内容全本地，但违反安全最佳实践                                                   |
| 自定义 Rust protocol `photasa-media`（`register_asynchronous_uri_scheme_protocol`） | 不采用 — HTTP scheme CSP 更可靠，但 `asset://localhost` 加入 CSP 后已解决，无需额外 Rust 代码 |
| `img-src: *` 通配                                                                   | 不采用 — CSP `*` 不匹配 custom scheme                                                         |

**文件变更**：

| 文件                                                 | 变更                                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/photasa/src-tauri/tauri.conf.json`             | CSP `img-src`/`media-src` 加 `asset://localhost`                                                                                   |
| `apps/photasa/src/utils/media-url.ts`                | 新增 `isAssetWebviewUrl`、`parseAssetWebviewUrl`、`ensureWebviewMediaUrl`；重构 `isTauriRuntime`、`absoluteThumbnailPathForSource` |
| `apps/photasa/src/utils/__tests__/media-url.test.ts` | mock 改为 `asset://localhost/` 格式，新增 round-trip 和 `ensureWebviewMediaUrl` 测试                                               |
