# RFC 0002: Headless UI Components for Picasa Vue

- **RFC**: 0002
- **Title**: Headless UI Components for Picasa Vue
- **Author**: Picasa Vue Team
- **Status**: Implemented
- **Type**: Feature
- **Created**: 2025-01-27
- **Updated**: 2025-01-27
- **Implementation Status**: ✅ Phase 1 Complete
- **Next Steps**: Begin Phase 2 - Form Components

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

### Phase 2: Form Components
- Create Headless versions of form components
- BaseInput, BaseButton, BaseCheckbox, BaseSwitch
- Maintain consistent API patterns

### Phase 3: Complex Components
- BaseDropdown, BaseTabs, BaseCard
- Remove Ant Design dependencies gradually
- Ensure full TailwindCSS styling control

### Phase 4: Specialized Components
- VirtualizedGrid, BaseImage, BaseNotification
- Desktop-specific optimizations
- Performance improvements

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

## Conclusion

This custom Headless UI component library solves our immediate Portal compatibility issues while providing a solid foundation for future development. The Vue-native design ensures optimal performance and maintainability for our desktop application.

---
