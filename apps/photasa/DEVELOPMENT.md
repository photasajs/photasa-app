# Photasa 本地开发（Dev / Prod 通道）

RFC [0157](../../.spec/rfc/0157-tauri-dev-prod-side-by-side.md)：Dev 与已安装的 Prod 包可同机并存（独立 `identifier` → 独立数据目录与单实例锁）。

**日常开发请用仓库根目录 `pnpm dev`（或 `pnpm build:debug:photasa`），不要手敲裸 `tauri dev` / `tauri build --debug`——无 `--config` 时仍走 Prod `identifier`，会与已装 Prod 互踩数据。**

Tauri v2 的 `--config` 对**数组字段整段替换**（非按项合并）。`tauri.dev.conf.json` 里的 `app.windows` 必须与 `tauri.conf.json` 保持字段对齐，仅改 `productName` / `identifier` / 标题等 Dev 区分项。

## 脚本归属（唯一权威表）

| 脚本                                               | 运行者         | 通道 | `identifier`         | `--config`                                         | 是否发布                    |
| -------------------------------------------------- | -------------- | ---- | -------------------- | -------------------------------------------------- | --------------------------- |
| `dev`（根目录 `pnpm dev`）                         | 开发者         | Dev  | `me.photasa.app.dev` | `tauri.dev.conf.json`                              | 否，CI/CD 从不构建 Dev 通道 |
| `build:debug`（根目录 `pnpm build:debug:photasa`） | 开发者         | Dev  | `me.photasa.app.dev` | `tauri.dev.conf.json`                              | 否                          |
| `build`（根目录 `pnpm build:photasa`）             | 开发者（少见） | Prod | `me.photasa.app`     | 无                                                 | 否（本地产物，非发布渠道）  |
| `build:ci`（仅 `photasa-build.yml`）               | **仅 CI**      | Prod | `me.photasa.app`     | 无（主配置 + 内联 `createUpdaterArtifacts:false`） | 否，仅编译门禁              |
| `upload-release-assets.yml`（`tauri-action`）      | **仅 CI**      | Prod | `me.photasa.app`     | 无（主配置 release profile）                       | **是**，唯一对外发布路径    |

**铁律：** `tauri.dev.conf.json` 不得出现在任何 `.github/workflows/**` 或 `build:ci` 中（由 `scripts/ci/guard-prod-build-channel.sh` 门禁）。

## 切换 Dev identifier 后

本地 Dev 数据目录变为 `me.photasa.app.dev`（macOS：`~/Library/Application Support/me.photasa.app.dev`）。此前在 Prod identifier 下积累的 dev 数据仍在 `me.photasa.app`，不会自动迁移——预期行为，非 bug。
