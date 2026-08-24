# macOS Signing and Notarization

GitHub Release 直装版 Photasa 的 macOS 发布操作指南。

不提交 App Store，不进入 App Review。

| 工作               | 作用                       | 服务                        |
| ------------------ | -------------------------- | --------------------------- |
| Developer ID 签名  | 证明发布者身份             | Apple Developer certificate |
| Notarization       | 让 Gatekeeper 信任下载内容 | Apple notary service        |
| GitHub Release     | 公开下载 DMG 和更新包      | GitHub                      |
| Tauri updater 签名 | 客户端验证更新包未被替换   | Tauri signing key           |

## 集成状态

`.github/workflows/upload-release-assets.yml` 会在 macOS job 导入 Developer ID 证书，并将 Apple notarization 凭证传给 Tauri。Secrets 缺失时 workflow 在构建前失败。

首次真实 GitHub Release 仍是端到端验收：必须确认 Apple 接受 notarization，且下载的 DMG 通过 Gatekeeper 检查。

## 导出 Developer ID 证书

Keychain Access → `login` → `My Certificates`。

找到并展开：

```text
Developer ID Application: Peng Li (7989A7T39X)
```

右键该证书及其私钥 → `Export` → 保存为 `developer-id-application.p12`。

导出时设置强密码。此 `.p12` 含私钥：不得提交 Git，不得上传到 Release，不得发送到聊天。

在本机生成 GitHub Secret 值：

```zsh
openssl base64 -A -in developer-id-application.p12 -out developer-id-application.p12.base64
```

`developer-id-application.p12.base64` 的完整内容用于 `APPLE_CERTIFICATE`。

## 创建 App-Specific Password

这是 Apple notarization 用的专用密码，不是 Apple Account 主密码。

前提：Apple Account 已开启双重认证。

1. 打开 [account.apple.com](https://account.apple.com) 并登录。
2. 打开 `Sign-In and Security`。
3. 选择 `App-Specific Passwords`。
4. 选择 `Generate an app-specific password`。
5. 标签填写 `Photasa GitHub Actions`。
6. 立即复制生成密码，保存到密码管理器。

生成值仅显示一次。修改或重置 Apple Account 主密码会撤销所有 App-Specific Password；届时生成新密码并更新 GitHub Secret。

## 配置 GitHub Actions Secrets

仓库页面：`Settings` → `Secrets and variables` → `Actions` → `New repository secret`。

| Secret                       | 值                                               | 用途                      |
| ---------------------------- | ------------------------------------------------ | ------------------------- |
| `APPLE_CERTIFICATE`          | `.p12.base64` 完整内容                           | CI 导入 Developer ID 证书 |
| `APPLE_CERTIFICATE_PASSWORD` | 导出 `.p12` 时设置的密码                         | 解密证书                  |
| `KEYCHAIN_PASSWORD`          | 新建随机强密码                                   | CI 临时 keychain          |
| `APPLE_SIGNING_IDENTITY`     | `Developer ID Application: Peng Li (7989A7T39X)` | 选择签名身份              |
| `APPLE_ID`                   | Apple Account 邮箱                               | notarization 登录         |
| `APPLE_PASSWORD`             | App-Specific Password                            | notarization 登录         |
| `APPLE_TEAM_ID`              | `7989A7T39X`                                     | 选择 Apple Developer team |

另保留现有 updater Secrets：

| Secret                               | 用途                |
| ------------------------------------ | ------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | 签名 updater 更新包 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | updater 私钥密码    |

Apple Developer ID 签名与 Tauri updater 签名是两套不同密钥。两者都需要。

## GitHub Actions 发布契约

macOS runner 必须依次：

1. 从 `APPLE_CERTIFICATE` 还原 `.p12`。
2. 导入临时 keychain。
3. 用 `APPLE_SIGNING_IDENTITY` 签名 `.app` 和 DMG。
4. 用 `APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID` 提交 notarization。
5. 等待 Apple 接受，staple ticket 到应用和 DMG。
6. 上传 DMG、updater bundle、`.sig`、`latest.json` 到同一 GitHub Release。

GitHub Release 是公开下载与 updater 后端。Apple notarization 只发放 Gatekeeper 信任票据；不会发布软件。

## 发布验收

从 GitHub Release 下载新 DMG，在干净 macOS 环境运行：

```zsh
spctl --assess --type open --context context:primary-signature -vv /path/to/Photasa.dmg
xcrun stapler validate /path/to/Photasa.dmg
```

两条命令都必须成功。再确认 Release 含 `latest.json`、macOS updater archive 与对应 `.sig`。

## 安全与恢复

- 不要把任何 Secret 放进 `.env`、仓库、Issue、PR、日志或聊天。
- `.p12` 与 App-Specific Password 都应有受控备份。
- 泄露时：撤销 App-Specific Password，重新导出或替换证书，并更新 Secrets。
- App-Specific Password 仅是 CI 过渡凭证；后续可迁移 App Store Connect API Key，减少 Apple ID 密码依赖。

## 官方资料

- [Apple Support：App-Specific Password](https://support.apple.com/en-ie/102654)
- [Apple Developer：Notarization workflow](https://developer.apple.com/documentation/Security/customizing-the-notarization-workflow)
- [Tauri：macOS signing and notarization](https://v2.tauri.app/distribute/sign/macos/)
