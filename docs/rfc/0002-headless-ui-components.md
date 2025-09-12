# RFC 0002: Headless UI Components for Picasa Vue

- **RFC**: 0002
- **Title**: Headless UI Components for Picasa Vue
- **Author**: Picasa Vue Team
- **Status**: Phase 2 In Progress 🚧
- **Type**: Feature
- **Created**: 2025-01-27
- **Updated**: 2025-09-09
- **Implementation Status**: ✅ Phase 1 Complete | ✅ Phase 2 Core Components Complete | ⚡ Phase 3 Accelerated Migration
- **Current Focus**: 🎯 **36 BaseUI Components Complete** | **188/222 Ant Instances Remain** (-34 进展) | Ready for Mass Migration

## Summary

Design and implement a custom Headless UI component library specifically for Vue 3 and desktop applications, replacing third-party libraries (HeadlessUI, Ant Design) that cause compatibility issues with our Portal architecture.

## Motivation

### Problems with Current Architecture

1. **HeadlessUI Dialog + Vue Teleport Conflicts**
   - HeadlessUI has its own Portal system that conflicts with Vue's Teleport
   - Mouse events in Portal/Teleport content are intercepted and blocked
   - BaseSelect component fails to respond to mouse clicks when inside HeadlessUI modals

2. **Library Compatibility Issues**
   - HeadlessUI is primarily designed for React, Vue version has adaptation issues
   - Ant Design brings unnecessary mobile-first overhead for desktop apps
   - Event handling conflicts between different Portal implementations

3. **Bundle Size and Dependencies**
   - Multiple UI libraries increase bundle size
   - Unnecessary features for desktop-only applications
   - Dependency conflicts and maintenance overhead

## Detailed Design

### Core Principles

1. **Headless Architecture**
   - Components provide only logic, behavior, and accessibility
   - Zero built-in styles, completely styled via TailwindCSS
   - Users have full control over appearance

2. **Vue-Native Design**
   - Built specifically for Vue 3 Composition API
   - Leverages Vue's reactivity system optimally
   - No adaptation layers or compatibility shims

3. **Portal-Friendly**
   - Native support for Vue Teleport
   - No event interception or conflicts
   - Seamless integration with existing Portal architecture

4. **Component Composition**
   - Small, single-responsibility components
   - Composable architecture for flexibility
   - Consistent API patterns across components

### Component Architecture

#### Modal System Components

```typescript
// Root container - handles Portal, focus management, keyboard events
BaseModal: {
  props: { open: boolean }
  emits: { close: void }
  features: ['focus-trap', 'scroll-lock', 'keyboard-navigation']
}

// Headless sub-components with full style control
BaseModalOverlay: { class?, style?, ...attrs }
BaseModalContainer: { class?, style?, ariaLabelledby?, ...attrs }
BaseModalHeader: { class?, style?, ...attrs }
BaseModalTitle: { title?, id?, class?, ...attrs, slot }
BaseModalBody: { class?, style?, ...attrs }
BaseModalFooter: { class?, style?, ...attrs }
BaseModalCloseButton: { ariaLabel?, showIcon?, class?, ...attrs }
```

#### Usage Examples

```vue
<!-- Simple usage with props -->
<BaseModal :open="show" @close="show = false">
  <BaseModalOverlay class="fixed inset-0 bg-black/50" />
  <BaseModalContainer class="max-w-md bg-white rounded-lg shadow-xl">
    <BaseModalHeader class="p-6 border-b">
      <BaseModalTitle title="Confirm Delete" class="text-lg font-semibold" />
      <BaseModalCloseButton class="text-gray-400 hover:text-gray-600" />
    </BaseModalHeader>
    <BaseModalBody class="p-6">
      Are you sure you want to delete this item?
    </BaseModalBody>
    <BaseModalFooter class="p-6 border-t flex justify-end space-x-3">
      <BaseButton @click="show = false">Cancel</BaseButton>
      <BaseButton @click="handleDelete">Delete</BaseButton>
    </BaseModalFooter>
  </BaseModalContainer>
</BaseModal>

<!-- Complex usage with slots -->
<BaseModal :open="show" @close="show = false">
  <BaseModalOverlay class="fixed inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20" />
  <BaseModalContainer class="max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
    <BaseModalHeader class="p-6 border-b border-gray-200 dark:border-gray-700">
      <BaseModalTitle class="text-xl font-bold text-gray-900 dark:text-white flex items-center">
        <Icon class="mr-3 text-blue-500" />
        Complex Modal Title
      </BaseModalTitle>
      <BaseModalCloseButton class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
    </BaseModalHeader>
    <BaseModalBody class="p-6 space-y-4">
      <!-- Complex content with forms, lists, etc. -->
    </BaseModalBody>
  </BaseModalContainer>
</BaseModal>
```

### Technical Implementation

#### Props and Attributes Pattern

All components follow this pattern:
- Accept `class` and `style` props for styling
- Support attribute pass-through via `v-bind="$attrs"`
- Disable automatic attribute inheritance with `inheritAttrs: false`
- Provide reasonable default behaviors while allowing full customization

#### Focus Management

```typescript
// BaseModal handles focus management
const manageFocus = () => {
  if (props.open) {
    // Save current focus
    previousActiveElement.value = document.activeElement as HTMLElement
    // Move focus to modal
    nextTick(() => modalRef.value?.focus())
  } else {
    // Restore previous focus
    previousActiveElement.value?.focus()
  }
}
```

#### Event Handling

```typescript
// Clean event delegation without conflicts
const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === modalRef.value) {
    handleClose()
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    handleClose()
  }
}
```

## Migration Strategy

### Phase 1: Core Modal System ✅
- Replace HeadlessUI Dialog with custom BaseModal components
- Ensure BaseSelect works properly in modals
- Maintain API compatibility where possible

### Phase 2: Core Components ✅ COMPLETED
- ✅ BaseProgress - 支持线性、圆形、仪表盘三种类型
- ✅ BaseAccordion/BaseAccordionPanel - 折叠面板系统
- ✅ BaseStatistic - 统计数字展示
- ✅ BaseRow/BaseCol - 24栅格布局系统
- ✅ BaseSpace - 间距控制
- ✅ BaseTag - 标签展示

### Phase 3: High-Priority Components 🚧 IN PROGRESS
- 🔄 BaseList - 列表组件
- 🔄 BaseForm/BaseFormField - 表单组件
- 🔄 BaseTable - 表格组件
- 🔄 BaseBadge - 徽章组件

### Phase 4: File Migration 🚧 IN PROGRESS
- 🔄 FileFilter.vue (41个组件) - 高优先级
- 🔄 DuplicateHandler.vue (49个组件) - 高优先级
- 🔄 FilePreview.vue (43个组件) - 高优先级
- 🔄 ProgressMonitor.vue (27个组件) - 高优先级

### Phase 5: Complete Removal
- Remove Ant Design dependencies
- Clean up antd-theme-patch.css
- Performance optimization

## Benefits

### Immediate Benefits
1. **Fixed Portal Conflicts**: BaseSelect now works in modals
2. **Reduced Bundle Size**: No HeadlessUI dependency
3. **Better Performance**: Vue-native implementation
4. **Full Style Control**: Complete TailwindCSS customization

### Long-term Benefits
1. **Maintainability**: No third-party compatibility issues
2. **Flexibility**: Components adapt exactly to our needs
3. **Performance**: Desktop-optimized, no mobile overhead
4. **Consistency**: Unified API patterns across all components

## Alternatives Considered

1. **Fix HeadlessUI Issues**: Attempted but proved unstable and unmaintainable
2. **Switch to Different UI Library**: Would face similar adaptation issues
3. **Fork HeadlessUI**: Too much maintenance overhead
4. **Use Native HTML Elements**: Lacks accessibility and complex behavior support

## Testing Strategy

1. **Unit Tests**: Each component tested in isolation
2. **Integration Tests**: Modal + BaseSelect interaction testing
3. **Accessibility Tests**: Screen reader and keyboard navigation
4. **Visual Tests**: TailwindCSS styling in different themes
5. **Performance Tests**: Desktop application scenarios

## Documentation

1. **Component API Documentation**: Props, slots, events for each component
2. **Usage Examples**: Common patterns and advanced use cases
3. **Migration Guide**: From HeadlessUI/Ant Design to custom components
4. **Best Practices**: TailwindCSS styling patterns and accessibility guidelines

## 🚀 Phase 2: Sophisticated Complex Components

### Current Status & Goals

**Phase 1 Achievements** ✅
- 25 core components implemented (Modal, Button, Input, Select, etc.)
- Portal compatibility resolved
- Basic headless architecture established
- TailwindCSS styling patterns defined

**Phase 2 Objectives** 🎯
- **Complete Ant Design removal** - Zero dependencies on ant-design
- **Sophisticated component suite** - Advanced form, data, and interaction components
- **Enterprise-grade features** - Validation, accessibility, performance optimization
- **Developer experience** - Rich TypeScript support, comprehensive documentation

### Phase 2 Component Architecture

#### 🔥 **Priority 1: Form System** (Week 1-2)

```typescript
// Advanced Form Management with Validation
BaseForm: {
  props: { schema?: ZodSchema, validateOn?: 'blur' | 'change' | 'submit' }
  emits: { submit: FormData, error: ValidationError[] }
  features: ['auto-validation', 'field-dependency', 'async-validation']
}

BaseFormField: {
  props: { name: string, rules?: ValidationRule[], required?: boolean }
  features: ['error-display', 'help-text', 'field-state-management']
}

BaseFormGroup: {
  props: { legend?: string, orientation?: 'horizontal' | 'vertical' }
  features: ['field-grouping', 'conditional-rendering']
}
```

**Usage Example:**
```vue
<BaseForm @submit="handleSubmit" :schema="userSchema">
  <BaseFormField name="email" required>
    <BaseInput type="email" placeholder="Enter email" />
  </BaseFormField>

  <BaseFormField name="preferences">
    <BaseFormGroup legend="Notification Settings">
      <BaseCheckbox name="emailNotifications">Email notifications</BaseCheckbox>
      <BaseCheckbox name="pushNotifications">Push notifications</BaseCheckbox>
    </BaseFormGroup>
  </BaseFormField>
</BaseForm>
```

#### 🔥 **Priority 2: Data Display Components** (Week 3-4)

```typescript
// Advanced Data Table with Virtual Scrolling
BaseTable: {
  props: {
    data: T[], columns: TableColumn<T>[],
    virtualScroll?: boolean, sortable?: boolean,
    selectable?: 'single' | 'multiple' | false
  }
  features: ['virtual-scrolling', 'sorting', 'filtering', 'selection-management']
}

BaseTree: {
  props: {
    data: TreeNode[], expandable?: boolean,
    selectable?: boolean, searchable?: boolean
  }
  features: ['lazy-loading', 'drag-drop', 'keyboard-navigation']
}

BasePagination: {
  props: {
    total: number, pageSize: number, current: number,
    showSizeChanger?: boolean, showQuickJumper?: boolean
  }
  features: ['size-options', 'quick-navigation', 'info-display']
}
```

#### 🔥 **Priority 3: Advanced Input Components** (Week 5-6)

```typescript
// Sophisticated Date/Time Components
BaseDatePicker: {
  props: {
    value?: Date, format?: string, range?: boolean,
    disabledDates?: (date: Date) => boolean
  }
  features: ['keyboard-input', 'calendar-popup', 'time-selection', 'range-selection']
}

BaseAutocomplete: {
  props: {
    options: Option[], async?: boolean,
    filterFunction?: (query: string, options: Option[]) => Option[]
  }
  features: ['async-loading', 'custom-filtering', 'keyboard-navigation', 'highlight-matches']
}

BaseCombobox: {
  props: {
    options: Option[], multiple?: boolean, creatable?: boolean
  }
  features: ['multi-select', 'tag-input', 'option-creation', 'custom-option-rendering']
}

BaseSlider: {
  props: {
    min: number, max: number, step?: number,
    range?: boolean, marks?: SliderMark[]
  }
  features: ['range-selection', 'custom-marks', 'tooltip-display', 'keyboard-control']
}
```

#### 🔥 **Priority 4: Layout & Navigation** (Week 7-8)

```typescript
// Advanced Layout Components
BaseAccordion: {
  props: {
    items: AccordionItem[], multiple?: boolean,
    defaultOpen?: string | string[]
  }
  features: ['multiple-expansion', 'controlled-expansion', 'animation-support']
}

BaseBreadcrumb: {
  props: {
    items: BreadcrumbItem[], separator?: string | VNode,
    maxItems?: number
  }
  features: ['overflow-handling', 'custom-separators', 'click-navigation']
}

BaseTooltip: {
  props: {
    content: string | VNode, placement?: TooltipPlacement,
    trigger?: 'hover' | 'click' | 'focus'
  }
  features: ['smart-positioning', 'custom-triggers', 'rich-content']
}

BasePopover: {
  props: {
    content: VNode, placement?: PopoverPlacement,
    trigger?: 'hover' | 'click' | 'manual'
  }
  features: ['focus-management', 'click-outside-close', 'arrow-pointing']
}
```

### Implementation Timeline

| Phase | Component Group | Duration | Deliverables |
|-------|----------------|----------|-------------|
| **2.1** | Form System | 2 weeks | BaseForm, BaseFormField, BaseFormGroup + Validation |
| **2.2** | Data Display | 2 weeks | BaseTable, BaseTree, BasePagination + Virtual Scrolling |
| **2.3** | Advanced Input | 2 weeks | DatePicker, Autocomplete, Combobox, Slider |
| **2.4** | Layout & Navigation | 2 weeks | Accordion, Breadcrumb, Tooltip, Popover |
| **2.5** | Ant Design Removal | 1 week | Complete dependency cleanup + migration |
| **2.6** | Testing & Polish | 1 week | Comprehensive testing + documentation |

**Total Duration: 10 weeks**

### 📊 **Current Ant Design Usage Baseline Analysis**

#### Package Dependencies:
```json
// package.json
"ant-design-vue": "^3.2.20"  // 📦 ~2.1MB bundled
```

#### Direct Imports & Global Usage:
```typescript
// src/renderer/src/main.ts
import Antd from "ant-design-vue";           // 🔥 Global registration
import "ant-design-vue/dist/antd.css";      // 🎨 ~400KB CSS

// Theme & Type Imports
- src/renderer/src/stores/preference.ts     // DataNode type
- src/renderer/src/utils/folder-tree.ts     // Tree DataNode interface
- src/renderer/src/stores/__tests__/preference.spec.ts
- src/renderer/src/utils/__tests__/folder-tree.spec.ts
```

#### Component Usage Analysis (20 Vue files affected):

**📈 High Usage Files (Need Priority Migration):**

```typescript
// BatchProgress.vue - 47 components
a-button(14), a-col(8), a-tag(4), a-statistic(4), a-progress(3),
a-tooltip(2), a-space(2), a-row(2), a-modal(2), a-collapse(4), a-alert(2)

// App.vue - 41 components
a-layout(8), a-layout-content(4), a-spin(4), a-modal(4),
a-list(2), a-list-item(2), a-button(2)

// DuplicateHandler.vue - ~30 components
a-modal, a-table, a-button, a-select, a-checkbox, a-space, a-divider

// FileFilter.vue - ~25 components
a-form, a-form-item, a-input, a-select, a-checkbox, a-slider, a-date-picker

// FilePreview.vue - ~20 components
a-table, a-tag, a-button, a-tooltip, a-progress, a-modal
```

**📊 Medium Usage Files:**
- `ProgressMonitor.vue` - Progress, Spin, Alert components
- `GeneralSettings.vue` - Form, Switch, Select components
- `ImageList.vue` - List, Card, Button components
- `FolderList.vue` - Tree, Button, Tooltip components
- `TitlebarWinLinux.vue` - Button, Dropdown components

**🔧 Low Usage Files (UI Components):**
- BaseSelect.vue, BaseModal.vue, BaseDropdown.vue - Styling conflicts
- VirtualList.vue, PortalProvider.vue - Portal integration issues

#### **Total Migration Scope:**

| Category | Count | Components |
|----------|-------|------------|
| **Core Layout** | 3 | Layout, LayoutContent, Header |
| **Form & Input** | 12 | Form, FormItem, Input, Select, Checkbox, Switch, Slider, DatePicker, Upload, AutoComplete |
| **Data Display** | 8 | Table, Tree, List, ListItem, Tag, Statistic, Card, Tooltip |
| **Feedback** | 6 | Modal, Progress, Spin, Alert, Notification, Message |
| **Navigation** | 4 | Button, Dropdown, Breadcrumb, Menu |
| **Layout Utilities** | 5 | Row, Col, Space, Divider, Affix |

**📊 Total: 188 Ant Design component instances across 11 files** ✅ **减少34个实例**

### 📈 最新统计 (2025-09-09) - 迁移进展更新

#### 🏆 高频使用组件 (≥8次)

| 组件类型 | 使用次数 | 替代状态 | 变化 | 优先级 |
|----------|----------|----------|------|--------|
| `a-button` | **32** | ✅ BaseButton已实现 | -1 | 🔄 迁移中 |
| `a-col` | **28** | ✅ BaseCol已实现 | -6 | 🔄 迁移中 |
| `a-descriptions-item` | **24** | ✅ BaseDescriptionItem已实现 | 新增 | 🔄 迁移中 |
| `a-statistic` | **16** | ✅ BaseStatistic已实现 | 不变 | 🔄 迁移中 |
| `a-tooltip` | **12** | ✅ BaseTooltip已实现 | +4 | 🔄 迁移中 |
| `a-tag` | **11** | ✅ BaseTag已实现 | 不变 | 🔄 迁移中 |
| `a-row` | **8** | ✅ BaseRow已实现 | 不变 | 🔄 迁移中 |
| `a-space` | **8** | ✅ BaseSpace已实现 | +2 | 🔄 迁移中 |

#### 🎯 中频使用组件 (4-7次) - 需要立即实现

| 组件类型 | 使用次数 | 替代状态 | 优先级 |
|----------|----------|----------|--------|
| `a-descriptions` | 7 | ✅ BaseDescriptions已实现 | 🔄 中 |
| `a-select` | 5 | ✅ BaseSelect已实现 | 🔄 中 |
| `a-radio` | 4 | 🔄 **需要BaseRadio** | 🔥 高 |
| `a-list-item` | 4 | 🔄 **需要BaseListItem** | 🔥 高 |
| `a-progress` | 4 | ✅ BaseProgress已实现 | 🔄 中 |

#### 🚀 BaseUI组件库状态: **36个组件已实现**

**Modal系统** (8个): BaseModal, BaseModalOverlay, BaseModalContainer, BaseModalHeader, BaseModalTitle, BaseModalBody, BaseModalFooter, BaseModalCloseButton

**表单系统** (5个): BaseButton, BaseInput, BaseCheckbox, BaseSelect, BaseSwitch

**数据展示** (9个): BaseStatistic, BaseTag, BaseProgress, BaseDescriptions, BaseDescriptionItem, BaseTooltip, BaseCard, BaseAccordion, BaseAccordionPanel  

**布局系统** (6个): BaseRow, BaseCol, BaseSpace, BaseBreadcrumb, BaseBreadcrumbItem, BaseDrawer

**交互组件** (8个): BaseDropdown, BaseDropdownItem, BaseContextMenu, BaseMenuItem, BaseSpinner, BaseAlert, BaseImage, BaseNotification

**详细统计报告**: [Ant Design使用情况统计](./issue/20250908-antd-usage-statistics.md)

```typescript
// ⚡ UPDATED 迁移优先级 (基于最新分析)

// Priority 1: 立即实现缺失组件 (Week 1)
BaseList, BaseListItem → 4个实例，DuplicateHandler.vue需要
BaseRadio, BaseRadioGroup → 4个实例，表单选择组件
BaseBadge → ProgressMonitor.vue状态指示器
BaseForm, BaseFormField → FileFilter.vue表单系统

// Priority 2: 高频文件迁移 (Week 2-3)  
DuplicateHandler.vue (49个Ant组件) → 重复文件处理核心功能
FilePreview.vue (43个Ant组件) → 文件预览核心功能
FileFilter.vue (41个Ant组件) → 导入过滤功能

// Priority 3: 中频文件迁移 (Week 4)
BatchProgress.vue (28个Ant组件) → 批量处理进度
ProgressMonitor.vue (27个Ant组件) → 进度监控

// Priority 4: 最终清理 (Week 5)
- 剩余低频文件迁移 (App.vue, GeneralSettings.vue)
- 移除ant-design-vue依赖 (~2.5MB → ~250KB)
- 性能验证和优化

// ✅ 已完成: 36个BaseUI组件 + 显著减少34个Ant实例
```

### Detailed Migration Execution Plan:

| Week | Phase | Files | Ant Components | Custom Components |
|------|-------|-------|----------------|-------------------|
| **9.1** | Core Layout | App.vue | a-layout(8), a-spin(4) | BaseLayout, BaseSpinner |
| **9.2** | Import Forms | FileFilter.vue | a-form, a-form-item, a-input, a-select | BaseForm, BaseFormField, BaseInput, BaseSelect |
| **9.3** | Data Tables | FilePreview.vue, DuplicateHandler.vue | a-table, a-modal, a-button | BaseTable, BaseModal, BaseButton |
| **9.4** | Progress UI | BatchProgress.vue | a-progress, a-collapse, a-statistic | BaseProgress, BaseAccordion, BaseStatistic |
| **9.5** | Settings | GeneralSettings.vue | a-switch, a-checkbox | BaseSwitch, BaseCheckbox |
| **10.1** | Remove Dependencies | package.json, main.ts | Global Antd import | Clean removal |
| **10.2** | CSS Cleanup | antd-theme-patch.css | Ant Design overrides | Custom theme variables |
| **10.3** | Type Cleanup | preference.ts, folder-tree.ts | DataNode types | Custom TreeNode types |
| **10.4** | Final Testing | All files | Bundle analysis | Performance validation |

#### **Expected Bundle Size Impact:**
```typescript
// Before Migration
ant-design-vue: ~2.1MB (bundled)
antd.css: ~400KB
Total Ant Design: ~2.5MB

// After Migration (Estimated)
Custom headless components: ~200KB
TailwindCSS utilities only: ~50KB
Total Custom UI: ~250KB

// Bundle Reduction: ~90% (~2.25MB saved) 🔥
```

### Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Bundle Size Reduction** | -90% (~2.25MB) | ~2.5MB | 🎯 |
| **Component Count** | 45+ components | 25 | 🚧 60% |
| **Ant Design Dependencies** | 0 files | 20+ files, 38 components | 🚧 |
| **Test Coverage** | >90% | TBD | 🎯 |
| **TypeScript Support** | 100% | 95% | 🚧 |

### Developer Experience Improvements

1. **Rich TypeScript Support**
   - Generic component props with full type inference
   - Strict typing for slots and events
   - Auto-completion for TailwindCSS classes

2. **Component Composition Patterns**
   - Render props for maximum flexibility
   - Slot-based composition for complex UIs
   - Composable-based logic sharing

3. **Documentation & Examples**
   - Interactive component playground
   - Real-world usage patterns
   - Migration guides from popular libraries

## Conclusion

Phase 2 will establish Picasa Vue as having one of the most sophisticated headless component libraries in the Vue ecosystem, specifically optimized for desktop applications while maintaining complete control over styling and behavior.

---
