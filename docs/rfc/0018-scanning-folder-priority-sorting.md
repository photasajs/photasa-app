# RFC 0018: 扫描文件夹优先级排序优化

**状态**: 草案  
**作者**: AI Assistant  
**创建日期**: 2025-09-13  
**更新日期**: 2025-09-13  

## 背景

当前 `scanningFolder` 队列的排序逻辑存在问题，仅基于路径进行排序，缺乏优先级机制。这导致：

1. **用户体验问题**：用户主动选择的文件夹无法优先处理
2. **扫描效率低下**：重要文件夹可能被排在队列末尾
3. **逻辑不合理**：没有考虑扫描动作的重要性差异

## 当前实现分析

### 当前 scanningFolder 数据结构

```typescript
interface ScanAction {
    path: string;
    action: "scan" | "rescan" | "current";
    thumbnailSize: number;
    operationType?: "file" | "directory";
}

// 在 preference store 中
scanningFolder: ScanAction[];
```

### 当前排序逻辑

通过代码分析发现，当前 `scanningFolder` 数组的排序完全依赖于：

1. **添加顺序**：新文件夹直接 `push` 到数组末尾
2. **路径查找**：使用 `findIndex` 基于路径查找现有项
3. **无优先级机制**：所有扫描任务平等对待

```typescript
// 当前添加逻辑 (preference.ts:146)
this.scanningFolder.push({
    path: folder,
    action,
    thumbnailSize: this.thumbnailSize,
});

// 当前查找逻辑 (preference.ts:112)
const existingIndex = this.scanningFolder.findIndex((p) => p.path === folder);
```

## 问题分析

### 1. 缺乏优先级机制
- `rescan` 动作应优先于 `scan`
- `current` 动作（用户当前选择）应有最高优先级
- 用户主动添加的文件夹应优先于自动发现的文件夹

### 2. 排序不稳定
- 同一路径可能因不同动作而重复添加
- 更新现有项时不考虑优先级变化
- 无法保证重要任务优先执行

### 3. 性能问题
- 每次查找使用线性搜索 `findIndex`
- 没有索引或映射来快速定位

## 解决方案

### 1. 增强数据结构

```typescript
interface ScanAction {
    path: string;
    action: "scan" | "rescan" | "current";
    thumbnailSize: number;
    operationType?: "file" | "directory";
    priority: number;        // 新增：优先级
    timestamp: number;       // 新增：时间戳
    source: "user" | "auto"; // 新增：来源
}
```

### 2. 定义优先级规则

```typescript
const PRIORITY_RULES = {
    // 基础优先级（数值越小优先级越高）
    action: {
        current: 1,  // 用户当前选择
        rescan: 2,   // 重新扫描
        scan: 3      // 普通扫描
    },
    
    // 来源加成
    source: {
        user: 0,     // 用户主动添加
        auto: 10     // 自动发现
    }
};
```

### 3. 实现智能排序

```typescript
/**
 * 计算扫描动作的优先级
 */
function calculatePriority(scanAction: ScanAction): number {
    const actionPriority = PRIORITY_RULES.action[scanAction.action];
    const sourceBonus = PRIORITY_RULES.source[scanAction.source];
    
    // 优先级 = 动作优先级 + 来源加成
    // 相同优先级时按时间戳排序（越新优先级越高）
    return actionPriority + sourceBonus;
}

/**
 * 排序函数：优先级 + 路径 + 时间戳
 */
function sortScanningFolders(folders: ScanAction[]): ScanAction[] {
    return folders.sort((a, b) => {
        // 1. 按优先级排序（数值越小优先级越高）
        const priorityDiff = a.priority - b.priority;
        if (priorityDiff !== 0) return priorityDiff;
        
        // 2. 相同优先级按路径字母序排序
        const pathCompare = a.path.localeCompare(b.path);
        if (pathCompare !== 0) return pathCompare;
        
        // 3. 相同路径按时间戳排序（越新优先级越高）
        return b.timestamp - a.timestamp;
    });
}
```

### 4. 优化的添加逻辑

```typescript
async addScanFolder(
    folder: string, 
    action: "scan" | "rescan" | "current",
    source: "user" | "auto" = "user"
) {
    folder = normalizePath(folder);
    
    const existingIndex = this.scanningFolder.findIndex((p) => p.path === folder);
    const timestamp = Date.now();
    
    const newScanAction: ScanAction = {
        path: folder,
        action,
        thumbnailSize: this.thumbnailSize,
        priority: calculatePriority({ action, source }),
        timestamp,
        source
    };
    
    if (existingIndex >= 0) {
        // 更新现有项
        const existing = this.scanningFolder[existingIndex];
        
        // 只在优先级更高时更新
        if (newScanAction.priority < existing.priority) {
            this.scanningFolder[existingIndex] = newScanAction;
            this.scanningFolder = sortScanningFolders(this.scanningFolder);
        }
    } else {
        // 添加新项
        this.scanningFolder.push(newScanAction);
        this.scanningFolder = sortScanningFolders(this.scanningFolder);
    }
}
```

## 实现计划

### 阶段 1: 数据结构升级
- [ ] 扩展 `ScanAction` 接口添加 `priority`、`timestamp`、`source` 字段
- [ ] 更新所有使用 `ScanAction` 的代码
- [ ] 添加向后兼容性处理

### 阶段 2: 排序逻辑实现
- [ ] 实现 `calculatePriority` 函数
- [ ] 实现 `sortScanningFolders` 函数
- [ ] 添加单元测试覆盖新逻辑

### 阶段 3: Store 方法重构
- [ ] 重构 `addScanFolder` 方法
- [ ] 重构 `addFoldersForScan` 方法
- [ ] 确保排序在所有修改操作后执行

### 阶段 4: 性能优化
- [ ] 考虑使用 Map 或 Set 优化查找性能
- [ ] 实现批量操作以减少排序次数
- [ ] 添加性能测试

### 阶段 5: 测试与验证
- [ ] 编写全面的单元测试
- [ ] 添加集成测试验证排序行为
- [ ] 进行用户体验测试

## 测试用例

```typescript
describe('ScanningFolder Priority Sorting', () => {
    test('should prioritize current over rescan over scan', () => {
        const folders = [
            { path: '/path1', action: 'scan', source: 'user' },
            { path: '/path2', action: 'rescan', source: 'user' },
            { path: '/path3', action: 'current', source: 'user' }
        ];
        
        const sorted = sortScanningFolders(folders);
        
        expect(sorted[0].action).toBe('current');
        expect(sorted[1].action).toBe('rescan');
        expect(sorted[2].action).toBe('scan');
    });
    
    test('should prioritize user over auto source', () => {
        const folders = [
            { path: '/path1', action: 'scan', source: 'auto' },
            { path: '/path2', action: 'scan', source: 'user' }
        ];
        
        const sorted = sortScanningFolders(folders);
        
        expect(sorted[0].source).toBe('user');
        expect(sorted[1].source).toBe('auto');
    });
    
    test('should sort by path when priority is same', () => {
        const folders = [
            { path: '/z-path', action: 'scan', source: 'user' },
            { path: '/a-path', action: 'scan', source: 'user' }
        ];
        
        const sorted = sortScanningFolders(folders);
        
        expect(sorted[0].path).toBe('/a-path');
        expect(sorted[1].path).toBe('/z-path');
    });
});
```

## 风险评估

### 低风险
- 向后兼容性：新字段设置默认值
- 性能影响：排序操作复杂度可控

### 中等风险
- 现有代码依赖：需要全面测试所有调用点
- 状态迁移：需要处理现有 store 数据

### 缓解措施
- 渐进式升级：分阶段实施
- 广泛测试：单元测试 + 集成测试
- 回滚计划：保留原有逻辑作为后备

## 验收标准

1. **功能正确性**
   - 优先级排序按预期工作
   - 相同优先级按路径排序
   - 所有现有功能保持兼容

2. **性能要求**
   - 添加操作不超过 10ms
   - 排序操作在 100 个文件夹内不超过 5ms

3. **代码质量**
   - 单元测试覆盖率 > 95%
   - 所有 TypeScript 类型检查通过
   - 通过代码审查

## 参考资料

- [RFC 0003: 统一监听到扫描队列](./0003-unify-watch-to-scan-queue.md)
- [RFC 0015: 智能扫描优化](./0015-intelligent-scan-optimization.md)
- [TypeScript 接口设计最佳实践](https://www.typescriptlang.org/docs/handbook/interfaces.html)