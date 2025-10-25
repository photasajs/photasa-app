# 神话大唐架构 - Mythology Architecture

> **Picasa Vue 照片管理应用的中国古代神话主题架构设计**

本文档详细说明了项目中所有基于中国古代神话和历史人物的架构组件及其职责。

---

## 📚 目录

- [神话大唐架构 - Mythology Architecture](#神话大唐架构---mythology-architecture)
  - [📚 目录](#-目录)
  - [架构概览](#架构概览)
    - [三界分层](#三界分层)
  - [天界 (Main进程)](#天界-main进程)
    - [天枢 - Tianshu](#天枢---tianshu)
    - [太乙 - Taiyi](#太乙---taiyi)
    - [千里眼 - Qianliyan](#千里眼---qianliyan)
    - [顺风耳 - Shunfenger](#顺风耳---shunfenger)
    - [司命 - Siming](#司命---siming)
    - [司簿 - Sibu](#司簿---sibu)
    - [文昌 - Wenchang](#文昌---wenchang)
    - [马良 - MaLiang](#马良---maliang)
    - [玲珑 - Linglong](#玲珑---linglong)
  - [人界 (Renderer进程)](#人界-renderer进程)
    - [李世民 - LiShiming](#李世民---lishiming)
    - [房玄龄 - FangXuanLing](#房玄龄---fangxuanling)
    - [褚遂良 - ChuSuiLiang](#褚遂良---chusuiliang)
    - [尉迟恭 - YuChiGong](#尉迟恭---yuchigong)
    - [袁天罡 - YuanTianGang](#袁天罡---yuantiangang)
    - [玄奘 - Xuanzang](#玄奘---xuanzang)
    - [杜如晦 - DuRuHui](#杜如晦---duruhui)
  - [通信系统](#通信系统)
    - [奏折系统 - Zouzhe](#奏折系统---zouzhe)
    - [诏令系统 - Zhaoling](#诏令系统---zhaoling)
    - [符箓系统 - Fulu](#符箓系统---fulu)
    - [圣旨/启奏 - Shengzhi/Qizou](#圣旨启奏---shengzhiqizou)
  - [日志风格规范](#日志风格规范)
    - [天界风格（Main进程）](#天界风格main进程)
    - [人界风格（Renderer进程）](#人界风格renderer进程)
  - [快速参考表](#快速参考表)
    - [引擎对比表](#引擎对比表)
    - [人界服务对比表](#人界服务对比表)
  - [参考文档](#参考文档)

---

## 架构概览

### 三界分层

```
┌─────────────────────────────────────────────────────────┐
│                    【世界 World】                        │
│                   Electron 应用宇宙                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │              【天界 Celestial Realm】           │    │
│  │                Main 进程 - 核心业务              │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │  天枢、太乙、千里眼、顺风耳、司命🚧    │  │    │
│  │  │  司簿、文昌、马良、玲珑🚧              │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │              【人界 Human Realm】               │    │
│  │              Renderer 进程 - UI 层               │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │  李世民、房玄龄、褚遂良、尉迟恭、袁天罡 │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 天界 (Main进程)

天界负责核心业务逻辑、数据持久化、引擎调度等底层功能。

### 天枢 - Tianshu

**神话背景**: 北斗七星第一星，掌管天地秩序

**英文名**: Tianshu Engine
**位置**: `src/engines/tianshu/`
**托管**: `src/main/deity/tianshu-service.ts`
**级别**: 独立引擎（工作流编排引擎）

**职责**:
- 📋 工作流编排 - 执行 YAML 工作流定义
- 🎯 用户意图解析 - 将用户意图转换为工作流
- 🔄 引擎协调 - 通过太乙调度各专业引擎
- 📊 进度汇总 - 收集并汇报工作流执行状态

**核心能力**:
```typescript
// 工作流执行
processCommand(uiCommand: UICommand): Promise<WorkflowResult>
selectWorkflow(intent: UserIntent): WorkflowDefinition
executeWorkflow(workflow: WorkflowDefinition): Promise<void>
```

**持久化**: 不涉及持久化

**日志风格**: 天界风格
```typescript
logger.info("🌟 天枢星君编排工作流: scan/folder_scan")
logger.info("🌟 星君调度: 千里眼仙君执行扫描")
```

---

### 太乙 - Taiyi

**神话背景**: 太乙真人，道教神仙，掌管万物调度

**英文名**: Taiyi Adapter Registry
**位置**: `src/engines/taiyi/`
**级别**: 引擎适配器注册中心（不是独立引擎）

**职责**:
- 🔌 适配器注册 - 管理 `@Adapter` 装饰器注册系统
- 📞 引擎调度 - 代理天枢对各引擎的调用
- 🔗 接口适配 - 标准化引擎调用接口

**核心能力**:
```typescript
// 引擎调度
callEngine<T>(engineName: string, methodName: string, ...args: any[]): Promise<T>

// 适配器注册
@Adapter("engineName")
class EngineAdapter { ... }
```

**持久化**: 不涉及持久化

**日志风格**: 天界风格
```typescript
logger.info("🌌 太乙真人开坛，万仙归位")
logger.info("🌌 召唤仙家: qianliyan仙君施展scan之术")
logger.info("🌌 仙术成功")
```

---

### 千里眼 - Qianliyan

**神话背景**: 千里眼，能看千里之外的神仙

**英文名**: Qianliyan Engine
**位置**: `src/engines/qianliyan/`
**级别**: 独立引擎

**职责**:
- 🔍 扫描执行 - 遍历文件系统，识别照片/视频
- 📝 扫描队列管理 - 管理扫描任务队列
- 💾 队列持久化 - 保存/恢复扫描队列到 `scanning.json`
- 📊 进度报告 - 实时报告扫描进度

**核心能力**:
```typescript
// 扫描执行
executeScan(path: string, mode: "full" | "quick"): Promise<ScanResult>

// 队列管理
persistQueue(queue: string[]): Promise<void>
restoreQueue(): Promise<string[]>
clearQueue(): Promise<void>

// 进度报告
reportProgress(progress: ScanProgress): void
reportResult(result: ScanResult): void
```

**持久化**: `~/.photasa/scan/scanning.json`

**日志风格**: 天界风格
```typescript
logger.info("🌌 千里眼仙君施展persist_queue之术 (5个任务)")
logger.info("🌌 仙术成功：队列已封存于 ~/.photasa/scan/scanning.json")
logger.error("🌌 仙术失败：持久化队列异常", error)
```

---

### 顺风耳 - Shunfenger

**神话背景**: 顺风耳，千里眼的好友，拥有超凡的听力，能够听到千里之外的细微声响

**英文名**: Shunfenger Engine
**位置**: `src/engines/shunfenger/`
**级别**: 独立引擎

**职责**:
- 👂 文件系统监听 - 监听文件夹的创建、修改、删除事件
- 📋 监听配置管理 - 管理多个监听 Profile
- 🔄 事件归一化 - 将 chokidar 事件转换为标准 FileObservation
- ⚡ 事件缓冲 - 高效的事件去重、批处理和动态节流
- 📡 命令生成 - 将文件变化事件转换为扫描命令发送给千里眼

**核心能力**:
```typescript
// 引擎生命周期
initialize(): Promise<void>
shutdown(): Promise<void>

// Profile 管理
configure(profile: WatchProfile): Promise<void>
removeProfile(profileId: string): Promise<void>
listProfiles(): WatchProfile[]

// 监听控制
pause(profileId?: string): Promise<void>
resume(profileId?: string): Promise<void>
flush(): Promise<void>

// 事件订阅
onEvent(listener: EngineEventListener): () => void
setCommandDispatcher(dispatcher: CommandDispatcher): void
```

**持久化**: `~/.photasa/watch/profiles.json`

**WatchProfile 结构**:
```typescript
interface WatchProfile {
    id: string;                    // Profile ID
    rootPath: string;              // 监听根路径
    recursive: boolean;            // 是否递归监听
    ignoreGlobs: string[];         // 忽略规则
    thumbnailSize: number;         // 缩略图大小
    autoStart: boolean;            // 自动启动
    priority: "user" | "background"; // 优先级
}
```

**与千里眼的协作**:
- 顺风耳监听文件系统变化 → 生成 FileObservation
- 通过 CommandDispatcher 将 FileObservation 转换为 ScanCommand
- 发送命令给千里眼的 `planScan()` 或 `enqueueOperations()`
- 千里眼执行扫描任务，顺风耳继续监听新变化

**设计思想**:
> "千里眼负责观察（扫描），顺风耳负责聆听（监听）"
>
> 在神话中，千里眼与顺风耳是黄帝手下的两员大将，一个负责观察，一个负责聆听，共同守护天下。在架构中，千里眼主动扫描文件系统（观察），顺风耳被动监听文件变化（聆听），两者配合实现完整的文件发现机制。

**日志风格**: 天界风格
```typescript
logger.info("🌌 顺风耳仙君归位，掌管文件监听")
logger.info("🌌 顺风耳施展configure之术，监听路径: /Users/albert/Photos")
logger.info("🌌 顺风耳侦听到变化: 新增文件 IMG_001.jpg")
logger.info("🌌 顺风耳传令千里眼: 扫描命令已发送")
logger.error("🌌 顺风耳仙术失败：监听异常", error)
```

**参考文档**: [RFC 0033: Shunfenger Watch Engine](../rfc/0033-shunfenger-watch-engine.md)

---

### 司命 - Siming

**⚠️ 状态**: 🚧 规划中 - 设计已完成，代码实现待开发

**神话背景**: 司命，掌管生死簿的神祇，负责记录和管理

**英文名**: Siming Engine
**位置**: `src/engines/siming/` (计划)
**级别**: 独立引擎

**职责**:
- 📦 通用 appState 持久化 - 管理应用级运行时状态
- 💾 状态恢复 - 应用启动时恢复状态
- 🔧 状态管理 - 增删改查应用状态

**核心能力**:
```typescript
// appState 持久化
persistAppState(key: string, value: unknown): Promise<void>
restoreAppState<T>(key: string): Promise<T | null>
clearAppState(key: string): Promise<void>
listAppStateKeys(): Promise<string[]>
```

**持久化**: `~/.photasa/appState/{key}.json`

**使用示例**:
```typescript
// 保存窗口位置
await siming.persistAppState("windowPosition", { x: 100, y: 200 })

// 保存最近打开的文件夹
await siming.persistAppState("lastOpenedFolder", "/Users/albert/Photos")

// 保存UI面板折叠状态
await siming.persistAppState("collapsedPanels", ["sidebar", "toolbar"])
```

**日志风格**: 天界风格
```typescript
logger.info("🌌 司命仙君施展persist_state之术，windowPosition状态已封存")
logger.info("🌌 司命仙君施展restore_state之术，lastOpenedFolder状态已恢复")
```

---

### 司簿 - Sibu

**神话背景**: 司簿，掌管文书档案的官职

**英文名**: Sibu Engine
**位置**: `src/engines/sibu/`
**级别**: 独立引擎

**职责**:
- 📄 照片文件夹 manifest 管理 - 每个照片文件夹的 `.photasa.json`
- 📊 扫描元信息管理 - lastFullScanAt, 变更计数, TTL
- 📋 照片清单管理 - 文件夹内照片列表

**核心能力**:
```typescript
// Manifest 管理
getManifest(folderPath: string): Promise<FolderManifest | null>
writeManifest(folderPath: string, manifest: FolderManifest): Promise<void>
updateManifest(folderPath: string, updates: Partial<FolderManifest>): Promise<void>
```

**持久化**: 每个照片文件夹内的 `.photasa.json`
```
/Users/albert/Photos/.photasa.json
/Users/albert/Documents/Family Photos/.photasa.json
/Volumes/ExternalDrive/Vacation2024/.photasa.json
```

**Manifest 结构示例**:
```json
{
  "lastFullScanAt": "2025-10-19T10:30:00Z",
  "photos": ["IMG_001.jpg", "IMG_002.jpg", "beach.jpg"],
  "changeCount": 0,
  "scanStrategy": "smart",
  "ttl": 86400,
  "version": "1.0"
}
```

**日志风格**: 天界风格
```typescript
logger.info("🌌 司簿仙君施展read_manifest之术")
logger.info("🌌 仙术成功：manifest已读取")
```

---

### 文昌 - Wenchang

**神话背景**: 文昌帝君，掌管文章和学问的神祇

**英文名**: Wenchang Engine
**位置**: `src/engines/wenchang/`
**级别**: 独立引擎

**职责**:
- ⚙️ 用户偏好管理 - 主题、语言、UI设置
- 🔄 偏好同步 - 天界持久化，人界镜像
- 📡 变更推送 - 推送偏好更新到 UI

**核心能力**:
```typescript
// 偏好管理
getPreferences(): Promise<UnifiedPreferences>
setPreferences(preferences: UnifiedPreferences): Promise<void>
updatePreference(key: string, value: unknown): Promise<void>
```

**持久化**: `~/.photasa/preferences/`

**日志风格**: 天界风格
```typescript
logger.info("🌌 文昌星君施展update_preference之术")
logger.info("🌌 仙术成功：偏好已更新")
```

---

### 马良 - MaLiang

**神话背景**: 马良神笔，能画出真实物体的神笔

**英文名**: MaLiang Engine
**位置**: `src/engines/maliang/`
**级别**: 独立引擎（已实现）

**职责**:
- 🖼️ 图像处理 - 格式转换、缩略图生成
- 🎨 图像编辑 - 裁剪、旋转、滤镜
- 📐 格式支持 - HEIC/JPEG/PNG/WebP/TIFF/GIF/AVIF

**核心能力**:
```typescript
// 神笔架构（Brush Pattern）
extractEssence(imagePath: string): Promise<ImageData>      // 提取图像精华
createMiniature(imagePath: string): Promise<Thumbnail>     // 创建缩略图
transform(imagePath: string, options: TransformOptions): Promise<ImageData>
edit(imagePath: string, edits: EditOptions): Promise<ImageData>
```

**持久化**: 不涉及持久化（处理图像，不存储状态）

**日志风格**: 天界风格
```typescript
logger.info("🌌 马良神笔施展create_miniature之术")
logger.info("🌌 神笔妙手：缩略图绘制完成")
```

---

### 玲珑 - Linglong

**⚠️ 状态**: 🚧 规划中 - RFC 0034 设计已完成，代码实现待开发

**神话背景**: 玲珑，象征精巧通透的万镜之心，能够映照万物真形

**英文名**: Linglong Vision Engine
**位置**: `src/engines/linglong/` (计划)
**级别**: 独立引擎（影像播放引擎）

**职责**:
- 🎬 多格式视频播放 - 支持 MPG/MPEG/AVI/3GP/MKV/MOV 等格式
- 🖼️ 多格式图像渲染 - 支持 BMP/ICO/ICN/SVG/TIFF/HEIF 等格式
- 🔄 格式转换 - FFmpeg 转封装/转码为浏览器兼容格式
- 💾 播放缓存 - 首帧缓存、媒体片段缓存
- 📊 解码策略 - 本地离线解码，支持硬件加速

**核心能力**:
```typescript
// 格式探测
detectFormat(mediaPath: string): Promise<MediaFormat>

// 播放准备
preparePlayback(mediaPath: string, options: PlaybackOptions): Promise<PlayableMedia>

// 转码处理
transcode(input: string, output: string, codec: CodecOptions): Promise<void>

// 缓存管理
getCachedMedia(mediaPath: string): Promise<CachedMedia | null>
clearCache(olderThan?: Date): Promise<void>

// 状态监听
onProgress(listener: (progress: TranscodeProgress) => void): () => void
```

**持久化**: `~/.photasa/cache/linglong/` (媒体缓存)

**架构设计**:
```
┌───────────────────────────────────────┐
│         Linglong Vision Engine         │
├───────────────────────────────────────┤
│ 1. Format Detector   │ 格式探测        │
│ 2. Strategy Planner  │ 策略决策        │
│ 3. FFmpeg Adapter    │ FFmpeg执行适配   │
│ 4. Cache Manager     │ 缓存管理        │
│ 5. Status Bus        │ 进度/日志输出    │
└───────────────────────────────────────┘
```

**支持格式**:
- **视频**: MPG/MPEG, AVI, 3GP, MKV, MOV, FLV, WMV
- **图像**: BMP, ICO/ICN, SVG, TIFF, HEIF/HEIC
- **目标格式**: H.264/MP4 (视频), PNG/WebP (图像)

**与马良的协作**:
- 马良负责静态图像处理（缩略图、格式转换、编辑）
- 玲珑负责动态媒体播放（视频解码、流式播放）
- 图像格式：优先使用马良（更快），马良不支持时使用玲珑
- 视频格式：全部使用玲珑引擎处理

**设计思想**:
> "玲珑剔透，映照万物"
>
> 玲珑象征精巧的多面镜，能够映照不同形态的影像。就像玲珑塔能容纳万千变化，玲珑引擎能够解码和播放各种格式的媒体文件，为用户呈现完整的影像世界。

**日志风格**: 天界风格
```typescript
logger.info("🌌 玲珑仙君归位，掌管影像播放")
logger.info("🌌 玲珑施展detect_format之术，探测格式: AVI")
logger.info("🌌 玲珑施展transcode之术，转码至H.264")
logger.info("🌌 玲珑仙术成功：媒体已就绪，可供播放")
logger.error("🌌 玲珑仙术失败：解码异常", error)
```

**参考文档**: [RFC 0034: Linglong Vision Engine](../rfc/0034-linglong-vision-engine.md)

---

## 人界 (Renderer进程)

人界负责用户界面、用户交互、业务逻辑协调。

### 李世民 - LiShiming

**历史背景**: 唐太宗李世民，贞观之治的缔造者，英明君主

**英文名**: LiShiming Service
**位置**: `src/renderer/src/services/lishiming/`
**级别**: 主路由服务

**职责**:
- 👑 应用启动协调 - 贞观之治启动流程
- 📋 服务初始化 - 雇佣各部门官员
- 🔀 圣旨分发 - 根据事务类型路由到对应官员
- 📢 启奏汇总 - 接收各部门汇报

**核心能力**:
```typescript
// 启动贞观之治
async startZhengguan(): Promise<void>

// 雇佣官员
employ(): void

// 处理启奏
handleQizou(qizou: Qizou): void

// 发布圣旨
issueShengzhi(command: string, content: unknown): void
```

**日志风格**: 人界风格（唐代官府）
```typescript
logger.info("👑 开始启动大唐贞观之治")
logger.info("👑 褚遂良中书令服务初始化偏好设置")
logger.info("👑 尉迟恭大将军服务初始化扫描队列")
```

---

### 房玄龄 - FangXuanLing

**历史背景**: 房玄龄，唐朝名相，贞观之治的主要设计师

**英文名**: FangXuanLing Service
**位置**: `src/renderer/src/services/fangxuanling/`
**级别**: 宰相级服务（Store 管理器）

**职责**:
- 📚 Store 管理 - 统一管理所有 Pinia Store
- 📝 奏折处理 - 接收各部门奏折，批复执行
- 🔗 Store 访问器 - 提供只读访问接口（Accessor Pattern）
- 📡 诏令发送 - 向袁天罡发送诏令，上报天界

**核心能力**:
```typescript
// 奏折处理
async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse>

// Store 访问（只读）
get preference: IPreferenceAccessor
get scanning: IScanningAccessor
get notification: INotificationAccessor

// 诏令发送
async sendZhaoling(zhaoling: Zhaoling): Promise<void>
```

**Store 访问示例**:
```typescript
// ✅ 正确：只读访问
const theme = fangXuanLing.preference.currentTheme
const queueSize = fangXuanLing.scanning.queueSize

// ❌ 错误：直接修改（编译时错误）
fangXuanLing.scanning.addToQueue(action)  // 不存在此方法！

// ✅ 正确：通过奏折修改
const zouzhe: Zouzhe = {
    department: "YuChiGong",
    matter: "UPDATE_SCANNING_QUEUE",
    content: { queue: [...] },
    timestamp: Date.now(),
    priority: "normal"
}
await fangXuanLing.processZouzhe(zouzhe)
```

**日志风格**: 人界风格
```typescript
logger.info("🏛️ 房相接到奏折: UPDATE_SCANNING_QUEUE")
logger.info("🏛️ 房相批复: 准奏，更新扫描队列")
logger.info("🏛️ 房相上报天界: 诏令已发")
```

---

### 褚遂良 - ChuSuiLiang

**历史背景**: 褚遂良，唐代书法家、中书令，负责文书管理

**英文名**: ChuSuiLiang Service
**位置**: `src/renderer/src/services/chusuiliang/`
**级别**: 业务服务（偏好设置 UI 门面）

**职责**:
- ⚙️ 偏好设置 UI 门面 - 用户偏好设置界面逻辑
- 📝 偏好变更奏折 - 向房玄龄呈递偏好变更文书
- 🔄 初始化偏好 - 应用启动时恢复偏好设置

**核心能力**:
```typescript
// 初始化
async initializePreferences(): Promise<void>

// 更新主题
async updateTheme(themeId: string): Promise<void>

// 更新语言
async updateLanguage(language: string): Promise<void>

// 更新缩略图大小
async updateThumbnailSize(size: number): Promise<void>
```

**日志风格**: 人界风格
```typescript
logger.info("📚 褚遂良呈文房玄龄，请求典籍中偏好设置")
logger.info("📚 偏好设置典籍翻阅完成")
logger.info("📚 褚遂良草拟主题变更文书")
```

---

### 尉迟恭 - YuChiGong

**历史背景**: 尉迟恭，唐朝名将，勇猛善战

**英文名**: YuChiGong Service
**位置**: `src/renderer/src/services/yuchigong/`
**级别**: 业务服务（扫描队列管理）

**职责**:
- 🛡️ 扫描队列 UI 状态管理 - 管理扫描任务队列
- 📜 接收李世民圣旨 - add_scan_task / remove_scan_task
- 📝 发送奏折 - 向房玄龄呈递扫描奏折
- 📊 启奏汇报 - 向李世民启奏任务结果

**核心能力**:
```typescript
// 初始化
async initializeScanningQueue(): Promise<void>

// 接收圣旨
setShengzhiPort(port: MessagePort): void

// 发送启奏
setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void

// 队列查询
getScanningTasks(): string[]
getQueueSize(): number
isScanning(path: string): boolean
```

**日志风格**: 人界风格
```typescript
logger.info("🛡️ 尉迟恭就任，负责扫描队列UI状态管理")
logger.info("🛡️ 尉迟恭奉旨: add_scan_task")
logger.info("🛡️ 尉迟恭向房玄龄呈递扫描奏折")
logger.info("🛡️ 尉迟恭启奏: scan_task_started")
```

---

### 袁天罡 - YuanTianGang

**历史背景**: 袁天罡，唐代风水大师、天文学家，能沟通天地

**英文名**: YuanTianGang Service
**位置**: `src/renderer/src/services/yuantiangang/`
**级别**: 通信桥梁服务

**职责**:
- 🌉 人界天界通信桥梁 - 连接 Renderer 和 Main
- 📜 诏令转换 - 诏令 → 符箓 → UICommand
- 📡 IPC 调用 - 通过 `window.tianshu.processCommand()` 调用天界
- 🔄 响应转换 - 天界响应 → 符箓响应 → 诏令响应

**核心能力**:
```typescript
// 执行诏令
async executeZhaoling(zhaoling: Zhaoling): Promise<ZhaolingResponse>

// 内部转换流程
private convertZhaolingToFulu(zhaoling: Zhaoling): Fulu
private sendFuluToTianshu(fulu: Fulu): Promise<FuluResponse>
private convertFuluToUICommand(fulu: Fulu): UICommand
private reboxAsZhaolingResponse(zhaoling: Zhaoling, fuluResponse: FuluResponse): ZhaolingResponse
```

**通信流程**:
```
房玄龄发诏令 → 袁天罡转换为符箓 → 符箓转换为UICommand →
window.tianshu.processCommand() → 天枢执行 →
响应返回 → 袁天罡转换回诏令响应 → 房玄龄接收
```

**日志风格**: 人界风格
```typescript
logger.info("🔮 袁天罡接到诏令: update_scanning_queue")
logger.info("🔮 袁天罡转换符箓，传达天界")
logger.info("🔮 袁天罡收到天界回应")
```

---

### 玄奘 - Xuanzang

**历史背景**: 玄奘法师，西天取经，精通多国语言

**英文名**: Xuanzang Service
**位置**: `src/renderer/src/services/xuanzang/`
**级别**: 业务服务（国际化/本地化）

**职责**:
- 🌍 国际化管理 - 多语言支持
- 🔄 语言切换 - 动态切换应用语言
- 📚 翻译管理 - 管理翻译资源

**核心能力**:
```typescript
// 初始化
async initializeLocalization(): Promise<void>

// 切换语言
async switchLanguage(language: string): Promise<void>

// 获取翻译
translate(key: string, params?: Record<string, unknown>): string
```

**日志风格**: 人界风格
```typescript
logger.info("🙏 玄奘法师初始化语言设置")
logger.info("🙏 玄奘法师切换语言: zh-CN")
```

---

### 杜如晦 - DuRuHui

**历史背景**: 杜如晦，唐朝名相，与房玄龄并称"房谋杜断"，精于决断

**英文名**: DuRuHui Service
**位置**: `src/renderer/src/services/duruhui/`
**级别**: 通信管理服务（MessageChannel 管理器）

**职责**:
- 📋 圣旨通道管理 - 为每个服务创建专属 MessageChannel
- 📡 通道维护 - 持有所有通道的 port1 端（李世民端）
- 🔗 端口分发 - 将 port2 端交给各服务（setShengzhiPort）
- 📤 圣旨下发 - 提供统一的下旨接口（issueShengzhi）

**核心能力**:
```typescript
// 连接服务，建立圣旨通道
connect(service: IService): void

// 下发圣旨
issueShengzhi(serviceName: string, shengzhi: Shengzhi): void

// 获取已注册服务
getRegisteredServices(): string[]

// 断开连接
disconnect(serviceName: string): void

// 清理所有通道
cleanup(): void
```

**设计原则**:
- ❌ **不负责**监听启奏事件（mitt.on('qizou')） - 这是李世民的职责
- ❌ **不负责**路由决策 - 这是李世民的职责
- ❌ **不负责**监听服务回复（port.onmessage） - 服务通过 qizou 启奏汇报
- ✅ **只负责**MessageChannel 的创建、维护和圣旨下发

**通道架构**:
```
李世民 ←→ 杜如晦中书侍郎 ←→ 各官员服务
        (持有port1)      (接收port2)
            ↓
        圣旨下发
            ↓
    尉迟恭、褚遂良等服务
```

**日志风格**: 人界风格
```typescript
logger.info("📋 杜如晦中书侍郎就职，负责圣旨通道管理")
logger.info("📋 杜如晦：为尉迟恭大将军建立圣旨通道")
logger.info("📋 杜如晦传旨: add_scan_task → 尉迟恭")
logger.info("📋 杜如晦：已注册服务列表", registeredServices)
```

**历史注解**: 杜如晦与房玄龄并称"房谋杜断"，房玄龄善于谋划（Store 管理），杜如晦善于决断（MessageChannel 管理），二人配合默契，成就贞观之治。在架构中，房玄龄负责 Store 和奏折处理，杜如晦负责 MessageChannel 通道管理，体现了职责分离的设计理念。

**参考文档**: [RFC 0038 Phase 7 - qizou-shengzhi架构](../rfc/completed/0038-preference-workflow-integration.md)

---

## 通信系统

### 奏折系统 - Zouzhe

**用途**: 人界各部门向房玄龄宰相汇报

**数据结构**:
```typescript
interface Zouzhe {
    department: string;              // 部门名称（如 "YuChiGong"）
    matter: string;                  // 事务类型（如 "UPDATE_SCANNING_QUEUE"）
    content?: Record<string, unknown>; // 奏折内容
    timestamp: number;               // 上奏时间
    priority: "urgent" | "normal" | "low"; // 优先级
}
```

**示例**:
```typescript
const zouzhe: Zouzhe = {
    department: GUANYUAN_NAMES.YU_CHI_GONG,
    matter: ZOUZHE_MATTERS.UPDATE_SCANNING_QUEUE,
    content: { queue: ["/path1", "/path2"] },
    timestamp: Date.now(),
    priority: ZOUZHE_PRIORITIES.NORMAL
}

await fangXuanLing.processZouzhe(zouzhe)
```

---

### 诏令系统 - Zhaoling

**用途**: 房玄龄向袁天罡发送诏令，上报天界

**数据结构**:
```typescript
interface Zhaoling {
    command: string;                 // 命令（如 "update_scanning_queue"）
    context: Record<string, unknown>; // 上下文数据
    source: string;                  // 来源（如 "fangxuanling.scanning"）
    priority: "imperial" | "urgent" | "normal"; // 优先级
}
```

**示例**:
```typescript
const zhaoling: Zhaoling = {
    command: "update_scanning_queue",
    context: { queue: ["/path1", "/path2"] },
    source: "fangxuanling.scanning",
    priority: "normal"
}

await yuanTianGang.executeZhaoling(zhaoling)
```

---

### 符箓系统 - Fulu

**用途**: 袁天罡内部转换格式，用于天地通信

**数据结构**:
```typescript
interface Fulu {
    intent: string;                  // 意图（如 "update_scanning_queue"）
    context: Record<string, unknown>; // 上下文
    timestamp: number;               // 时间戳
    source: string;                  // 来源
    urgency: "critical" | "normal";  // 紧急度
}
```

---

### 圣旨/启奏 - Shengzhi/Qizou

**用途**: 李世民与各官员之间的通信

**Shengzhi（圣旨 - 李世民 → 官员）**:
```typescript
interface Shengzhi {
    id: string;                      // 圣旨ID
    command: string;                 // 命令（如 "add_scan_task"）
    content: Record<string, unknown>; // 圣旨内容
    timestamp: number;               // 下旨时间
    from: string;                    // 来源（"李世民"）
}
```

**Qizou（启奏 - 官员 → 李世民）**:
```typescript
interface Qizou {
    matter: string;                  // 事项（如 "scan_task_started"）
    content: Record<string, unknown>; // 启奏内容
    from: string;                    // 启奏人（如 "尉迟恭"）
    timestamp: number;               // 启奏时间
    metadata?: { type: "request" | "report" }; // 元数据
}
```

---

## 日志风格规范

### 天界风格（Main进程）

**适用范围**: `src/main/`、`src/engines/`

**核心原则**:
- 使用"仙君"、"仙术"、"施展XX之术"等仙侠术语
- 成功用"仙术成功"、失败用"仙术失败"
- 使用"封存"、"恢复"等天界词汇

**图标指引**:
- 🌌 - 引擎相关（太乙、千里眼、司命、司簿、文昌、马良）
- 🌟 - 天枢工作流
- 🔧 - 工作流操作
- ⚡ - 事件响应
- 📜 - 配置和初始化
- 🎯 - 性能和监控
- ⚠️ - 警告
- ❌ - 错误

**示例**:
```typescript
// ✅ 正确
logger.info("🌌 千里眼仙君施展persist_queue之术 (5个任务)")
logger.info("🌌 仙术成功：队列已封存于 ~/.photasa/scanning.json")
logger.error("🌌 仙术失败：持久化队列异常", error)

// ❌ 错误
logger.info("🌌 千里眼：持久化扫描队列")  // 缺少"仙君"、"施展XX之术"
logger.info("🌌 Qianliyan: Persisting queue")  // 使用英文
```

---

### 人界风格（Renderer进程）

**适用范围**: `src/renderer/`

**核心原则**:
- 使用"朝廷"、"官府"、"奏章"、"文书"等唐代官府术语
- 使用"呈文"、"草拟"、"批复"等公文词汇
- 使用"典籍"、"归档"、"翻阅"等文书管理词汇

**图标指引**:
- 👑 - 李世民相关（皇帝）
- 🏛️ - 房玄龄相关（宰相）
- 📚 - 褚遂良相关（中书令）
- 🛡️ - 尉迟恭相关（大将军）
- 🔮 - 袁天罡相关（天文学家）
- 🙏 - 玄奘相关（法师）
- 📝 - 用户操作
- 🎨 - UI渲染
- 🔔 - 通知提醒
- ⚠️ - 警告
- ❌ - 错误

**示例**:
```typescript
// ✅ 正确
logger.info("👑 开始启动大唐贞观之治")
logger.info("🏛️ 房相接到奏折: UPDATE_SCANNING_QUEUE")
logger.info("📚 褚遂良呈文房玄龄，请求典籍中偏好设置")
logger.info("🛡️ 尉迟恭向房玄龄呈递扫描奏折")

// ❌ 错误
logger.info("👑 Starting application")  // 使用英文
logger.info("🏛️ 房玄龄收到仙家回禀")  // 混用天界词汇"仙家"
```

---

## 快速参考表

### 引擎对比表

| 引擎 | 位置 | 级别 | 职责 | 持久化路径 | 状态 |
|------|------|------|------|-----------|------|
| **天枢<br>Tianshu** | `src/engines/tianshu/` | 独立引擎 | 工作流编排 | 不持久化 | ✅ 已实现 |
| **太乙<br>Taiyi** | `src/engines/taiyi/` | 适配器注册中心 | 引擎调度 | 不持久化 | ✅ 已实现 |
| **千里眼<br>Qianliyan** | `src/engines/qianliyan/` | 独立引擎 | 扫描执行<br>队列管理 | `~/.photasa/scan/scanning.json` | ✅ 已实现 |
| **顺风耳<br>Shunfenger** | `src/engines/shunfenger/` | 独立引擎 | 文件监听<br>事件归一化 | `~/.photasa/watch/profiles.json` | ✅ 已实现 |
| **司命<br>Siming** | `src/engines/siming/` (计划) | 独立引擎 | appState持久化 | `~/.photasa/appState/` | 🚧 规划中 |
| **司簿<br>Sibu** | `src/engines/sibu/` | 独立引擎 | Manifest管理 | `/path/to/photos/.photasa.json` | ✅ 已实现 |
| **文昌<br>Wenchang** | `src/engines/wenchang/` | 独立引擎 | 用户偏好管理 | `~/.photasa/preferences/` | ✅ 已实现 |
| **马良<br>MaLiang** | `src/engines/maliang/` | 独立引擎 | 图像处理 | 不持久化 | ✅ 已实现 |
| **玲珑<br>Linglong** | `src/engines/linglong/` (计划) | 独立引擎 | 多格式媒体播放<br>视频解码 | `~/.photasa/cache/linglong/` | 🚧 规划中 |

### 人界服务对比表

| 服务 | 位置 | 级别 | 职责 | 状态 |
|------|------|------|------|------|
| **李世民<br>LiShiming** | `src/renderer/src/services/lishiming/` | 主路由 | 应用启动<br>圣旨分发 | ✅ 已实现 |
| **房玄龄<br>FangXuanLing** | `src/renderer/src/services/fangxuanling/` | 宰相 | Store管理<br>奏折处理 | ✅ 已实现 |
| **褚遂良<br>ChuSuiLiang** | `src/renderer/src/services/chusuiliang/` | 业务服务 | 偏好设置UI | ✅ 已实现 |
| **尉迟恭<br>YuChiGong** | `src/renderer/src/services/yuchigong/` | 业务服务 | 扫描队列UI | ✅ 已实现 |
| **袁天罡<br>YuanTianGang** | `src/renderer/src/services/yuantiangang/` | 通信桥梁 | 人界天界通信 | ✅ 已实现 |
| **玄奘<br>Xuanzang** | `src/renderer/src/services/xuanzang/` | 业务服务 | 国际化 | ✅ 已实现 |
| **杜如晦<br>DuRuHui** | `src/renderer/src/services/duruhui/` | 通信管理 | MessageChannel管理<br>圣旨通道 | ✅ 已实现 |

---

## 参考文档

**已实现引擎**:
- [RFC 0032: 千里眼扫描引擎](../rfc/0032-qianliyan-scan-engine.md)
- [RFC 0033: 顺风耳监听引擎](../rfc/0033-shunfenger-watch-engine.md)
- [RFC 0031: 马良图像处理引擎](../rfc/completed/0031-maliang-image-processing-engine.md)
- [RFC 0036: 文昌偏好设置集成](../rfc/completed/0036-wenchang-preference-integration.md)
- [RFC 0037: 天枢工作流DSL](../rfc/0037-tianshu-yaml-workflow-dsl.md)

**规划中引擎**:
- [RFC 0034: 玲珑影像播放引擎](../rfc/0034-linglong-vision-engine.md) 🚧

**人界服务**:
- [RFC 0038: 偏好设置工作流集成](../rfc/completed/0038-preference-workflow-integration.md)
- [RFC 0042: scanningFolder迁移](../rfc/0042-scanning-folder-migration.md)
- [RFC 0043: useQinQiong访问模式](../rfc/0043-useqinqiong-access-pattern.md)

**架构模式**:
- [Accessor/Builder模式](./accessor-builder-pattern.md)
- [CLAUDE.md - 日志风格规范](../../CLAUDE.md)

---

**最后更新**: 2025-10-19
- ✅ 添加顺风耳（Shunfenger）引擎文档
- ✅ 添加杜如晦（DuRuhui）服务文档
- ✅ 添加玲珑（Linglong）引擎文档（标记为规划中）
- ✅ 标记司命（Siming）引擎为规划中
- ✅ 修正千里眼持久化路径
- ✅ 更新引擎和服务对比表，添加实现状态列

**维护者**: AI Architect

