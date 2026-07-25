# RFC 0167 – MCP bridge webview JS 执行类工具不可用（未解决）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: 🔴 Blocked / Unresolved（根因未坐实，排查已暂停，非放弃）
**Created**: 2026-07-24
**Area**: Tauri / Dev Tooling / Debugging
**Related**: 无

---

## Problem

Photasa 集成了 `tauri-plugin-mcp-bridge`（`apps/photasa/src-tauri/Cargo.toml`，`^0.10.0`）+ 客户端 `@hypothesi/tauri-mcp-server`（`.mcp.json`/`.cursor/mcp.json`/`.codex/config.toml`/`.agents/mcp_config.json` 四处项目级配置均已接入），用于 AI 助手调试运行中的 Photasa（macOS，Tauri 2.10.3）。

**能用的部分**：IPC 层稳定——`driver_session`（连接管理）、`ipc_get_backend_state`（查后端状态）均正常工作，可用于确认应用运行状态、区分 dev/prod 实例身份（identifier）。

**不能用的部分**：任何依赖 webview 内 JS 执行的工具全部失败，报同一错误：

```
Error: JavaScript execution failed: WebView execution failed:
Resolve-ref helper was not available in the webview after registration.
```

受影响工具：

- `mcp__tauri__webview_execute_js`
- `mcp__tauri__webview_screenshot`
- `mcp__tauri__read_logs(source: "console")`
- `mcp__tauri__webview_dom_snapshot`
- `mcp__tauri__webview_keyboard`（键盘事件模拟也走同一路径）

## 已排查并排除的假设

1. **窗口焦点/可见性**——手动激活窗口使其 `focused: true`（通过 `ipc_get_backend_state` 确认），问题依旧。已排除。
2. **插件版本落后**——从 `0.10.0` 升级到 `0.12.0`（本地 vendor 编译验证过），问题依旧。已排除。
3. **native evaluate 路径本身有 bug**——加诊断日志（`eprintln!`）到 vendor 的 `execute_js.rs::native_evaluate_js`，确认：`with_webview` 闭包成功进入、`evaluateJavaScript_completionHandler` 被真实调用、completion handler **确实被回调**（`error_null=true, result_null=false`）、`rx` 成功收到结果。**Native JS 执行机制本身完全正常，不是 bug 所在**。已排除。
4. **`register_script` 调用未到达 Rust 端**——加诊断日志到 `websocket.rs::handle_register_script`，确认该函数被调用，且 `inject_script_to_webview` 返回 `Ok`。**注入调用链路本身正常**。已排除。

## 未验证、无法验证到底的部分

**核心悬案**：`inject_script_to_window`（`websocket.rs`）用 `window.eval()` 创建 `<script>` 标签、设置 `textContent`、`appendChild` 到 `document.head`——这一步 Rust 侧确认无错误返回，但**浏览器（WKWebView）是否真的执行了这段内联脚本内容，从未被直接证实**。

怀疑方向：Photasa 的 CSP（`app.security.csp.script-src`）默认不含 `'unsafe-inline'`，理论上会静默拒绝内联 `<script>` 执行（`Content-Security-Policy` 违规通常不产生 JS 层面异常，只是脚本不执行）。曾在 `tauri.dev.conf.json` overlay 中临时加入 `'unsafe-inline'` 测试，问题依旧复现——**但这次测试本身不可靠**：

- 未确认新配置是否真的被这次运行的 dev 实例加载（Cargo.toml/配置文件在排查过程中多次被外部动作还原，无法完全排除测的是旧配置）
- 未能读取 webview 内 `securitypolicyviolation` 事件或 `console` 输出来直接确认 CSP 是否拦截——这正是本 RFC 想修的能力本身（`read_logs(console)`），构成排查死循环：想验证 A 需要用到被 A 阻断的能力

**为什么没有继续查下去**：需要人工打开 webview 开发者工具（`Cmd+Option+I` 或右键检查元素）手动读取 console 才能突破这个死循环，AI 助手没有桌面 GUI 操作能力（无鼠标/键盘/屏幕控制，`mcp__tauri__webview_keyboard` 本身也被同一 gate 挡住，无法用来触发开发者工具）。人工验证一次即可确认，但该验证尚未完成或结果未记录。

## 现状（代码层面）

**排查过程中的临时改动已全部清理，仓库为干净状态**：

- Vendor 本地化的 `tauri-plugin-mcp-bridge`（`crates/tauri-plugin-mcp-bridge/` + 根 `Cargo.toml` 的 `[patch.crates-io]`）已移除，依赖回到 crates.io 官方 `0.10.0`
- `tauri.dev.conf.json` 的临时 CSP `'unsafe-inline'` 测试改动已还原
- `apps/photasa/src/main.ts` 的临时诊断代码（`securitypolicyviolation` 监听、`window.__MCP__` 轮询）已移除
- vendor 版本里加的 `eprintln!` 诊断日志（`execute_js.rs`、`websocket.rs`）随 vendor 移除一并清除，未保留在任何形式的仓库文件里

## 当前决策：暂停排查，使用受限能力

**不再投入时间继续排查这个具体问题**。MCP bridge 的 IPC 层（连接状态、后端元信息查询）已经够用，webview JS 执行类工具（截图、日志、DOM）标记为已知不可用，日常调试改用：

- Rust 端日志（`~/.photasa/` 或 dev 终端 stdout，已验证包含详细的应用运行时日志，覆盖大部分调试需求）
- 前端异常需要人工打开开发者工具查看，无法通过 AI 助手自动化读取

## Non-goals（本次未做，留白）

- 未升级 `tauri-plugin-mcp-bridge` 到 crates.io 最新正式版本（保留在 `0.10.0`，vendor 尝试的 `0.12.0` 已撤销）
- 未向上游（`hypothesi/mcp-server-tauri`）提交 issue 报告这个具体失败模式——已确认没有精确匹配的既有 issue（`#12`/`#25` 相关但不完全一致），但未整理成新 issue 提交

## Acceptance（若未来重启此调查，需满足）

1. 人工在 Photasa webview 内打开开发者工具，实测确认 `window.__MCP__` 状态 + 是否有 `securitypolicyviolation` 事件，作为坐实/推翻 CSP 假设的直接证据
2. 若坐实 CSP 是根因：验证 `'unsafe-inline'` 修复方案在**确认加载的配置版本**下真实生效（需要先解决排查过程中反复出现的 Cargo.toml/配置文件被外部还原的问题，确保测的是自己改的那份配置）
3. 若排除 CSP：需要新的假设与验证路径，不在本 RFC 覆盖范围
4. 修复验证通过后，`mcp__tauri__webview_execute_js`/`webview_screenshot`/`read_logs(console)` 三个工具的最小可复现测试全部成功，作为最终验收标准

## Risks

- 排查过程中反复出现"改动被外部还原"的现象（Cargo.toml 多次回到 git HEAD 状态），原因未查清（曾怀疑过 husky/lint-staged/别的 AI 工具，均未证实）——这个环境不稳定性本身可能是干扰未来排查的独立风险，建议排查前先确认没有其他自动化进程在并发操作同一仓库
