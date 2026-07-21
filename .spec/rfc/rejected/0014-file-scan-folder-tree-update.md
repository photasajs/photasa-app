# RFC 0014: 文件扫描时文件夹树更新优化

- **Start Date**: 2025-09-12
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)

## Summary

优化文件扫描逻辑，确保当扫描单个文件时能够正确更新文件夹树结构，显示文件所在的父目录。

## Motivation

### 当前问题

在现有的扫描系统中，存在以下问题：

1. **文件夹扫描**：当执行 `addScanFolder` 时，会调用 `updateFolderTree(folder)` 更新文件夹树
2. **文件扫描**：当执行 `addFileOperation` 且 `operationType === "file"` 时，不会更新文件夹树
3. **用户体验问题**：当用户拖拽单个文件到应用中时，该文件所在的父目录不会在文件夹树中显示，导致用户无法通过树导航到该文件

### 用例场景

- 用户拖拽单个图片文件到应用
- 用户通过文件选择器选择单个文件进行处理
- 系统监控到单个文件变更需要重新处理
- 导入向导中处理单个文件操作

### 预期结果

当处理单个文件时，文件夹树应该显示该文件所在的父目录，使用户能够：

- 在文件夹树中看到相关目录结构
- 通过树导航到文件所在位置
- 保持界面的一致性和可预测性

## Detailed Design

### 核心设计原则

1. **路径提取**：从文件路径中提取父目录路径
2. **树更新**：使用父目录路径更新文件夹树
3. **向后兼容**：不影响现有的文件夹扫描逻辑
4. **路径标准化**：确保路径格式一致性

### 实现方案

#### 方案一：修改 addFileOperation 方法

在 `preference.ts` 的 `addFileOperation` 方法中添加文件路径处理逻辑：

```typescript
addFileOperation(operation: FileOperationInput) {
    // ... 现有逻辑 ...

    // 新增：对于文件操作，使用父目录更新文件夹树
    if (operation.operationType === "file") {
        const parentDir = toDirName(normalizedPath);
        if (parentDir && parentDir !== normalizedPath) {
            this.updateFolderTree(parentDir);
        }
    } else if (operation.operationType === "directory") {
        this.updateFolderTree(normalizedPath);
    }
}
```

#### 方案二：创建统一的树更新方法

创建一个新的方法来处理所有类型的路径更新：

```typescript
updateTreeForPath(path: string, operationType: "file" | "directory") {
    let treeUpdatePath: string;

    if (operationType === "file") {
        // 对于文件，使用父目录路径
        treeUpdatePath = toDirName(path);
    } else {
        // 对于目录，使用目录路径本身
        treeUpdatePath = path;
    }

    if (treeUpdatePath && treeUpdatePath !== path) {
        this.updateFolderTree(treeUpdatePath);
    }
}
```

#### 推荐方案：方案一

**理由**：

- 最小化代码更改
- 保持现有API不变
- 直接在问题点修复
- 易于理解和维护

### 技术实现细节

#### 1. 路径处理

使用现有的 `toDirName` 函数从 `@shared/path-util`：

- 输入：`/Users/test/photos/image.jpg`
- 输出：`/Users/test/photos`

#### 2. 边界条件处理

```typescript
// 处理根目录文件
if (parentDir && parentDir !== normalizedPath && parentDir !== "/") {
    this.updateFolderTree(parentDir);
}
```

#### 3. 性能考虑

- `toDirName` 是简单的字符串操作，性能开销minimal
- 树更新逻辑复用现有的 `buildDataNode` 算法
- 不会产生额外的磁盘I/O操作

#### 4. 错误处理

```typescript
try {
    const parentDir = toDirName(normalizedPath);
    if (parentDir && parentDir !== normalizedPath) {
        this.updateFolderTree(parentDir);
    }
} catch (error) {
    logger.warn(`Failed to update folder tree for file ${normalizedPath}:`, error);
    // 继续执行其他逻辑，不中断文件操作
}
```

### 测试策略

#### 单元测试

1. **文件路径提取测试**
    - 测试各种文件路径格式
    - 验证父目录正确提取
    - 测试边界情况（根目录、相对路径等）

2. **树更新测试**
    - 验证文件操作触发树更新
    - 确认使用父目录路径更新
    - 测试重复更新的幂等性

#### 集成测试

1. **用户操作流程测试**
    - 模拟文件拖拽操作
    - 验证树结构正确更新
    - 确认用户界面正确显示

2. **性能测试**
    - 大量文件操作的性能影响
    - 内存使用情况监控

### API变更

**无破坏性变更**：此RFC不涉及任何公共API的变更，所有修改都在内部实现层面。

## Drawbacks

### 潜在问题

1. **轻微性能开销**：每个文件操作都会进行路径处理和树更新
2. **树结构变化**：用户可能会在树中看到之前不显示的目录
3. **调试复杂度**：增加了树更新的触发路径

### 风险评估

- **低风险**：修改局限在单个方法内
- **向后兼容**：不影响现有功能
- **可回滚**：如有问题可快速回退

## Alternatives

### 替代方案1：延迟树更新

在用户首次访问文件夹树时才进行更新，而不是在文件操作时立即更新。

**优点**：

- 减少不必要的树更新操作
- 提高文件操作的响应速度

**缺点**：

- 用户体验不一致
- 增加了状态管理复杂度
- 需要更多的缓存逻辑

### 替代方案2：配置选项

提供用户配置选项来控制是否为文件操作更新树。

**优点**：

- 用户可以根据需要选择
- 保持最大的向后兼容性

**缺点**：

- 增加了配置复杂度
- 用户需要理解这个技术细节
- 默认行为仍需要决策

### 不实施的影响

如果不实施此改进：

- 用户在处理单个文件时缺乏上下文导航
- 应用行为不一致（文件夹vs文件处理差异）
- 用户体验受损，特别是在文件拖拽场景

## Unresolved Questions

1. **路径缓存**：是否需要缓存父目录路径提取结果以提高性能？
2. **批量操作优化**：当同时处理多个来自同一目录的文件时，是否需要去重树更新操作？
3. **错误恢复**：如果父目录路径提取失败，是否需要fallback策略？

## Implementation Plan

### Phase 1: 核心功能实现

- [ ] 修改 `addFileOperation` 方法添加父目录树更新逻辑
- [ ] 添加错误处理和日志记录
- [ ] 编写单元测试验证功能正确性

### Phase 2: 集成测试和优化

- [ ] 创建集成测试验证端到端功能
- [ ] 性能测试和优化
- [ ] 用户界面测试

### Phase 3: 文档和发布

- [ ] 更新相关技术文档
- [ ] 创建发布说明
- [ ] 监控生产环境表现

## Success Criteria

1. **功能正确性**：单个文件操作能够在文件夹树中显示父目录
2. **性能影响**：文件操作性能降低不超过5%
3. **用户体验**：用户能够通过文件夹树导航到处理的文件位置
4. **系统稳定性**：无新增崩溃或错误，向后兼容性100%

## References

- [RFC 0003: Unify File Watch Events to Scan Queue](./0003-unify-watch-to-scan-queue.md)
- [RFC 0012: 统一路径处理架构重构](./0012-unified-path-handling-architecture.md)
- Current implementation: `src/renderer/src/stores/preference.ts`
- Path utilities: `src/shared/path-util.ts`
