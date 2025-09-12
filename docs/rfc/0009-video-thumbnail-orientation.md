# RFC 0009: 视频缩略图方向支持

## 状态
- 状态: 已实现
- 作者: Claude
- 创建日期: 2025-01-09
- 实现日期: 2025-01-09

## 概述

本RFC记录了对视频缩略图生成系统的改进，以正确处理视频的旋转元数据，确保生成的缩略图能够正确反映视频的实际方向（横屏或竖屏）。

## 背景

### 问题描述

在之前的实现中，视频缩略图生成没有考虑视频的旋转元数据，导致以下问题：

1. **竖屏视频问题**：手机竖屏拍摄的视频生成的缩略图显示为压扁的横屏格式
2. **方向不一致**：缩略图的方向与实际视频播放时的方向不一致
3. **用户体验差**：用户无法通过缩略图正确判断视频的实际内容

### 技术背景

现代移动设备拍摄的视频通常包含旋转元数据，而不是实际旋转视频帧。这种方式的优点是：
- 保持原始视频数据不变
- 减少处理开销
- 播放器根据元数据自动旋转显示

## 目标

1. **正确识别视频旋转信息**：从视频元数据中提取旋转角度
2. **自适应缩略图生成**：根据视频实际方向生成正确比例的缩略图
3. **兼容性**：支持新旧版本的ffmpeg/ffprobe
4. **性能**：不影响缩略图生成性能

## 技术方案

### 1. 视频旋转信息提取

视频旋转信息可能存储在不同位置，需要按优先级检查：

```typescript
function getVideoRotation(metadata: any): number {
    // 方法1: 从stream tags中获取（旧版ffmpeg）
    const rotateTag = stream?.tags?.rotate;
    
    // 方法2: 从side_data中获取（新版ffmpeg）
    const displayMatrix = sideData.find(
        data => data.side_data_type === "Display Matrix"
    );
    
    // 方法3: 从format tags中获取（某些容器格式）
    const formatRotate = metadata.format?.tags?.rotate;
}
```

### 2. 旋转角度处理

支持的旋转角度：
- 0°：正常横屏
- 90°：顺时针旋转90度（竖屏）
- 180°：倒置
- 270°：逆时针旋转90度（竖屏）

对于90°和270°旋转，需要交换视频的宽高：

```typescript
if (rotation === 90 || rotation === 270) {
    [width, height] = [height, width];
}
```

### 3. 缩略图尺寸计算

根据视频的实际方向计算最优缩略图尺寸：

```typescript
function getOptimalThumbnailResolution(
    videoDimension: VideoSize,
    targetSize: { width: number; height: number }
): VideoSize {
    if (videoDimension.width > videoDimension.height) {
        // 横屏视频
        return {
            width: targetSize.width,
            height: Math.round((targetSize.width * videoDimension.height) / videoDimension.width)
        };
    } else {
        // 竖屏视频
        return {
            width: Math.round((targetSize.height * videoDimension.width) / videoDimension.height),
            height: targetSize.height
        };
    }
}
```

## 实现细节

### 修改的文件

1. **src/main/thumbnail/thumbnail-handler.ts**
   - 添加 `getVideoRotation` 函数
   - 修改 `getVideoDimension` 函数以返回旋转信息
   - 更新 `createScreenshot` 函数以使用旋转信息

2. **src/main/import/metadata/extractors/video-extractor.ts**
   - 添加旋转信息提取逻辑
   - 在视频元数据中包含旋转角度

3. **src/common/import-types.ts**
   - 在 `VideoMetadata` 接口中添加 `rotation` 字段

### 测试覆盖

创建了全面的单元测试（`video-rotation.test.ts`），包括：
- 从不同来源提取旋转信息
- 负数旋转角度处理
- 宽高交换逻辑
- 缩略图尺寸计算

## 兼容性

### ffmpeg/ffprobe版本兼容

- **旧版本（< 4.4）**：使用 `stream_tags.rotate`
- **新版本（>= 4.4）**：使用 `side_data.rotation`
- **回退机制**：检查 `format.tags.rotate`

### 视频格式支持

支持所有主流视频格式：
- MP4（最常见的移动设备格式）
- MOV（iOS设备）
- AVI, MKV, WMV, M4V, FLV, WebM

## 性能影响

- **无额外开销**：旋转信息提取在现有的ffprobe调用中完成
- **缩略图生成**：ffmpeg自动处理旋转，无需额外的图像处理步骤

## 未来改进

1. **用户界面增强**
   - 在UI中显示视频旋转角度
   - 允许用户手动调整视频方向

2. **批量处理优化**
   - 缓存旋转信息以避免重复提取

3. **高级旋转支持**
   - 支持任意角度旋转（不仅限于90度的倍数）
   - 支持视频翻转（水平/垂直镜像）

## 参考资料

- [FFmpeg Rotation Metadata](https://trac.ffmpeg.org/wiki/RotationMetadata)
- [Video Orientation in Mobile Devices](https://developer.apple.com/documentation/avfoundation/avasset/1385714-preferredtransform)
- [Display Matrix in Video Containers](https://www.iso.org/standard/71851.html)

## 变更日志

### 2025-01-09
- 初始实现
- 添加旋转信息提取
- 实现自适应缩略图生成
- 创建单元测试