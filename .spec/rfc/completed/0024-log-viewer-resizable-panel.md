# RFC 0024: 日志查看器可调整大小面板增强

- **RFC编号**: 0024
- **标题**: 日志查看器可调整大小面板增强
- **作者**: 李鹏
- **开始日期**: 2025-01-27
- **状态**: ✅ **已完成**
- **完成日期**: 2025-01-27
- **类型**: 增强

## 摘要

为生产环境日志查看器添加可调整大小面板功能，允许用户调整日志控制台窗口的宽度和高度，以提升可用性和改善日志内容可见性。

## 动机

当前的日志查看器具有固定尺寸（90%宽度，600px高度），这可能不是所有使用场景的最佳选择：

- **灵活性有限**: 用户无法根据屏幕大小或偏好调整面板尺寸
- **内容可见性差**: 固定高度可能不足以查看长日志条目或多行日志
- **屏幕空间利用**: 拥有大屏幕的用户无法有效利用可用空间
- **工作流效率**: 开发者和用户在不同调试场景下需要不同的面板尺寸

此增强将提供更灵活和用户友好的日志查看体验。

## 详细设计

### 1. 用户界面变更

#### 1.1 调整大小手柄

为日志控制台面板添加三个调整大小手柄：

- **右边缘手柄**: 8px宽，全高度，启用水平调整
- **底边缘手柄**: 8px高，全宽度，启用垂直调整
- **角落手柄**: 12x12px位于右下角，启用对角线调整

#### 1.2 视觉设计

- 手柄默认透明
- 悬停状态显示蓝色半透明背景（`rgba(0, 132, 255, 0.3)`）
- 适当的光标样式：`ew-resize`、`ns-resize`、`nw-resize`
- 手柄使用`z-index: 10`定位以确保可见性

### 2. 技术实现

#### 2.1 Vue 3 组合式API

```typescript
// 状态管理
const isResizing = ref(false);
const resizeType = ref<"right" | "bottom" | "corner" | null>(null);
const initialSize = ref({ width: 0, height: 0 });
const initialMouse = ref({ x: 0, y: 0 });
```

#### 2.2 事件处理

- `startResize(type)`: 启动调整大小操作
- `handleResize(e)`: 处理调整大小过程中的鼠标移动
- `stopResize()`: 完成调整大小操作并清理事件监听器

#### 2.3 尺寸约束

- **最小宽度**: 400px
- **最大宽度**: 窗口宽度的95%
- **最小高度**: 300px
- **最大高度**: 窗口高度的90%

#### 2.4 兼容性

- 保持现有拖拽功能
- 防止拖拽和调整大小操作之间的冲突
- 保留所有现有日志查看器功能

### 3. 实现细节

#### 3.1 模板结构

```vue
<div class="log-console">
  <!-- 现有内容 -->
  <div class="log-footer">
    <!-- 现有页脚内容 -->
  </div>

  <!-- 调整大小手柄 -->
  <div class="resize-handle resize-right" @mousedown="startResize('right')"></div>
  <div class="resize-handle resize-bottom" @mousedown="startResize('bottom')"></div>
  <div class="resize-handle resize-corner" @mousedown="startResize('corner')"></div>
</div>
```

#### 3.2 CSS样式

```less
.log-console {
    position: relative; // 启用手柄的绝对定位

    .resize-handle {
        position: absolute;
        background: transparent;
        z-index: 10;

        &.resize-right {
            top: 0;
            right: 0;
            width: 8px;
            height: 100%;
            cursor: ew-resize;
        }

        &.resize-bottom {
            bottom: 0;
            left: 0;
            width: 100%;
            height: 8px;
            cursor: ns-resize;
        }

        &.resize-corner {
            bottom: 0;
            right: 0;
            width: 12px;
            height: 12px;
            cursor: nw-resize;
        }

        &:hover {
            background: rgba(0, 132, 255, 0.3);
        }
    }
}
```

#### 3.3 JavaScript逻辑

```typescript
const startResize = (type: "right" | "bottom" | "corner") => {
    isResizing.value = true;
    resizeType.value = type;

    const consoleEl = document.querySelector(".log-console") as HTMLElement;
    if (consoleEl) {
        const rect = consoleEl.getBoundingClientRect();
        initialSize.value = { width: rect.width, height: rect.height };
        initialMouse.value = { x: 0, y: 0 };
        consoleEl.style.cursor = getResizeCursor(type);
    }

    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResize);
};

const handleResize = (e: MouseEvent) => {
    if (!isResizing.value || !resizeType.value) return;

    // Set initial mouse position on first move
    if (initialMouse.value.x === 0 && initialMouse.value.y === 0) {
        initialMouse.value = { x: e.clientX, y: e.clientY };
        return;
    }

    const deltaX = e.clientX - initialMouse.value.x;
    const deltaY = e.clientY - initialMouse.value.y;

    let newWidth = initialSize.value.width;
    let newHeight = initialSize.value.height;

    // Calculate new dimensions based on resize type
    switch (resizeType.value) {
        case "right":
            newWidth = initialSize.value.width + deltaX;
            break;
        case "bottom":
            newHeight = initialSize.value.height + deltaY;
            break;
        case "corner":
            newWidth = initialSize.value.width + deltaX;
            newHeight = initialSize.value.height + deltaY;
            break;
    }

    // Apply size constraints
    const minWidth = 400;
    const maxWidth = window.innerWidth * 0.95;
    const minHeight = 300;
    const maxHeight = window.innerHeight * 0.9;

    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

    // Apply new dimensions
    consoleEl.style.width = `${newWidth}px`;
    consoleEl.style.height = `${newHeight}px`;
};
```

### 4. 用户体验

#### 4.1 交互流程

1. 用户悬停在调整大小手柄上 → 光标变为调整大小指示器
2. 用户点击并拖拽手柄 → 面板实时调整大小
3. 用户释放鼠标 → 调整大小操作完成
4. 面板保持新尺寸直到下次调整或面板关闭

#### 4.2 视觉反馈

- 悬停时立即的光标反馈
- 拖拽过程中的实时尺寸调整
- 无闪烁的平滑调整大小操作
- 调整大小过程中保持面板位置

#### 4.3 可访问性

- 不需要键盘导航（仅鼠标操作）
- 调整大小区域的清晰视觉指示器
- 保持现有的面板切换键盘快捷键

## 缺点

1. **复杂性**: 增加了额外的事件处理和状态管理
2. **事件冲突**: 拖拽和调整大小操作之间的潜在冲突（通过适当的事件处理缓解）
3. **性能**: 额外DOM元素和事件监听器的最小影响
4. **维护**: 需要维护和测试的额外代码

## 替代方案

### 替代方案1: 固定尺寸预设

- 提供预定义尺寸选项（小、中、大）
- 实现更简单但灵活性较差
- **已拒绝**: 用户控制和灵活性较少

### 替代方案2: 全窗口模式

- 在覆盖层和全窗口模式之间切换
- **已拒绝**: 改变了日志查看器的基本性质

### 替代方案3: 分割面板布局

- 将屏幕分为可调整大小的部分
- **已拒绝**: 对当前使用场景来说过于复杂

### 替代方案4: 无变更

- 保持当前固定尺寸实现
- **已拒绝**: 不解决用户灵活性需求

## 未解决问题

1. **尺寸持久化**: 面板是否应该记住会话间的最后尺寸？
    - **决定**: 初始版本中未实现，如需要可在后续添加

2. **最小尺寸验证**: 提议的最小尺寸（400x300）是否合适？
    - **决定**: 基于典型日志内容的测试，这些尺寸提供了良好的可用性

3. **移动端支持**: 调整大小功能是否应该在触摸设备上工作？
    - **决定**: 当前桌面应用不需要

4. **动画**: 调整大小操作是否应该包含平滑动画？
    - **决定**: 实时调整大小比动画提供更好的用户反馈

## 实施计划

### 阶段1: 核心功能

- [x] 向模板添加调整大小手柄
- [x] 实现调整大小状态管理
- [x] 添加调整大小事件处理器
- [x] 应用尺寸约束
- [x] 确保与现有拖拽功能的兼容性

### 阶段2: 测试和优化

- [x] 在不同屏幕尺寸下测试调整大小功能
- [x] 验证与现有功能无冲突
- [x] 大日志量性能测试
- [x] 用户验收测试

### 阶段3: 文档和优化

- [x] 更新用户文档
- [x] 添加内联代码注释
- [x] 创建使用示例
- [x] 最终代码审查

### 阶段4: 额外优化（已完成）

- [x] 集成BaseSelect组件替换原生select
- [x] 优化工具栏布局，提升紧凑性和一致性
- [x] 统一控件高度和样式
- [x] 改进响应式设计

## 成功标准

1. **功能性**: 用户可以成功在所有三个方向上调整日志面板大小
2. **兼容性**: 现有拖拽和其他日志查看器功能继续工作
3. **性能**: 调整大小操作期间无明显性能影响
4. **可用性**: 直观的调整大小手柄，具有清晰的视觉反馈
5. **约束**: 尺寸限制防止不可用的面板尺寸

## 未来增强

1. **尺寸持久化**: 记住会话间的面板尺寸
2. **键盘快捷键**: 为常见调整大小操作添加键盘快捷键
3. **网格对齐**: 可选的基于网格的调整大小，用于精确对齐
4. **多面板**: 支持多个可调整大小的日志面板
5. **自定义约束**: 用户可配置的尺寸限制

## 参考

- [Vue 3 组合式API](https://vuejs.org/guide/composition-api/)
- [CSS调整大小属性](https://developer.mozilla.org/en-US/docs/Web/CSS/resize)
- [鼠标事件API](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)
- [现有日志查看器实现](./0017-production-log-viewer.md)
