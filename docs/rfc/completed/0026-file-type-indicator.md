# RFC 0026: 文件类型指示器组件

- **开始日期**: 2025-01-27
- **RFC PR**: (留空)
- **实现问题**: (留空)
- **状态**: ✅ 已完成

## 摘要

为图片列表添加两个增强功能：

1. **头部统计显示**: 在面包屑右侧显示图片和视频数量统计，提供快速的文件概览
2. **文件类型指示器**: 在缩略图上显示文件类型标识，不仅显示播放按钮，还要显示具体的文件格式（如JPEG、PNG、MP4、MOV等），帮助用户快速识别文件类型和格式

## 动机

当前的图片列表存在以下问题：

### 文件统计信息缺失

- **数量不明**: 用户无法快速了解当前文件夹中有多少图片和视频
- **概览困难**: 需要滚动才能看到所有文件，无法快速获得整体印象
- **导航不便**: 在大型文件夹中难以快速定位目标文件类型

### 文件类型识别不足

- **信息不足**: 用户无法知道具体的文件格式（JPEG vs PNG vs WebP等）
- **RAW文件识别**: 无法区分RAW文件（CR2、RAF、ARW等）和普通图片
- **AI文件支持**: 缺少对设计文件（PSD、AI、Sketch等）的视觉指示
- **用户体验**: 需要更直观的文件类型识别方式

这些功能将提供更丰富和准确的文件信息，显著提升用户的工作效率。

## 详细设计

### 1. 功能特性

#### 1.1 图片列表头部统计（新增）

- 在面包屑右侧显示文件数量统计
- 支持图片和视频分别计数
- 显示总文件数和详细分类
- 支持加载状态显示
- 响应式设计，移动端优化

#### 1.2 智能文件类型检测

- 利用现有的文件扩展名检测逻辑（基于 `EnhancedImageInfoModal.vue`）
- 分类文件类型（图片、视频、RAW、AI文件、其他）
- 格式化显示名称（mp4 -> MP4, jpg -> JPEG）
- 支持特殊格式（HEIC、RAW等）

#### 1.3 视觉指示器

- 使用现有的 Phosphor Icons 库
- 格式标签显示（JPEG、PNG、MP4等）
- 颜色编码区分不同文件类型
- 响应式设计，适应不同缩略图尺寸

#### 1.3 交互体验

- 悬停显示详细信息
- 平滑的动画效果
- 不干扰缩略图的点击事件
- 支持主题切换

### 2. 技术实现

#### 2.1 图片列表统计实现

```typescript
// 在 ImageList.vue 中添加统计逻辑
const imageCount = computed(() => {
    if (!card?.config?.photoList) return 0;
    return card.config.photoList.filter(
        (item: any) =>
            item.type === "image" ||
            ["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif"].includes(
                item.path?.toLowerCase().split(".").pop() || "",
            ),
    ).length;
});

const videoCount = computed(() => {
    if (!card?.config?.photoList) return 0;
    return card.config.photoList.filter(
        (item: any) =>
            item.type === "video" ||
            ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv"].includes(
                item.path?.toLowerCase().split(".").pop() || "",
            ),
    ).length;
});
```

#### 2.2 利用现有资源

- **图标库**: 使用已有的 `@phosphor-icons/vue`
- **文件类型检测**: 基于 `EnhancedImageInfoModal.vue` 中的现有逻辑
- **文件扩展名常量**: 利用 `config.ts` 中已定义的扩展名
- **现有组件**: 扩展现有的 `BaseImage.vue` 组件

#### 2.3 组件架构

```typescript
interface FileTypeBadgeProps {
    filePath: string;
    isVideo: boolean;
    showFormat?: boolean;
    size?: "small" | "medium" | "large";
}
```

#### 2.4 文件类型检测（直接使用现有逻辑）

```typescript
// 直接在FileTypeBadge组件中复制现有逻辑
const isImage = computed(() => {
    const ext = props.filePath.toLowerCase().split(".").pop();
    return ["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif"].includes(ext || "");
});

const isVideo = computed(() => {
    const ext = props.filePath.toLowerCase().split(".").pop();
    return ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv"].includes(ext || "");
});

const isRaw = computed(() => {
    const ext = props.filePath.toLowerCase().split(".").pop();
    return ["raf", "cr2", "arw", "dng"].includes(ext || "");
});
```

#### 2.5 支持的格式（基于现有配置）

- **图片格式**: 基于 `config.acceptedNonRawExtensions` 和 `config.acceptedHeicExtensions`
- **视频格式**: 基于 `EnhancedImageInfoModal.vue` 中的视频扩展名列表
- **RAW格式**: 基于 `config.acceptedRawExtensions`
- **AI格式**: 基于 `config.acceptedAiExtensions`

### 3. 实现细节

#### 3.1 FileTypeBadge组件（简化版）

```vue
<template>
    <div
        class="file-type-badge"
        :class="[`file-type-badge--${size}`, `file-type-badge--${fileType.category}`]"
    >
        <component :is="fileType.icon" :size="iconSize" />
        <span v-if="showFormat" class="file-type-badge__format">
            {{ fileType.format }}
        </span>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
    PhImage as ImageIcon,
    PhVideo as VideoIcon,
    PhFile as FileIcon,
    PhCamera as RawIcon,
    PhPaintBrush as AiIcon,
} from "@phosphor-icons/vue";
// 直接使用现有的文件类型检测逻辑
const fileType = computed(() => {
    const ext = props.filePath.toLowerCase().split(".").pop() || "";

    if (isImage.value) {
        return { category: "image", icon: "PhImage", format: ext.toUpperCase() };
    } else if (isVideo.value) {
        return { category: "video", icon: "PhVideo", format: ext.toUpperCase() };
    } else if (isRaw.value) {
        return { category: "raw", icon: "PhCamera", format: ext.toUpperCase() };
    } else {
        return { category: "other", icon: "PhFile", format: ext.toUpperCase() };
    }
});
</script>
```

#### 3.2 样式设计（简化版）

```scss
.file-type-badge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 4px;
    padding: 2px 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 500;
    color: white;
    backdrop-filter: blur(4px);
    transition: all 0.2s ease;

    &--image {
        background: rgba(34, 197, 94, 0.9);
    }

    &--video {
        background: rgba(239, 68, 68, 0.9);
    }

    &--raw {
        background: rgba(168, 85, 247, 0.9);
    }

    &--ai {
        background: rgba(245, 158, 11, 0.9);
    }
}
```

#### 3.3 图片列表头部统计（新增功能）

```vue
<!-- ImageList.vue 头部区域 -->
<div class="px-4 py-2 border-b flex items-center justify-between">
  <BaseBreadcrumb>
    <BaseBreadcrumbItem
      v-for="(part, index) in card.parts"
      :key="part"
      :isLast="index === card.parts.length - 1"
    >
      {{ part }}
    </BaseBreadcrumbItem>
  </BaseBreadcrumb>

  <!-- 文件统计 -->
  <FileCountBadge
    :image-count="imageCount"
    :video-count="videoCount"
    :is-loading="loadingPhotasaConfig"
    :show-breakdown="true"
  />
</div>
```

#### 3.4 集成到BaseImage（最小改动）

```vue
<template>
    <div class="thumbnail-image">
        <!-- 现有内容 -->
        <img v-if="!isVideo" :src="actualSrc" />

        <!-- 文件类型标识 -->
        <FileTypeBadge :file-path="raw" :is-video="isVideo" :show-format="width > 100" />
    </div>
</template>
```

### 4. 用户体验

#### 4.1 视觉层次

- 主要信息：文件类型图标
- 次要信息：格式标签
- 背景：半透明，不遮挡缩略图内容
- 位置：角落，不干扰主要内容

#### 4.2 交互反馈

- 悬停时轻微放大（scale: 1.05）
- 点击时短暂高亮
- 平滑的过渡动画
- 保持缩略图的点击区域

#### 4.3 响应式设计

- 小缩略图：仅显示图标
- 中等缩略图：图标 + 格式
- 大缩略图：完整指示器

## 缺点

1. **性能影响**: 每个缩略图都需要文件类型检测，可能影响大量文件的渲染性能
2. **视觉复杂度**: 增加了界面的视觉元素，可能显得拥挤
3. **维护成本**: 需要维护文件类型映射（但利用现有配置，成本较低）
4. **兼容性**: 某些特殊文件格式可能无法正确识别

## 替代方案

### 替代方案1: 仅显示播放按钮

- 保持现有的简单设计
- **已拒绝**: 信息量不足，无法满足用户需求

### 替代方案2: 悬停显示详细信息

- 仅在悬停时显示文件类型信息
- **已拒绝**: 需要额外交互，不够直观

### 替代方案3: 侧边栏文件信息

- 在侧边栏显示选中文件的详细信息
- **已拒绝**: 与当前需求不符，用户需要快速识别所有文件

### 替代方案4: 文件列表视图

- 提供列表视图显示文件详细信息
- **已拒绝**: 改变了现有的网格布局设计

## 未解决问题

1. **性能优化**: 如何在大文件列表中保持流畅的渲染性能？
    - **决定**: 使用虚拟化滚动和懒加载

2. **文件类型扩展**: 如何支持新的文件格式？
    - **决定**: 创建可配置的文件类型映射

3. **主题适配**: 如何确保在不同主题下的可见性？
    - **决定**: 使用CSS变量和对比度检测

4. **无障碍访问**: 如何为屏幕阅读器提供文件类型信息？
    - **决定**: 添加aria-label和role属性

## 实施计划

### 阶段1: 在图片列表头部添加文件统计

- [ ] 在 `ImageList.vue` 头部区域集成 `FileCountBadge` 组件
- [ ] 添加图片和视频数量统计逻辑
- [ ] 确保与现有面包屑布局协调
- [ ] 测试响应式显示效果

### 阶段2: 创建FileTypeBadge组件

- [ ] 创建 `src/renderer/src/components/ui/FileTypeBadge.vue`
- [ ] 使用现有的 Phosphor Icons
- [ ] 实现基础样式和布局
- [ ] 添加响应式显示逻辑

### 阶段3: 集成到BaseImage

- [ ] 修改 `src/renderer/src/components/ui/BaseImage.vue`
- [ ] 添加FileTypeBadge组件
- [ ] 实现条件显示逻辑
- [ ] 确保不干扰现有功能

### 阶段4: 测试和优化

- [ ] 测试各种文件格式
- [ ] 性能测试和优化
- [ ] 响应式设计测试
- [ ] 最终清理和文档

## 成功标准

1. **功能性**: 能够正确识别和显示各种文件格式
2. **性能**: 在1000+文件的列表中保持流畅渲染
3. **可用性**: 用户能够快速识别文件类型
4. **一致性**: 与现有设计系统保持一致
5. **可维护性**: 易于添加新的文件类型支持

## 未来增强

1. **文件大小显示**: 在指示器中显示文件大小
2. **质量指示**: 显示图片/视频的质量等级
3. **自定义图标**: 允许用户自定义文件类型图标
4. **批量操作**: 支持按文件类型进行批量操作
5. **智能排序**: 根据文件类型智能排序

## 参考

- [Phosphor Icons](https://phosphoricons.com/) - 项目中已使用的图标库
- [现有文件类型检测](./EnhancedImageInfoModal.vue) - 基于现有代码实现
- [BaseImage组件文档](./BaseImage.vue) - 目标集成组件
- [文件类型常量](./constants.ts) - 现有文件类型定义
- [配置文件](./config.ts) - 现有文件扩展名配置
