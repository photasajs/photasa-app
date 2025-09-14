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

## 递归更新死循环修复记录

### 问题现象

- 在 ImageList/MediaPreview/VueEasyLightbox 组件联动时，出现 Maximum recursive updates exceeded 报错。
- 具体表现为：图片预览切换时，index 的 set/emit 形成递归环，导致栈溢出。

### 根因分析

- 父组件（ImageList）通过 @change 事件直接赋值 previewIndex，子组件（MediaPreview）watch index 并 emit change，形成 set-emit-set 死循环。
- VueEasyLightbox 内部 changeIndex 也会 emit on-index-change，进一步加剧递归。

### 解决方案

- 采用“只在索引实际变化时才 emit/set”原则，彻底打断递归链。
- MediaPreview.vue: handleOnIndexChange 只在 newIndex !== currentIndex.value 时 emit change。
- ImageList.vue: @change 事件处理时，只有 previewIndex !== i 时才赋值。
- 均已补充注释，防止后续误用。

### 代码变更摘要

- MediaPreview.vue
    ```ts
    function handleOnIndexChange(newIndex: number) {
        // 只在索引实际变化时才 emit，防止递归死循环
        if (newIndex !== currentIndex.value) {
            emit("change", newIndex);
        }
    }
    ```
- ImageList.vue
    ```ts
    function onPreviewIndexChange(i: number) {
        // 只在索引实际变化时才赋值，防止递归死循环
        if (previewIndex.value !== i) {
            previewIndex.value = i;
        }
    }
    ```

### 影响评估

- 彻底消除递归 set/emit 死循环，提升组件健壮性。
- 兼容所有现有业务逻辑，无副作用。

---
