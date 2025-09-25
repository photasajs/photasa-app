# RFC 0025: 树形组件展开时自动聚焦功能

- **开始日期**: 2025-01-27
- **RFC PR**: (留空)
- **实现问题**: (留空)

## 摘要

为BaseTree树形组件添加展开节点时自动聚焦功能，当用户展开树节点时，自动滚动到该节点位置，提升用户体验和操作效率。

## 动机

当前的树形组件在展开节点时，用户需要手动滚动才能看到展开的内容，这在大树结构中尤其不便：

- **用户体验差**: 展开节点后需要手动查找和滚动到目标位置
- **操作效率低**: 在深层嵌套的树结构中，用户容易迷失位置
- **视觉连续性**: 展开操作后缺乏视觉反馈，用户不知道内容在哪里
- **工作流中断**: 频繁的手动滚动打断了用户的操作流程

此功能将提供更直观和高效的树形导航体验。

## 详细设计

### 1. 功能特性

#### 1.1 自动聚焦行为

- 当用户展开树节点时，自动滚动到该节点位置
- 支持平滑滚动动画，提供视觉连续性
- 可配置的对齐方式（start、center、end、auto）
- 支持虚拟化和非虚拟化两种模式

#### 1.2 配置选项

- `autoFocusOnExpand`: 布尔值，控制是否启用自动聚焦
- 默认值：`false`（保持向后兼容）
- 可通过props传递给BaseTree组件

### 2. 技术实现

#### 2.1 组件接口扩展

```typescript
interface Props {
    // ... 现有属性
    autoFocusOnExpand?: boolean;
}
```

#### 2.2 滚动方法实现

```typescript
const scrollToNode = (
    nodeKey: Key,
    options?: {
        align?: "start" | "center" | "end" | "auto";
        behavior?: "auto" | "smooth";
    },
) => {
    if (props.virtual) {
        // 虚拟化模式：使用VirtualList的scrollToIndex
        const flatNodes = flattenTreeData(props.treeData);
        const nodeIndex = flatNodes.findIndex((item) => item.key === nodeKey);
        if (nodeIndex >= 0 && virtualListRef.value) {
            virtualListRef.value.scrollToIndex(nodeIndex, options);
        }
    } else {
        // 非虚拟化模式：使用DOM scrollIntoView
        const nodeElement = containerRef.value.querySelector(`[data-node-key="${nodeKey}"]`);
        if (nodeElement) {
            nodeElement.scrollIntoView({
                behavior: options?.behavior || "smooth",
                block: options?.align || "center",
                inline: "nearest",
            });
        }
    }
};
```

#### 2.3 展开事件处理

```typescript
const handleNodeExpand = (node: TreeNode, expanded?: boolean) => {
    // ... 现有展开逻辑

    // 自动聚焦到展开的节点
    if (props.autoFocusOnExpand && newExpanded) {
        nextTick(() => {
            scrollToNode(node.key, { align: "center", behavior: "smooth" });
        });
    }
};
```

### 3. 实现细节

#### 3.1 虚拟化模式支持

- 通过VirtualList组件的`scrollToIndex`方法实现滚动
- 计算节点在扁平化列表中的索引位置
- 支持平滑滚动动画

#### 3.2 非虚拟化模式支持

- 使用DOM的`scrollIntoView`方法
- 通过`data-node-key`属性定位节点元素
- 支持多种对齐方式

#### 3.3 性能优化

- 使用`nextTick`确保DOM更新后再执行滚动
- 避免频繁的DOM查询和计算
- 平滑滚动动画不阻塞主线程

### 4. 用户体验

#### 4.1 视觉反馈

- 平滑的滚动动画提供视觉连续性
- 节点自动居中显示，确保最佳可见性
- 保持用户的操作上下文

#### 4.2 交互流程

1. 用户点击展开按钮
2. 节点展开，显示子节点
3. 自动滚动到展开的节点位置
4. 用户可以看到展开的内容

#### 4.3 可访问性

- 保持键盘导航功能
- 屏幕阅读器兼容
- 不干扰现有的无障碍功能

## 缺点

1. **性能影响**: 每次展开都需要计算滚动位置，可能影响大树的性能
2. **动画干扰**: 自动滚动可能干扰用户的手动滚动操作
3. **配置复杂性**: 增加了组件的配置选项
4. **浏览器兼容性**: `scrollIntoView`的某些选项在老版本浏览器中支持有限

## 替代方案

### 替代方案1: 仅视觉高亮

- 展开时仅高亮节点，不自动滚动
- **已拒绝**: 不能解决深层嵌套的可见性问题

### 替代方案2: 手动滚动提示

- 展开时显示滚动提示或箭头
- **已拒绝**: 增加了UI复杂性，用户体验不如自动滚动

### 替代方案3: 展开时自动选择

- 展开时自动选择该节点
- **已拒绝**: 改变了现有的选择行为，可能影响用户工作流

### 替代方案4: 无变更

- 保持现有的手动滚动行为
- **已拒绝**: 不解决用户体验问题

## 未解决问题

1. **滚动冲突**: 如何处理用户正在手动滚动时的自动滚动？
    - **决定**: 使用`nextTick`延迟执行，减少冲突

2. **性能阈值**: 在多大的树结构中应该禁用自动聚焦？
    - **决定**: 暂不设置阈值，通过配置选项让用户控制

3. **动画时长**: 滚动动画的最佳时长是多少？
    - **决定**: 使用浏览器默认的smooth行为

4. **移动端支持**: 在触摸设备上是否需要特殊处理？
    - **决定**: 当前桌面应用不需要特殊处理

## 实施计划

### 阶段1: 核心功能实现

- [x] 在BaseTree组件中添加`autoFocusOnExpand`属性
- [x] 实现`scrollToNode`方法支持两种模式
- [x] 修改`handleNodeExpand`事件处理器
- [x] 为BaseTreeNode添加`data-node-key`属性

### 阶段2: 集成和测试

- [x] 在FolderList组件中启用自动聚焦
- [x] 测试虚拟化列表的滚动功能
- [x] 测试非虚拟化模式的滚动功能
- [x] 验证平滑滚动动画效果

### 阶段3: 文档和优化

- [x] 创建RFC文档
- [ ] 更新组件文档
- [ ] 添加使用示例
- [ ] 性能测试和优化

## 成功标准

1. **功能性**: 展开节点时能够正确滚动到目标位置
2. **兼容性**: 在虚拟化和非虚拟化模式下都能正常工作
3. **性能**: 滚动操作不影响树的渲染性能
4. **用户体验**: 提供平滑的视觉反馈和良好的操作体验
5. **可配置性**: 用户可以选择启用或禁用此功能

## 未来增强

1. **智能滚动**: 根据节点在视口中的位置智能选择滚动方向
2. **批量展开**: 支持批量展开时的智能聚焦策略
3. **滚动记忆**: 记住用户的滚动偏好
4. **键盘快捷键**: 添加键盘快捷键控制自动聚焦
5. **动画自定义**: 允许用户自定义滚动动画效果

## 参考

- [MDN scrollIntoView](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)
- [Vue 3 nextTick](https://vuejs.org/api/general.html#nexttick)
- [现有BaseTree实现](./0016-basetree-component-implementation.md)
- [VirtualList组件文档](../components/ui/VirtualList.vue)
