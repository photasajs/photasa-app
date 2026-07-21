# RFC 0034: Linglong Vision Engine

- **Start Date**: 2025-05-24
- **RFC PR**:
- **Implementation Issue**:

## Summary

设计名为「玲珑」的统一影像播放引擎，解决浏览器原生能力无法完整支持 MPG/AVI/3GP 等视频与 BMP/SVG/ICN 等图像格式的问题。引擎保持环境无关，提供标准化的解码、转封装与渲染管线，由外层服务将其接入 Electron 主进程与渲染层，实现多格式一致播放体验。

## Motivation

### 现状痛点

- **浏览器限制**：Chromium 原生 `<video>/<img>` 仅支持少量编解码器，导致部分媒体无法直接呈现。
- **方案分散**：当前处理逻辑散落在多个模块（FFmpeg 任务、临时转码脚本、渲染端兜底），维护成本高。
- **用户体验**：不支持格式需要跳出应用或提示错误，影响图库/时间线浏览的一致性。
- **扩展难度**：新增格式要修改多层代码，缺乏统一的能力抽象和可观测性。

### 目标收益

1. **统一架构**：图像与视频采用同一条引擎管线（探测 → 解码/转封装 → 缓存 → 渲染输出）。
2. **可扩展性**：新增格式仅需实现解码适配器或转换策略，不破坏服务层。
3. **性能策略**：支持离线缓存、懒加载首帧、渐进式播放等优化。
4. **文化命名**：沿用中国神话意象，「玲珑」象征精巧通透的万镜之心。

## Detailed Design

### 命名约定

- **引擎名称**：Linglong Vision Engine（玲珑影像引擎）。
- **主职责**：把任意输入媒体映射到渲染层可展示的标准输出（纹理、位图、MP4/HLS 流）。
- **消费者**：`PlaybackService`（主进程）负责 IPC 与 UI 交互，`MaLiang` 引擎可复用图片解析能力。

### 功能需求

| 类别     | 需求                                | 描述                           |
| -------- | ----------------------------------- | ------------------------------ |
| 格式覆盖 | 视频：MPG/MPEG、AVI、3GP、MKV、MOV  | 保持 1080p 播放，至少 30fps    |
|          | 图像：BMP、ICO/ICN、SVG、TIFF、HEIF | 提供缩略图 + 原图渲染          |
| 解码策略 | 本地离线                            | 无需在线 API                   |
|          | 可扩展                              | 支持第三方插件解码             |
| 性能     | 首帧 < 1s（缓存命中）               | 首次转码可容忍更长但需进度提示 |
|          | 回放平滑                            | 播放时 CPU < 60%，支持拖动     |
| 缓存     | 统一缓存目录                        | 复用 `.photasa` 体系           |
| 可观测性 | 详细日志/指标                       | 格式识别、转码耗时、失败率     |

### 设计备选方案比较

| 方案                                                | 描述                                                                                     | 优点                                                             | 缺点                                                                     | 维护成本 | 推荐程度           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | -------- | ------------------ |
| **A. 主进程 FFmpeg 转封装/转码**                    | 使用 FFmpeg（本地命令或 Node 绑定）将不支持格式转为 H.264/MP4（视频）或 PNG/WebP（图像） | 成熟稳定；与现有 FFmpeg 配置一致；可批量与离线任务结合；易于缓存 | 首次转码耗时；CPU/GPU 消耗较高；需管理输出缓存与清理；实时播放时首帧延迟 | 中       | ⭐️⭐️⭐️⭐️（推荐）   |
| **B. 内嵌媒体引擎 libmpv/libVLC**                   | 作为子进程/原生扩展接入 libmpv 或 libVLC，直接渲染到纹理                                 | 全格式支持；播放质量高；自带字幕/滤镜                            | 与 Electron 渲染层集成复杂；原生依赖大；UI 层需处理纹理同步              | 高       | ⭐️⭐️⭐️（中期考量） |
| **C. 渲染层 wasm 解码 (ffmpeg.wasm)**               | 在渲染进程使用 wasm 版 FFmpeg 解码后通过 canvas/WebGL 播放                               | 不依赖主进程；易于跨平台                                         | CPU/内存消耗巨大；大文件体验差；包体积爆炸                               | 高       | ⭐️⭐️（不推荐）     |
| **D. 系统原生解码 (AVFoundation/Media Foundation)** | 针对 macOS/Windows 编写原生模块调用系统播放器                                            | 原生硬解码，流畅度最佳                                           | 跨平台重复实现；Linux 缺乏统一接口；测试复杂                             | 高       | ⭐️⭐️⭐️（长期探索） |
| **E. 云端转码服务**                                 | 上传服务器转换后回传                                                                     | 后端统一管理；轻端负载低                                         | 需联网；隐私/时延问题；增加服务器成本                                    | 中       | ⭐️⭐️（备选）       |

**结论**：短期采用方案 A，作为玲珑引擎的初代后端；并抽象执行适配层，保留未来接入方案 B/D 的能力。

### 架构概览

```
┌───────────────────────────────────────┐
│             Linglong Engine           │
│  (格式探测 + 策略决策 + 执行适配 + 缓存)  │
├───────────────────────────────────────┤
│ 1. Format Detector   │ BMP/AVI/MPEG/SVG/…
│ 2. Strategy Planner  │ 转封装 / 转码 / 原生通路
│ 3. Execution Adapter │ FFmpeg Adapter, libmpv Adapter (预留)
│ 4. Cache Manager     │ 首帧缓存、媒体片段、缩略图
│ 5. Status Bus        │ 解码日志、进度、指标、警报
└───────────────────────────────────────┘
         ▲                    │
         │                    ▼
┌───────────────────────────────────────┐
│        PlaybackService (主进程)        │
│  - 注入 Linglong 引擎实例              │
│  - 统一 IPC：`picasa:play-media` 等     │
│  - 将引擎事件转为 notifyStatus/UI 更新 │
└───────────────────────────────────────┘
         ▲                    │
         │                    ▼
┌───────────────────────────────────────┐
│         Renderer (前端组件)          │
│  - 媒体查看器/时间线/幻灯片播放器    │
│  - 通过 preload API 请求播放         │
│  - 处理进度提示/错误提醒             │
└───────────────────────────────────────┘
```

### 模块分解

1. **Format Detector**：利用扩展名、魔数、FFprobe 探测器识别格式与编解码器。
2. **Strategy Planner**：根据支持矩阵决定路径：
    - 原生支持 → 直接播放（返回文件 URL）。
    - 需转封装 → 调用 FFmpeg Adapter `copy codec` 输出 `mp4`。
    - 需转码 → 调用 FFmpeg Adapter 生成 `h264/aac` `mp4` 或 `png`。
    - 图像矢量（SVG） → 调用 resvg/Sharp 转栅格。
3. **Execution Adapter**：
    - `FFmpegAdapter`：封装命令/节点绑定，提供进度回调、错误处理。
    - `SharpAdapter`：处理位图/矢量转栅格。
    - 预留 `mpvAdapter`、`NativeAdapter` 接口以便未来扩展。
4. **Cache Manager**：
    - 保存转封装结果（`cache/media/mp4`）。
    - 保存缩略图/首帧（`cache/thumbnails`）。
    - 维护 LRU 和引用计数。
5. **Status Bus**：
    - 事件类型：`detect:start`、`decode:progress`、`decode:complete`、`error` 等。
    - 提供给 PlaybackService / 监控仪表盘。

### API 草案

```ts
interface PlaybackCommand {
    id: string;
    sourcePath: string;
    mediaType: "video" | "image";
    preferredOutput?: "mp4" | "hls" | "png" | "webp" | "texture";
    priority: "user" | "background";
    requestedAt: number;
    hints?: {
        seekPosition?: number;
        thumbnailSize?: number;
    };
}

interface PlaybackResult {
    commandId: string;
    status: "ready" | "processing" | "failed";
    outputPath?: string; // mp4/png 等
    metadata?: MediaMetadata;
    error?: PlaybackError;
}

interface PlaybackEngine {
    initialize(): Promise<void>;
    plan(command: PlaybackCommand): Promise<void>;
    cancel(commandId: string): Promise<void>;
    onStatus(listener: (event: PlaybackEvent) => void): () => void;
    shutdown(): Promise<void>;
}
```

### 与其他引擎的协作

- **MaLiang 引擎**：解码后的图像可交由 MaLiang 进行编辑；两者共享缓存目录并复用 `FormatDetector`。
- **千里眼/顺风耳**：当文件被扫描/监视到时，可提前触发玲珑的首帧/缩略图预热。
- **PlaybackService**：作为服务层壳，负责 IPC、生命周期管理、日志、故障通知。

### 实施计划

1. **阶段 0**：建立引擎骨架、缓存策略和事件总线，选定 FFmpeg adapter。
2. **阶段 1**：实现必需格式支持（MPG/AVI/3GP/BMP/SVG/ICN），完成主进程转封装→渲染层播放流程。
3. **阶段 2**：添加性能优化（多线程队列、首帧缓存、断点续播元数据）。
4. **阶段 3**：评估接入 libmpv 或系统原生解码路径，作为可配置后端。

### 成功度量

- 不支持格式的媒体在导入后 5 秒内可播放/预览。
- 严重错误率 < 1%；所有失败都有详细日志与用户提示。
- 首帧缓存命中率 > 70%，平均首帧延迟 < 1s。
- 新增格式适配耗时 <= 2 个工作日（包括单测）。

## Drawbacks

- 首次转码的性能与磁盘占用压力较大，需要配套的缓存清理策略。
- FFmpeg 在 GPL/LGPL 许可下使用需注意动态链接与依赖发布事项。
- 引擎抽象增加了学习成本；需要完备的观察与调试工具链。

## Alternatives

1. **继续零散处理**：在各模块内临时转码或提示不支持，放弃统一引擎。→ 维护困难，严重影响体验。
2. **纯 wasm 解码**：全部放到渲染层完成。→ 性能不足，无法覆盖大文件长视频。
3. **完全原生播放器嵌入**：如直接使用 VLC UI。→ UI 一致性差，与现有 Electron 框架不契合。

## Unresolved Questions

- 缓存配额与清理策略如何与现有 `.photasa` 缓存体系协同？
- 是否需要提供实时流媒体（RTSP/RTMP）支持，作为扩展目标？
- 播放过程中如需动态滤镜/特效，是否交由 MaLiang 进一步处理？
- FFmpeg 的打包与 License（LGPL/GPL）如何在发布版本中合规？
