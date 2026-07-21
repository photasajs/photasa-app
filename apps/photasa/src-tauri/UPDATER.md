# Photasa Tauri Updater（生产配置）

RFC：[0113](../../.spec/rfc/0113-tauri-updater-production-and-prefs-sync.md) · 实现：[0090](../../.spec/rfc/completed/0090-tauri-update-service.md)

## 运行时行为

- 启动时在 `main.rs` setup 中读取 `~/.photasa/preferences/preferences.json` 的 `system.autoUpdate`，写入 `UpdateState.auto_config`（见 `commands/update_config.rs`）。
- 后台定时检查见 `commands/update_periodic.rs`（RFC 0106）：启动后 5 秒必检一次；之后按 `enabled` / `checkInterval`（小时）轮询。
- 前端 `update_auto_update_config` 仍只更新内存；持久化由文昌偏好层负责。

## `tauri.conf.json`（开发默认）

当前仓库内 `plugins.updater.pubkey` 与 `endpoints` 为空，**开发构建不会连生产更新服务器**。这是预期行为。

生产发布前必须在 CI 或受控构建环境中注入真实值（**勿将私钥提交进 Git**）。

## 生产构建清单

### 1. 签名密钥

```bash
# 生成密钥对（仅需一次，妥善保管私钥）
pnpm tauri signer generate -w ~/.tauri/photasa.key

# 构建带更新包的 release 前导出私钥（.env 无效，须直接 export）
export TAURI_SIGNING_PRIVATE_KEY="~/.tauri/photasa.key"
# 若密钥有密码：
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-password"
```

将 `~/.tauri/photasa.key.pub` 内容写入 `tauri.conf.json` → `plugins.updater.pubkey`，或在 CI 中 patch 该字段。

参考：[Tauri Updater — Signing](https://v2.tauri.app/plugin/updater/#signing-updates)

### 2. 更新端点 `endpoints`

在 `tauri.conf.json` 中配置至少一个 HTTPS 端点，支持动态变量，例如：

```json
"plugins": {
 "updater": {
 "pubkey": "<CONTENT FROM .key.pub>",
 "endpoints": [
 "https://releases.example.com/photasa/{{target}}/{{arch}}/{{current_version}}"
 ]
 }
}
```

或使用静态 `latest.json`（GitHub Releases 等）。端点 URL 与签名后的更新包须与 [RFC 0020](../../docs/rfc/completed/0020-auto-update-server.md) 服务端约定一致。

### 3. 更新产物

`bundle.createUpdaterArtifacts` 为 `true` 时，`tauri build` 会生成签名更新包。确保 CI 上传产物到 `endpoints` 所指向的位置。

## 环境变量摘要

| 变量                                 | 用途                                |
| ------------------------------------ | ----------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | 构建时签名更新包（路径或 PEM 内容） |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥密码（可选）                    |

## 验证

```bash
cd apps/photasa/src-tauri
cargo test update_config:: -- --nocapture
cargo test update_periodic:: -- --nocapture
```

手动：在偏好设置中关闭自动更新 → 重启应用 → 日志应显示 `enabled=false`；定时轮询应跳过 scheduled check（启动 5 秒检查仍会执行，与 legacy-api 一致）。
