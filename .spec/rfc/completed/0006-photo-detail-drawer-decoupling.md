# RFC 0006: Photo Detail Drawer Decoupling from Ant Design

- **Status**: 已实现
- **Start Date**: 2025-01-06
- **Implementation Date**: 2025-01-09
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)

## Summary

Decouple the photo detail drawer component from Ant Design dependencies to create a more maintainable, customizable, and lightweight UI component that aligns with the project's headless UI architecture goals.

## Motivation

The current photo detail drawer implementation is tightly coupled with Ant Design components. This creates several challenges:

1. **Bundle Size**: Ant Design components add significant weight to the application bundle
2. **Customization Limitations**: Ant Design's opinionated styling makes it difficult to achieve custom designs
3. **Consistency**: As we move towards headless UI components (RFC 0002), having Ant Design dependencies creates inconsistency
4. **Maintenance**: Updates to Ant Design may introduce breaking changes or unwanted behavior changes
5. **Performance**: Ant Design components may include unnecessary features that impact performance

## Detailed Design

### Current State Analysis

The photo detail drawer currently uses:

- Ant Design Drawer component for the sliding panel
- Potentially other Ant Design components for internal UI elements

### Proposed Architecture

#### 1. Custom Drawer Component

Create a new `BaseDrawer.vue` component with:

```typescript
interface BaseDrawerProps {
    modelValue: boolean; // v-model support
    position?: "left" | "right" | "top" | "bottom";
    size?: string | number; // width for left/right, height for top/bottom
    mask?: boolean; // show backdrop
    maskClosable?: boolean;
    closeOnEsc?: boolean;
    zIndex?: number;
    teleport?: string | boolean; // teleport target
}
```

#### 2. Implementation Strategy

**Phase 1: Path Handling Refactor**

- Move file path processing from UI layer to main process
- Update `getImageType` API to handle file:// protocol internally
- Align with existing image extractors in main process (`src/main/import/metadata/extractors/image-extractor.ts`)
- Ensure consistent path handling across all image operations

**Phase 2: Create Base Components**

- Implement `BaseDrawer.vue` with core functionality
- Use Vue 3 Composition API and Teleport for portal rendering
- Implement focus trap and keyboard navigation
- Add smooth animations using CSS transitions
- Create custom loading spinner (`BaseSpinner.vue`) to replace `a-spin`
- Create custom description list component (`BaseDescriptions.vue`) to replace `a-descriptions`

**Phase 3: Redesign Photo Detail UI**

- Create `PhotoDetailDrawer.vue` using `BaseDrawer`
- Design custom metadata display components without Ant Design dependencies
- Implement structured data layout with proper semantic HTML
- Maintain JSON tree view functionality using existing `JsonTreeView`
- Ensure responsive design and accessibility compliance

**Phase 4: Integration and Cleanup**

- Replace Ant Design drawer in ImageList.vue
- Update all related components and tests
- Remove ant-design-vue dependency from package.json
- Clean up CSS imports and theme patches
- Performance testing and optimization

### Technical Implementation Details

#### Path Handling Refactor

Current implementation processes paths in the UI layer:

```typescript
// Current: ImageList.vue
const path = `${trim(image.raw, "file:/")}`;
const info = await getImageType(path);
```

Proposed improvement - handle in preload/main:

```typescript
// Updated: preload/image-helper.ts
export async function getImageType(fileUrl: string): Promise<ImageInfo> {
    // Handle file:// protocol internally
    const path = fileUrl.startsWith("file://") ? fileUrl.replace(/^file:\/\//, "") : fileUrl;

    const buffer = await readChunk(path, { length: minimumBytes });
    const tags = await getExifInfo(path);
    const result = await imageType(buffer);
    return {
        imageType: (result ?? "unknown") as ImageTypeResult,
        tags,
    };
}

// Simplified UI layer call:
const info = await getImageType(image.raw); // Direct file:// URL
```

#### Main Process Alignment

Align with existing image extractor pattern (`src/main/import/metadata/extractors/image-extractor.ts`):

- Consistent error handling
- Standardized metadata structure
- Unified file type detection
- Performance optimization for batch operations

#### Component Architecture

**BaseDrawer.vue** - Core drawer functionality

```typescript
interface BaseDrawerProps {
    modelValue: boolean;
    position?: "left" | "right" | "top" | "bottom";
    size?: string | number;
    mask?: boolean;
    maskClosable?: boolean;
    closeOnEsc?: boolean;
    zIndex?: number;
    teleport?: string | boolean;
}
```

**BaseSpinner.vue** - Loading indicator

```typescript
interface BaseSpinnerProps {
    spinning: boolean;
    size?: "small" | "default" | "large";
    tip?: string;
}
```

**BaseDescriptions.vue** - Metadata display

```typescript
interface BaseDescriptionsProps {
    title?: string;
    layout?: "horizontal" | "vertical";
    bordered?: boolean;
    column?: number;
}

interface BaseDescriptionItemProps {
    label: string;
    span?: number;
}
```

**PhotoDetailDrawer.vue** - Composed photo detail view

- Uses BaseDrawer for container
- Uses BaseSpinner for loading states
- Uses BaseDescriptions for structured metadata
- Maintains JsonTreeView for full EXIF data
- Custom responsive layout without Ant Design grid

#### Animation System

```css
/* Slide animations */
.drawer-slide-right-enter-active,
.drawer-slide-right-leave-active {
    transition: transform 0.3s cubic-bezier(0.7, 0.3, 0.1, 1);
}

.drawer-slide-right-enter-from {
    transform: translateX(100%);
}

.drawer-slide-right-leave-to {
    transform: translateX(100%);
}
```

#### Accessibility Features

- ARIA attributes: `role="dialog"`, `aria-modal="true"`
- Focus management: trap focus within drawer
- Keyboard support: ESC to close, Tab cycling
- Screen reader announcements

#### State Management

```typescript
const useDrawer = () => {
    const isOpen = ref(false);
    const contentRef = ref<HTMLElement>();

    const open = () => {
        isOpen.value = true;
    };
    const close = () => {
        isOpen.value = false;
    };
    const toggle = () => {
        isOpen.value = !isOpen.value;
    };

    // Focus trap logic
    useFocusTrap(contentRef, isOpen);

    // Keyboard handling
    useKeyboard({
        Escape: () => isOpen.value && close(),
    });

    return { isOpen, open, close, toggle, contentRef };
};
```

### Testing Strategy

1. **Unit Tests**
    - Component rendering
    - Props validation
    - Event emissions
    - Slot content rendering

2. **Integration Tests**
    - Animation transitions
    - Focus management
    - Keyboard interactions
    - Scroll locking

3. **Visual Regression Tests**
    - Different positions
    - Various content sizes
    - Responsive behavior

## Drawbacks

1. **Development Time**: Creating custom components requires initial investment
2. **Maintenance Burden**: We need to maintain our own drawer implementation
3. **Feature Parity**: May miss some advanced Ant Design features initially
4. **Testing Requirements**: Need comprehensive test coverage for custom components

## Alternatives

### Alternative 1: Headless UI Libraries

Use headless libraries like Headless UI or Radix Vue:

- **Pros**: Battle-tested, accessible, minimal styling
- **Cons**: Still external dependencies, may not fit all needs

### Alternative 2: Gradual Migration

Keep Ant Design for now, migrate component by component:

- **Pros**: Lower risk, can be done incrementally
- **Cons**: Prolongs dependency, inconsistent codebase

### Alternative 3: Different UI Library

Switch to a lighter library like Naive UI or Element Plus:

- **Pros**: Potentially smaller bundle, modern architecture
- **Cons**: Still vendor lock-in, migration effort similar

## Implementation Plan

### Phase 1: Path Handling Refactor (Week 1)

- [x] Update `preload/image-helper.ts` to handle file:// protocol internally
- [x] Examine and align with `src/main/import/metadata/extractors/image-extractor.ts`
- [x] Simplify path processing in `ImageList.vue`
- [x] Add tests for path handling edge cases
- [x] Validate cross-platform file path compatibility

### Phase 2: Base Components Creation (Week 2)

- [x] Implement `BaseDrawer.vue` with Vue 3 Composition API
- [x] Create `BaseSpinner.vue` loading component
- [x] Implement `BaseDescriptions.vue` metadata display
- [x] Add focus trap and keyboard navigation
- [x] Implement smooth CSS animations
- [x] Add comprehensive unit tests for all base components

### Phase 3: Photo Detail UI Redesign (Week 3)

- [x] Create `FileInfoDrawer.vue` using base components (renamed from PhotoDetailDrawer)
- [x] Design responsive metadata layout without Ant Design
- [x] Integrate existing JsonTreeView component
- [x] Ensure WCAG 2.1 AA accessibility compliance
- [x] Add visual regression tests

### Phase 4: Integration and Cleanup (Week 4)

- [x] Replace Ant Design drawer in `ImageList.vue`
- [x] Update component imports and dependencies
- [ ] Remove ant-design-vue from package.json (partially done - still used by other components)
- [x] Clean up CSS imports and theme patches
- [x] Performance testing and bundle size analysis
- [x] Update existing tests and add integration tests

## Success Metrics

1. **Bundle Size Reduction**: At least 20% reduction in vendor bundle (removing ant-design-vue)
2. **Path Handling**: Clean separation of concerns - no path manipulation in UI layer
3. **Performance**: Drawer open/close animation at 60fps
4. **Accessibility**: WCAG 2.1 AA compliance with proper ARIA attributes
5. **Test Coverage**: >90% unit test coverage for all new components
6. **Zero Regression**: All existing features work as expected
7. **Main Process Alignment**: Consistent with existing image extractor patterns
8. **Code Quality**: ESLint and TypeScript compliance, proper error handling

## Unresolved Questions

1. Should we create a general modal/overlay system that drawer can extend?
2. How do we handle nested drawers if needed in the future?
3. Should we implement swipe gestures for mobile/touch devices?
4. Do we need to support drawer resizing functionality?
5. Should this be part of the larger headless UI component library (RFC 0002)?
6. Should we align the metadata extraction API with the main process extractor to use the same data structures?
7. Do we need to handle different image metadata formats (EXIF, XMP, IPTC) with specific UI layouts?
8. Should we implement progressive loading for large EXIF datasets to improve performance?

## Implementation Summary

### What Was Actually Implemented (2025-01-09)

1. **BaseDrawer Component** (`src/renderer/src/components/ui/BaseDrawer.vue`)
    - ✅ Full Vue 3 Composition API implementation
    - ✅ Teleport to body with proper z-index management
    - ✅ Multiple placement support (left, right, top, bottom)
    - ✅ Focus trap and keyboard navigation (ESC to close)
    - ✅ ARIA attributes for accessibility
    - ✅ Smooth CSS transitions

2. **Supporting Base Components**
    - ✅ `BaseSpinner.vue` - Custom loading component
    - ✅ `BaseDescriptions.vue` and `BaseDescriptionItem.vue` - Metadata display
    - ✅ Complete unit test coverage

3. **FileInfoDrawer Implementation**
    - ✅ `FileInfoDrawer.vue` - Photo detail drawer using BaseDrawer
    - ✅ Rich metadata display with toggle for raw data
    - ✅ Responsive design without Ant Design dependencies
    - ✅ Integration with existing JsonTreeView component

4. **Integration Success**
    - ✅ Successfully replaced Ant Design drawer in `ImageList.vue`
    - ✅ All existing functionality preserved
    - ✅ Improved performance and customizability

### Partial Implementation

- **Package Cleanup**: `ant-design-vue` remains in package.json as it's still used by other components like `DuplicateHandler.vue`. Complete removal will require migrating all remaining Ant Design components.

### Key Achievements

1. **Zero Breaking Changes**: All existing features work exactly as before
2. **Improved Accessibility**: Better ARIA support and keyboard navigation
3. **Better Performance**: Reduced bundle size for drawer-related functionality
4. **Enhanced Customizability**: Full control over styling and behavior
5. **Architecture Alignment**: Follows the headless UI pattern from RFC 0002

The implementation successfully achieves the primary goals of the RFC while demonstrating that the headless UI approach is viable for complex components like drawers.

## References

- [RFC 0002: Headless UI Components](./0002-headless-ui-components.md)
- [Vue 3 Teleport Documentation](https://vuejs.org/guide/built-ins/teleport.html)
- [WAI-ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog/)
- [Focus Trap Implementation](https://github.com/focus-trap/focus-trap)
