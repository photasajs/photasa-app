# RFC 0003: Ant Design Removal & Migration

- **RFC**: 0003
- **Title**: Ant Design Removal & Migration
- **Author**: Photasa Vue Team
- **Start Date**: 2025-01-21
- **Status**: **In Progress** 🚧
- **Target Release**: v2.2.0
- **Last Updated**: 2025-01-21

## Table of Contents

1. [Summary](#summary)
2. [Motivation](#motivation)
3. [Current State Analysis](#current-state-analysis)
4. [Migration Strategy](#migration-strategy)
5. [Implementation Plan](#implementation-plan)
6. [Component Mapping](#component-mapping)
7. [Testing Strategy](#testing-strategy)
8. [Risk Assessment](#risk-assessment)
9. [Success Metrics](#success-metrics)
10. [Alternatives & Trade-offs](#alternatives--trade-offs)

## Summary

This RFC proposes the **complete removal of Ant Design Vue** from the Photasa application and its replacement with a **modern, headless UI stack** built on Tailwind CSS, Headless UI, and Radix Vue. This migration will improve performance, reduce bundle size, enhance theme customization, and provide better developer experience.

**Key Deliverables:**
- ✅ **Icon replacement completed** (Heroicons + Tabler Icons)
- 🔄 **Component migration** (Priority-based approach)
- 🔄 **Layout system replacement** (Custom CSS Grid/Flexbox)
- 🔄 **Form components** (Headless UI + Custom)
- 🔄 **Data components** (Custom implementations)
- 🔄 **Complete Ant Design removal**

**Current Status: 15% Complete** 🚧

## Motivation

### Current Problems

| Issue | Impact | Severity |
|-------|---------|----------|
| Large bundle size (~857KB CSS + 6.5MB JS) | Slow loading, poor performance | 🔴 High |
| Limited theme customization | Hard to match user preferences | 🟡 Medium |
| Ant Design dependency lock-in | Vendor lock-in, update constraints | 🟡 Medium |
| Inconsistent design language | Mixed UI patterns | 🟡 Medium |
| Heavy component overhead | Unnecessary features, bloat | 🟡 Medium |

### Solution Goals

✅ **Performance**: Reduce bundle size by 30-40%
✅ **Customization**: Full theme control with CSS variables
✅ **Modern Stack**: Headless UI + Tailwind CSS + Radix Vue
✅ **Developer Experience**: Better TypeScript support, cleaner APIs
✅ **Maintainability**: Remove external dependencies, full control

## Current State Analysis

### Ant Design Components Inventory

#### **Layout Components**
- `a-layout` - Main layout container
- `a-layout-content` - Content area
- `a-space` - Spacing utility

#### **UI Components**
- `a-spin` - Loading spinner
- `a-button` - Buttons
- `a-modal` - Modal dialogs
- `a-tag` - Tags/labels
- `a-progress` - Progress bars
- `a-tooltip` - Tooltips
- `a-collapse` - Collapsible panels
- `a-collapse-panel` - Collapse panel items
- `a-alert` - Alert messages
- `a-statistic` - Statistics display
- `a-row` / `a-col` - Grid system
- `a-list` / `a-list-item` - Lists
- `a-typography-text` - Typography

#### **Type Dependencies**
- `DataNode` from `ant-design-vue/lib/tree` - Tree data structure

### Current Usage Distribution

```
App.vue: 15 components
BatchProgress.vue: 25+ components
FilePreview.vue: 8 components
ProgressMonitor.vue: 11 components
Other components: 20+ components
Total: ~80+ Ant Design components
```

## Migration Strategy

### **Phase 1: Foundation (Completed ✅)**
- ✅ Icon replacement with Heroicons + Tabler Icons
- ✅ Remove `@ant-design/icons-vue` dependency

### **Phase 2: Core Components (In Progress 🔄)**
- 🔄 Create custom Button component
- 🔄 Create custom Spinner component
- 🔄 Create custom Tag component
- 🔄 Create custom Alert component

### **Phase 3: Layout System (Planned 📋)**
- 📋 Replace `a-layout` with custom layout
- 📋 Replace `a-space` with Tailwind utilities
- 📋 Replace grid system with CSS Grid/Flexbox

### **Phase 4: Complex Components (Planned 📋)**
- 📋 Replace `a-modal` with Headless UI Dialog
- 📋 Replace `a-collapse` with custom component
- 📋 Replace `a-progress` with custom component
- 📋 Replace `a-tooltip` with Headless UI Tooltip

### **Phase 5: Data Components (Planned 📋)**
- 📋 Replace `a-list` with custom List component
- 📋 Replace `a-statistic` with custom Statistic component
- 📋 Replace `a-tag` with custom Tag component

### **Phase 6: Cleanup (Planned 📋)**
- 📋 Remove `ant-design-vue` dependency
- 📋 Remove Ant Design CSS
- 📋 Update type definitions
- 📋 Final testing and validation

## Implementation Plan

### **Priority 1: High Impact, Easy to Replace**
**Timeline: Week 1-2**

1. **Custom Button Component**
   - File: `src/renderer/src/components/ui/BaseButton.vue`
   - Features: Variants (primary, secondary, danger), sizes, loading state
   - Replacement: All `a-button` instances

2. **Custom Spinner Component**
   - File: `src/renderer/src/components/ui/BaseSpinner.vue`
   - Features: Size variants, color customization
   - Replacement: All `a-spin` instances

3. **Custom Tag Component**
   - File: `src/renderer/src/components/ui/BaseTag.vue`
   - Features: Color variants, closable, custom content
   - Replacement: All `a-tag` instances

4. **Custom Alert Component**
   - File: `src/renderer/src/components/ui/BaseAlert.vue`
   - Features: Types (info, success, warning, error), closable
   - Replacement: All `a-alert` instances

### **Priority 2: Medium Impact, Moderate Complexity**
**Timeline: Week 3-4**

1. **Custom Progress Component**
   - File: `src/renderer/src/components/ui/BaseProgress.vue`
   - Features: Linear/circular, color variants, custom text

2. **Custom Tooltip Component**
   - File: `src/renderer/src/components/ui/BaseTooltip.vue`
   - Features: Position variants, custom content, animations

3. **Custom Statistic Component**
   - File: `src/renderer/src/components/ui/BaseStatistic.vue`
   - Features: Value display, prefix/suffix, loading state

### **Priority 3: High Impact, High Complexity**
**Timeline: Week 5-6**

1. **Custom Layout System**
   - Files: `src/renderer/src/components/layout/`
   - Features: Responsive grid, sidebar, header, footer

2. **Custom Modal System**
   - Files: `src/renderer/src/components/ui/BaseModal.vue`
   - Features: Backdrop, animations, focus management

3. **Custom Collapse Component**
   - Files: `src/renderer/src/components/ui/BaseCollapse.vue`
   - Features: Accordion mode, custom headers, animations

## Component Mapping

### **Direct Replacements**

| Ant Design Component | Custom Component | Status | Priority |
|---------------------|------------------|---------|----------|
| `a-button` | `BaseButton.vue` | 🔄 In Progress | 1 |
| `a-spin` | `BaseSpinner.vue` | 🔄 In Progress | 1 |
| `a-tag` | `BaseTag.vue` | 🔄 In Progress | 1 |
| `a-alert` | `BaseAlert.vue` | 🔄 In Progress | 1 |
| `a-progress` | `BaseProgress.vue` | 📋 Planned | 2 |
| `a-tooltip` | `BaseTooltip.vue` | 📋 Planned | 2 |
| `a-statistic` | `BaseStatistic.vue` | 📋 Planned | 2 |
| `a-modal` | `BaseModal.vue` | 📋 Planned | 3 |
| `a-collapse` | `BaseCollapse.vue` | 📋 Planned | 3 |
| `a-layout` | Custom Layout | 📋 Planned | 3 |

### **Utility Replacements**

| Ant Design Utility | Tailwind/Alternative | Status |
|-------------------|----------------------|---------|
| `a-space` | `flex gap-*` | 📋 Planned |
| `a-row`/`a-col` | CSS Grid/Flexbox | 📋 Planned |
| `a-typography-text` | Custom Typography | 📋 Planned |

## Testing Strategy

### **Unit Testing**
- Test each custom component in isolation
- Verify props, events, and styling
- Test accessibility features (ARIA labels, keyboard navigation)

### **Integration Testing**
- Test component interactions
- Verify theme switching
- Test responsive behavior

### **Visual Regression Testing**
- Compare before/after screenshots
- Ensure no visual regressions
- Validate theme consistency

### **Performance Testing**
- Measure bundle size reduction
- Test loading performance
- Verify runtime performance

## Risk Assessment

### **High Risk**
- **Breaking Changes**: Component API changes may affect existing code
- **Visual Regressions**: Custom components may not match exact Ant Design styling
- **Accessibility**: Custom components must maintain accessibility standards

### **Medium Risk**
- **Development Time**: Migration may take longer than estimated
- **Testing Complexity**: Need to test all component interactions
- **Theme Compatibility**: Ensure new components work with existing themes

### **Low Risk**
- **Bundle Size**: Expected reduction in bundle size
- **Performance**: Expected improvement in performance
- **Maintainability**: Long-term improvement in code maintainability

### **Mitigation Strategies**
- **Incremental Migration**: Replace components one by one
- **Comprehensive Testing**: Test each component thoroughly
- **Fallback Options**: Keep Ant Design temporarily if needed
- **Documentation**: Document all API changes

## Success Metrics

### **Technical Metrics**
- ✅ Bundle size reduction: Target 30-40% reduction
- ✅ Performance improvement: Target 20% faster loading
- ✅ Component count: Replace 80+ Ant Design components
- ✅ Dependency reduction: Remove `ant-design-vue` completely

### **Quality Metrics**
- ✅ Test coverage: Maintain >90% coverage
- ✅ Accessibility: WCAG 2.1 AA compliance
- ✅ Theme support: Full CSS variable integration
- ✅ Responsive design: Mobile-first approach

### **Developer Experience**
- ✅ TypeScript support: Full type safety
- ✅ API consistency: Unified component APIs
- ✅ Documentation: Comprehensive component docs
- ✅ Examples: Usage examples and demos

## Alternatives & Trade-offs

### **Alternative 1: Keep Ant Design**
- ✅ **Pros**: No migration effort, proven stability
- ❌ **Cons**: Large bundle size, limited customization, vendor lock-in

### **Alternative 2: Migrate to Another UI Library**
- ✅ **Pros**: Faster migration, proven components
- ❌ **Cons**: Still have external dependency, may not fit design needs

### **Alternative 3: Custom Component Library (Chosen)**
- ✅ **Pros**: Full control, optimized for our needs, smaller bundle
- ❌ **Cons**: More development time, need to maintain components

### **Alternative 4: Hybrid Approach**
- ✅ **Pros**: Gradual migration, reduced risk
- ❌ **Cons**: Mixed patterns, maintenance complexity

## Implementation Timeline

| Week | Phase | Components | Status |
|------|-------|------------|---------|
| 1-2 | Priority 1 | Button, Spinner, Tag, Alert | 🔄 In Progress |
| 3-4 | Priority 2 | Progress, Tooltip, Statistic | 📋 Planned |
| 5-6 | Priority 3 | Layout, Modal, Collapse | 📋 Planned |
| 7-8 | Priority 4 | List, Data components | 📋 Planned |
| 9-10 | Cleanup | Remove dependencies, final testing | 📋 Planned |

## Next Steps

1. **Complete Priority 1 components** (Week 1-2)
2. **Start Priority 2 components** (Week 3-4)
3. **Plan Priority 3 architecture** (Week 4-5)
4. **Begin complex component migration** (Week 5-6)
5. **Final cleanup and testing** (Week 9-10)

## Conclusion

The Ant Design removal and migration represents a significant architectural improvement for the Photasa application. While the migration effort is substantial, the long-term benefits in terms of performance, customization, and maintainability make this investment worthwhile.

The incremental, priority-based approach minimizes risk while ensuring steady progress toward our goal of a fully custom, modern UI component library.

---

**RFC Status**: In Progress 🚧
**Last Updated**: 2025-01-21
**Next Review**: 2025-01-28
