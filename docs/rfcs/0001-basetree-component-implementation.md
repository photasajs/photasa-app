# RFC 0011: BaseTree Component Implementation

- **RFC**: 0011
- **Title**: BaseTree Component Implementation
- **Author**: Claude
- **Status**: Draft 📝
- **Type**: Feature  
- **Created**: 2025-09-10
- **Updated**: 2025-09-10

## Summary

Implement a BaseTree component to replace ant-design-vue's a-tree component, enabling migration away from external UI library dependencies while maintaining 100% API compatibility and adding virtual scrolling for optimal performance with large photo folder hierarchies.

## Motivation

### Current Issues

1. **Dependency Reduction**: Part of RFC 0002 Headless UI migration strategy to eliminate ant-design-vue dependency
2. **Performance Requirements**: Photo management requires handling 10,000+ folder nodes efficiently
3. **Virtual Tree Need**: Unlike flat lists, we need virtualized tree rendering for hierarchical folder structures
4. **API Compatibility**: Must maintain seamless migration from existing a-tree usage

### Use Case Analysis

**FolderList.vue current usage:**
```vue
<a-tree
  class="folder-tree"
  v-model:expandedKeys="expandedKeys"
  v-model:selectedKeys="selectedKeys"
  :tree-data="folderTree"
>
  <template #title="{ title, key }">
    <BaseContextMenu>
      <span>{{ title }}</span>
      <template #menu="{ close }">
        <!-- Right-click menu items -->
      </template>
    </BaseContextMenu>
  </template>
</a-tree>
```

## Detailed Design

### Component Architecture

```
BaseTree (主组件)
├── Virtual scrolling logic
├── Tree data flattening
├── State management
└── Event handling

BaseTreeNode (渲染节点)  
├── Node rendering
├── Indentation handling
├── Interaction handling
└── Slot forwarding
```

### API Compatibility

**Complete a-tree API support:**

```typescript
interface BaseTreeProps {
  // Core Data
  treeData?: DataNode[]
  
  // State Control (v-model support)
  expandedKeys?: Key[]
  selectedKeys?: Key[]
  checkedKeys?: Key[] | CheckedKeys
  
  // Behavior
  multiple?: boolean
  checkable?: boolean
  selectable?: boolean
  showIcon?: boolean
  showLine?: boolean | { showLeafIcon: boolean }
  disabled?: boolean
  
  // Defaults
  defaultExpandAll?: boolean
  defaultExpandParent?: boolean
  autoExpandParent?: boolean
  defaultExpandedKeys?: Key[]
  defaultSelectedKeys?: Key[]
  defaultCheckedKeys?: Key[]
  
  // Virtual Scrolling (Enhanced)
  virtual?: boolean
  height?: number
  itemHeight?: number
  
  // Advanced
  checkStrictly?: boolean
  draggable?: boolean
  blockNode?: boolean
  focusable?: boolean
  
  // Field Mapping
  fieldNames?: FieldNames
  replaceFields?: FieldNames
}
```

**Event Compatibility:**
```typescript
interface BaseTreeEmits {
  // v-model updates
  'update:expandedKeys': [keys: Key[]]
  'update:selectedKeys': [keys: Key[]]
  'update:checkedKeys': [keys: Key[]]
  
  // User interactions  
  expand: [keys: Key[], info: ExpandInfo]
  select: [keys: Key[], info: SelectInfo]
  check: [keys: Key[], info: CheckInfo]
  
  // Additional events
  click: [info: NodeMouseEventParams]
  rightClick: [info: RightClickInfo]
  doubleclick: [info: NodeMouseEventParams]
}
```

### Virtual Tree Implementation

**Core Innovation: Flatten-Render-Virtual Pattern**

```typescript
interface VirtualTreeNode {
  key: Key
  title: string
  level: number          // Indentation level
  isVisible: boolean     // Should render (parent expanded)
  hasChildren: boolean   // Show expand/collapse icon
  isExpanded: boolean    // Current expand state
  originalNode: DataNode // Reference to original
}
```

**Rendering Strategy:**
1. **Flatten Phase**: Convert tree to flat array with visibility flags
2. **Filter Phase**: Only include visible nodes (parent expanded)
3. **Virtual Phase**: Use VirtualList on filtered flat nodes
4. **Render Phase**: Apply level-based indentation

```vue
<VirtualList :items="visibleFlatNodes" :item-height="28">
  <template #default="{ item }">
    <BaseTreeNode 
      :node="item"
      :level="item.level"
      :style="{ paddingLeft: item.level * 20 + 'px' }"
    />
  </template>
</VirtualList>
```

### Slot System

**Compatible slot forwarding:**
```vue
<!-- BaseTree.vue -->
<BaseTreeNode>
  <template #title="slotProps">
    <slot name="title" v-bind="slotProps" />
  </template>
  <template #icon="slotProps">
    <slot name="icon" v-bind="slotProps" />
  </template>
</BaseTreeNode>
```

**Enable existing usage:**
```vue
<BaseTree>
  <template #title="{ title, key, node }">
    <BaseContextMenu>
      <span>{{ title }}</span>
      <!-- Right-click menu preserved -->
    </BaseContextMenu>
  </template>
</BaseTree>
```

### Performance Optimizations

1. **Virtual Scrolling**: Only render visible ~20 nodes regardless of total count
2. **Efficient Flattening**: O(n) tree traversal with memoization
3. **Smart Reactivity**: Only re-flatten when tree structure changes
4. **DOM Recycling**: VirtualList reuses DOM elements

**Performance Targets:**
- ✅ Handle 50,000+ nodes smoothly
- ✅ Expand/collapse < 16ms (60fps)
- ✅ Memory usage scales with viewport, not data size

### Migration Strategy

**Phase 1: Drop-in Replacement**
```diff
- <a-tree
+ <BaseTree
    class="folder-tree"
    v-model:expandedKeys="expandedKeys"
    v-model:selectedKeys="selectedKeys"
    :tree-data="folderTree"
  >
```

**Phase 2: Enable Virtual Scrolling**
```vue
<BaseTree
  :virtual="true"
  :height="600"
  :item-height="28"
  <!-- other props unchanged -->
>
```

**Phase 3: Remove ant-design-vue Dependency**
- Update package.json
- Remove unused imports
- Verify all functionality

## Implementation Plan

### File Structure
```
src/renderer/src/components/ui/
├── BaseTree.vue          # Main component
├── BaseTreeNode.vue      # Node renderer  
└── __tests__/
    ├── BaseTree.test.ts  # Unit tests
    └── tree-performance.test.ts # Performance tests
```

### Development Phases

**Phase 1: Core Implementation** (2-3 days)
- [ ] BaseTree component with basic rendering
- [ ] BaseTreeNode component  
- [ ] Tree flattening and virtual rendering
- [ ] Basic expand/collapse/select

**Phase 2: Full API Compatibility** (1-2 days)
- [ ] All a-tree props support
- [ ] All event handlers
- [ ] Slot system compatibility
- [ ] Edge case handling

**Phase 3: Performance & Polish** (1 day)
- [ ] Virtual scrolling optimization
- [ ] Comprehensive testing
- [ ] Performance benchmarks
- [ ] Documentation

**Phase 4: Migration** (0.5 day)
- [ ] Update FolderList.vue
- [ ] Remove a-tree imports
- [ ] Verify functionality

## Testing Strategy

### Unit Tests
- Tree flattening algorithms
- Event handling
- State management
- API compatibility

### Integration Tests  
- FolderList.vue integration
- Right-click menu preservation
- Folder navigation functionality

### Performance Tests
- Large dataset rendering (10k+ nodes)
- Memory usage measurement
- Scrolling performance
- Expand/collapse responsiveness

## Risks and Mitigation

### Risk 1: Performance Regression
**Mitigation**: Comprehensive benchmarking against a-tree before migration

### Risk 2: Feature Gaps
**Mitigation**: Complete API compatibility matrix and systematic testing

### Risk 3: Visual Differences
**Mitigation**: CSS variables and theming to match existing appearance

### Risk 4: Complex Integration
**Mitigation**: Gradual migration with fallback to a-tree if issues arise

## Success Criteria

- [ ] ✅ 100% API compatibility with a-tree
- [ ] ✅ Seamless FolderList.vue migration
- [ ] ✅ Performance improvement for large datasets
- [ ] ✅ Reduced bundle size (remove ant-design-vue)
- [ ] ✅ All existing functionality preserved
- [ ] ✅ Virtual scrolling handles 50k+ nodes smoothly

## References

- [RFC 0002: Headless UI Components](./0002-headless-ui-components.md)
- [ant-design-vue Tree Documentation](https://antdv.com/components/tree)
- [Vue VirtualList Implementation](../src/renderer/src/components/ui/VirtualList.vue)

---

**Next Steps:**
1. Review and approve this RFC
2. Begin Phase 1 implementation
3. Create performance benchmarks
4. Implement comprehensive test suite