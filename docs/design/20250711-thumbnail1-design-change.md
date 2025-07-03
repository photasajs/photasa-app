# Thumbnail1 设计变更说明

## 变更背景
- 旧方案使用 heic-decode 处理 HEIC/HEIF，兼容性和健壮性有限。
- 新方案采用 @saschazar/wasm-heif（WebAssembly）解码，提升跨平台稳定性。

## 主要变更点
1. **HEIC/HEIF 解码链路**
   - 由主进程/worker 端统一处理。
   - 读取原始文件 buffer，传递给 wasm-heif 解码。
   - 解码结果为 Uint8Array，包含 RGBA/RGB 像素数据及 width/height/channels。

2. **与 sharp 的集成**
   - 解码后像素数据统一用 Buffer.from(decoded) 转为 Node.js Buffer。
   - 若 channels=3，自动补齐为 RGBA，保证 sharp 兼容性。
   - 通过 sharp({ raw: { width, height, channels: 4 } }) 生成 JPEG/PNG 预览。

3. **异常健壮性增强**
   - 检查 buffer.length 是否等于 width*height*channels，若不符抛出详细异常。
   - 若 channels 不为 3/4，直接报错。
   - 所有关键步骤均有详细日志，便于排查。

4. **单元测试与兼容性**
   - normalizeThumbnailRequest 等工具函数补充了单元测试，保证路径处理健壮。
   - 兼容 macOS/Windows/Linux，支持主流 HEIC/HEIF 文件。

## 迁移与回滚建议
- 迁移时需确保 wasm_heif.wasm 被正确打包进 Electron 应用。
- 若遇到极端格式或解码失败，可回退到 heic-decode 或主进程 sharp 兜底。

## 未来优化方向
- 支持更多 HEIF 变体（如 AVIF）。
- 异步批量解码与缓存优化。
- 前端 worker wasm 解码兜底。

---
设计变更人：AI助手
日期：2025-07-11
