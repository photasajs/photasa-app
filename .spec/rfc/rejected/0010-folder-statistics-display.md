# RFC 0010: 文件夹树节点统计信息显示

## 状态

- 状态: 草案
- 作者: Claude
- 创建日期: 2025-01-09

## 概述

本RFC提议在文件夹树节点上显示每个文件夹的媒体文件统计信息（图片和视频数量），提升用户对文件夹内容的感知能力和导航效率。

## 背景

### 问题描述

当前的文件夹树实现仅显示文件夹名称，用户无法直观了解每个文件夹包含多少媒体文件。这导致以下问题：

1. **导航效率低**：用户需要逐个点击文件夹才能了解其内容
2. **内容感知差**：无法快速识别哪些文件夹包含大量媒体文件
3. **用户体验不佳**：缺乏直观的视觉反馈来指导用户的导航行为

### 用户需求

1. **快速内容预览**：在不进入文件夹的情况下了解其媒体文件数量
2. **分类统计**：区分显示图片和视频的数量
3. **性能友好**：统计信息的加载不应影响文件夹树的响应性
4. **实时更新**：当文件夹内容发生变化时，统计信息应自动更新

## 目标

1. **直观显示**：在文件夹树节点上显示媒体文件统计信息
2. **性能优化**：采用懒加载和缓存策略，避免影响应用性能
3. **实时同步**：统计信息与实际文件夹内容保持同步
4. **用户体验**：提供清晰、简洁的视觉设计

## 技术方案

### 1. 数据结构设计

#### 扩展DataNode类型

```typescript
// 扩展现有的DataNode类型
interface EnhancedDataNode extends DataNode {
    key: string;
    title: string;
    children?: EnhancedDataNode[];
    statistics?: FolderStatistics;
    isLoading?: boolean; // 是否正在加载统计信息
}

// 文件夹统计信息
interface FolderStatistics {
    imageCount: number; // 图片数量
    videoCount: number; // 视频数量
    totalCount: number; // 总媒体文件数量
    hasSubfolders: boolean; // 是否包含子文件夹
    lastUpdated: number; // 最后更新时间戳
    isRecursive: boolean; // 是否包含子文件夹的统计
}
```

#### API接口设计

```typescript
// 获取文件夹统计信息的API
interface GetFolderStatisticsRequest {
    folderPath: string;
    recursive?: boolean; // 是否递归统计子文件夹
    includeCache?: boolean; // 是否使用缓存
}

interface GetFolderStatisticsResponse {
    folderPath: string;
    statistics: FolderStatistics;
    error?: string;
}

// 批量获取多个文件夹的统计信息
interface GetBatchFolderStatisticsRequest {
    folderPaths: string[];
    recursive?: boolean;
}

interface GetBatchFolderStatisticsResponse {
    results: Map<string, FolderStatistics>;
    errors: Map<string, string>;
}
```

### 2. 实现策略

#### Phase 1: 基础统计功能

- 添加获取文件夹统计信息的API
- 在主进程中实现文件夹扫描和统计逻辑
- 使用现有的PhotasaConfig缓存机制

#### Phase 2: UI集成

- 扩展FolderList.vue组件显示统计信息
- 设计统计信息的视觉呈现
- 实现懒加载机制

#### Phase 3: 性能优化

- 实现统计信息缓存
- 添加增量更新机制
- 优化大文件夹的处理

#### Phase 4: 实时更新

- 集成文件系统监控
- 实现统计信息的自动更新
- 处理并发更新场景

### 3. 主进程实现

#### 文件夹统计服务

```typescript
// src/main/services/folder-statistics.ts
export class FolderStatisticsService {
    private cache = new Map<string, CachedStatistics>();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

    async getFolderStatistics(
        folderPath: string,
        options: GetFolderStatisticsOptions = {},
    ): Promise<FolderStatistics> {
        const { recursive = false, useCache = true } = options;

        // 检查缓存
        if (useCache && this.isCacheValid(folderPath)) {
            return this.cache.get(folderPath)!.statistics;
        }

        // 扫描文件夹
        const statistics = await this.scanFolderStatistics(folderPath, recursive);

        // 更新缓存
        this.cache.set(folderPath, {
            statistics,
            timestamp: Date.now(),
        });

        return statistics;
    }

    private async scanFolderStatistics(
        folderPath: string,
        recursive: boolean,
    ): Promise<FolderStatistics> {
        // 使用现有的文件扫描逻辑，但只统计数量而不生成缩略图
        const files = await this.scanDirectoryFiles(folderPath, recursive);

        let imageCount = 0;
        let videoCount = 0;
        let hasSubfolders = false;

        for (const file of files) {
            if (this.isImageFile(file)) {
                imageCount++;
            } else if (this.isVideoFile(file)) {
                videoCount++;
            } else if (this.isDirectory(file)) {
                hasSubfolders = true;
            }
        }

        return {
            imageCount,
            videoCount,
            totalCount: imageCount + videoCount,
            hasSubfolders,
            lastUpdated: Date.now(),
            isRecursive: recursive,
        };
    }
}
```

#### IPC处理

```typescript
// src/main/ipc/folder-statistics.ts
ipcMain.handle("get-folder-statistics", async (_, request: GetFolderStatisticsRequest) => {
    try {
        const statistics = await folderStatisticsService.getFolderStatistics(request.folderPath, {
            recursive: request.recursive,
            useCache: request.includeCache,
        });

        return {
            folderPath: request.folderPath,
            statistics,
        } as GetFolderStatisticsResponse;
    } catch (error) {
        return {
            folderPath: request.folderPath,
            statistics: null,
            error: error.message,
        } as GetFolderStatisticsResponse;
    }
});
```

### 4. 渲染进程实现

#### Pinia Store扩展

```typescript
// src/renderer/src/stores/folder-statistics.ts
export const useFolderStatisticsStore = defineStore("folderStatistics", {
    state: () => ({
        statisticsCache: new Map<string, FolderStatistics>(),
        loadingFolders: new Set<string>(),
    }),

    actions: {
        async loadFolderStatistics(folderPath: string, recursive = false) {
            if (this.loadingFolders.has(folderPath)) {
                return this.statisticsCache.get(folderPath);
            }

            this.loadingFolders.add(folderPath);

            try {
                const response = await getFolderStatistics({
                    folderPath,
                    recursive,
                    includeCache: true,
                });

                if (!response.error) {
                    this.statisticsCache.set(folderPath, response.statistics);
                }

                return response.statistics;
            } catch (error) {
                console.error("Failed to load folder statistics:", error);
                return null;
            } finally {
                this.loadingFolders.delete(folderPath);
            }
        },

        invalidateCache(folderPath: string) {
            this.statisticsCache.delete(folderPath);
            // 清理子文件夹缓存
            for (const [path] of this.statisticsCache) {
                if (path.startsWith(folderPath + "/")) {
                    this.statisticsCache.delete(path);
                }
            }
        },
    },
});
```

#### FolderList.vue组件更新

```vue
<template>
    <a-tree
        class="folder-tree"
        v-model:expandedKeys="expandedKeys"
        v-model:selectedKeys="selectedKeys"
        :tree-data="enhancedFolderTree"
    >
        <template #title="{ title, key, statistics, isLoading }">
            <BaseContextMenu>
                <div class="folder-node-container">
                    <span v-if="paths.includes(key)" class="root-folder-node">
                        {{ title }}
                    </span>
                    <span v-else class="folder-node">
                        {{ title }}
                    </span>

                    <!-- 统计信息显示 -->
                    <div v-if="isLoading" class="folder-statistics loading">
                        <BaseSpinner size="small" />
                    </div>
                    <div v-else-if="statistics" class="folder-statistics">
                        <span v-if="statistics.imageCount > 0" class="stat-item image">
                            <PhImage class="stat-icon" />
                            {{ statistics.imageCount }}
                        </span>
                        <span v-if="statistics.videoCount > 0" class="stat-item video">
                            <PhVideoCamera class="stat-icon" />
                            {{ statistics.videoCount }}
                        </span>
                        <span v-if="statistics.totalCount === 0" class="stat-item empty">
                            <PhFolder class="stat-icon" />
                            {{ t("folder.empty") }}
                        </span>
                    </div>
                </div>

                <template #menu="{ close }">
                    <!-- 现有菜单项 -->
                    <BaseMenuItem
                        @click="
                            refreshStatistics(key);
                            close();
                        "
                    >
                        {{ t("menu.refreshStats") }}
                    </BaseMenuItem>
                </template>
            </BaseContextMenu>
        </template>
    </a-tree>
</template>

<script setup lang="ts">
// 扩展现有逻辑，添加统计信息加载
const folderStatisticsStore = useFolderStatisticsStore();

// 计算增强的文件夹树数据
const enhancedFolderTree = computed(() => {
    return enhanceFolderTreeWithStatistics(folderTree.value);
});

// 懒加载统计信息
const loadStatisticsOnExpand = async (expandedKeys: string[]) => {
    for (const key of expandedKeys) {
        await folderStatisticsStore.loadFolderStatistics(key);
    }
};

// 监听展开事件
watch(expandedKeys, (newKeys, oldKeys) => {
    const newlyExpanded = newKeys.filter((key) => !oldKeys.includes(key));
    loadStatisticsOnExpand(newlyExpanded);
});
</script>
```

### 5. 视觉设计

#### 统计信息样式

```scss
.folder-node-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 8px;
}

.folder-statistics {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--color-text-secondary);
    margin-left: auto;

    &.loading {
        opacity: 0.6;
    }

    .stat-item {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 1px 4px;
        border-radius: 3px;
        background: var(--color-bg-secondary);

        &.image {
            color: var(--color-success);
            background: var(--color-success-bg);
        }

        &.video {
            color: var(--color-info);
            background: var(--color-info-bg);
        }

        &.empty {
            color: var(--color-text-tertiary);
            font-style: italic;
        }

        .stat-icon {
            width: 10px;
            height: 10px;
        }
    }
}
```

### 6. 性能考虑

#### 懒加载策略

- 仅在用户展开文件夹时加载统计信息
- 使用Intersection Observer监听可见性变化
- 实现虚拟滚动（如果文件夹数量过多）

#### 缓存策略

- 客户端缓存5分钟，避免频繁重新计算
- 使用主进程缓存，避免重复文件系统访问
- 实现增量更新，仅重新计算变更的文件夹

#### 批量处理

- 支持批量获取多个文件夹统计信息
- 使用Web Workers处理大量文件的统计（未来改进）

## 用户界面设计

### 显示方案

1. **紧凑模式**（默认）：

```
📁 Documents 📷 120 🎬 5
📁 Pictures 📷 3.2k
📁 Videos 🎬 45
```

2. **详细模式**（可选）：

```
📁 Documents (120 images, 5 videos)
📁 Pictures (3,234 images)
📁 Videos (45 videos)
```

3. **进度指示**：

```
📁 Processing... ⏳
```

### 交互设计

- **鼠标悬停**：显示详细统计信息的工具提示
- **右键菜单**：添加"刷新统计信息"选项
- **异步加载**：显示加载指示器，避免阻塞UI

## 实现计划

### Phase 1: 核心功能实现（第1-2周）

- [ ] 实现FolderStatisticsService
- [ ] 添加IPC处理程序
- [ ] 创建基础的统计数据结构
- [ ] 实现简单的文件夹统计逻辑

### Phase 2: UI集成（第3周）

- [ ] 扩展FolderList.vue组件
- [ ] 实现统计信息的显示组件
- [ ] 添加加载状态指示
- [ ] 实现基础的视觉样式

### Phase 3: 性能优化（第4周）

- [ ] 实现懒加载机制
- [ ] 添加缓存策略
- [ ] 优化大文件夹的处理性能
- [ ] 实现批量统计API

### Phase 4: 实时更新（第5周）

- [ ] 集成文件系统监控
- [ ] 实现统计信息自动更新
- [ ] 处理并发更新场景
- [ ] 添加错误处理和重试机制

## 成功指标

1. **功能完整性**

- ✅ 正确显示图片和视频数量
- ✅ 支持递归统计（可选）
- ✅ 实时更新统计信息

2. **性能指标**

- 📊 文件夹树展开延迟 < 200ms
- 📊 统计信息缓存命中率 > 80%
- 📊 大文件夹（1000+文件）统计时间 < 2s

3. **用户体验**

- 🎯 清晰的视觉反馈
- 🎯 非阻塞的异步加载
- 🎯 直观的错误处理

4. **系统稳定性**

- 🔧 处理文件系统权限错误
- 🔧 优雅处理大文件夹场景
- 🔧 内存使用保持稳定

## 潜在风险与对策

### 风险1: 性能影响

**描述**: 大量文件夹的统计计算可能影响应用性能
**对策**:

- 实现懒加载和分页
- 使用Web Workers进行计算
- 优化文件系统访问

### 风险2: 文件系统权限

**描述**: 某些文件夹可能没有访问权限
**对策**:

- 优雅处理权限错误
- 显示适当的错误状态
- 提供重试机制

### 风险3: 缓存一致性

**描述**: 文件系统变化时缓存可能过期
**对策**:

- 实现文件系统监控
- 提供手动刷新选项
- 合理的缓存过期策略

## 未来扩展

1. **高级统计**

- 文件大小统计
- 创建时间分布
- 文件类型详细分类

2. **可视化增强**

- 文件夹大小的可视化指示
- 统计信息的图表展示
- 自定义显示选项

3. **搜索集成**

- 基于统计信息的智能搜索
- 快速定位特定类型文件夹

## 参考资料

- [现有文件扫描实现](../src/main/scan/folder-scanner.ts)
- [Pinia状态管理模式](https://pinia.vuejs.org/core-concepts/)
- [contract reference IPC最佳实践](https://www.desktop-shell.dev/docs/latest/tutorial/ipc)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)

## 变更日志

### 2025-01-09

- 初始RFC创建
- 定义基础数据结构和API设计
- 制定实现计划和成功指标
