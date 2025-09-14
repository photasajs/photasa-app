# RFC 0011: ImageList File Count Display

- **Start Date**: 2025-01-09
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)
- **Status**: Draft
- **Author**: Claude (AI Assistant)
- **Assignee**: Development Team
- **Target Release**: v1.7.0

## Summary

Add file count display to the ImageList component header, showing the total number of images and videos in the current folder. This complements RFC 0010 (folder tree statistics) by providing immediate file count feedback in the main content area.

## Motivation

### Current Problem

The ImageList component displays images and videos in the main content area but provides no immediate indication of how many files are present in the current folder. Users must:

1. **Count manually**: Visually estimate the number of items from the grid display
2. **Scroll to see all**: Navigate through the entire list to understand the scope
3. **No distinction**: Cannot easily differentiate between image and video counts

### User Value

1. **Immediate Context**: Users instantly know the scope of content they're browsing
2. **Progress Awareness**: When applying filters or operations, users understand the total dataset
3. **Content Overview**: Quick understanding of folder composition (images vs videos)
4. **Navigation Aid**: Helps users decide whether to continue browsing or switch folders

### Use Cases

1. **Content Management**: "This folder has 150 photos, I should organize them"
2. **Batch Operations**: "Select all 50 images for export"
3. **Quality Assessment**: "Only 5 videos in this folder, might need more content"
4. **Performance Expectations**: "1000+ files, expect longer loading times"

## Detailed Design

### 1. UI Design

#### Header Layout Enhancement

```vue
<!-- Current header structure -->
<div class="px-4 py-2 border-b flex items-center">
  <BaseBreadcrumb>
    <BaseBreadcrumbItem ... />
  </BaseBreadcrumb>
</div>

<!-- Enhanced header with file count -->
<div class="px-4 py-2 border-b flex items-center justify-between">
  <BaseBreadcrumb>
    <BaseBreadcrumbItem ... />
  </BaseBreadcrumb>

  <!-- New: File count display -->
  <div class="file-count-display">
    <FileCountBadge
      :imageCount="imageCount"
      :videoCount="videoCount"
      :isLoading="isDataLoading"
    />
  </div>
</div>
```

#### FileCountBadge Component Design

```vue
<!-- src/renderer/src/components/ui/FileCountBadge.vue -->
<template>
    <div class="file-count-badge" :class="{ loading: isLoading }">
        <div v-if="isLoading" class="loading-state">
            <BaseSpinner size="small" />
            <span class="loading-text">{{ $t("common.counting") }}</span>
        </div>

        <div v-else class="count-display">
            <!-- Total count (always visible) -->
            <div class="total-count">
                <PhFiles class="count-icon" />
                <span class="count-number">{{ totalCount }}</span>
                <span class="count-label">{{ $t("common.files") }}</span>
            </div>

            <!-- Detailed breakdown (when both types present) -->
            <div v-if="imageCount > 0 && videoCount > 0" class="count-breakdown">
                <div class="count-item image">
                    <PhImage class="count-icon" />
                    <span class="count-number">{{ imageCount }}</span>
                </div>
                <div class="count-separator">·</div>
                <div class="count-item video">
                    <PhVideoCamera class="count-icon" />
                    <span class="count-number">{{ videoCount }}</span>
                </div>
            </div>

            <!-- Single type display -->
            <div v-else-if="imageCount > 0" class="count-single image">
                <PhImage class="count-icon" />
                <span class="count-number">{{ imageCount }}</span>
                <span class="count-label">{{ $t("common.images") }}</span>
            </div>

            <div v-else-if="videoCount > 0" class="count-single video">
                <PhVideoCamera class="count-icon" />
                <span class="count-number">{{ videoCount }}</span>
                <span class="count-label">{{ $t("common.videos") }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
interface Props {
    imageCount: number;
    videoCount: number;
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

const totalCount = computed(() => props.imageCount + props.videoCount);
</script>
```

#### Visual Design Specifications

```scss
.file-count-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    font-size: 12px;
    color: var(--color-text-secondary);

    &.loading {
        opacity: 0.7;
    }

    .loading-state {
        display: flex;
        align-items: center;
        gap: 4px;

        .loading-text {
            font-size: 11px;
        }
    }

    .count-display {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .total-count {
        display: flex;
        align-items: center;
        gap: 2px;
        font-weight: 500;
        color: var(--color-text-primary);
    }

    .count-breakdown {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
    }

    .count-item {
        display: flex;
        align-items: center;
        gap: 2px;

        &.image {
            color: var(--color-success);
        }

        &.video {
            color: var(--color-info);
        }
    }

    .count-separator {
        color: var(--color-text-tertiary);
    }

    .count-icon {
        width: 12px;
        height: 12px;
    }
}
```

### 2. Data Integration

#### ImageList.vue Integration

```typescript
// Enhanced computed properties
const imageCount = computed(() => {
    return card.value?.images?.filter((img) => !img.isVideo).length || 0;
});

const videoCount = computed(() => {
    return card.value?.images?.filter((img) => img.isVideo).length || 0;
});

const totalFileCount = computed(() => imageCount.value + videoCount.value);

// Loading state for counting
const isCountingFiles = computed(() => {
    return loadingPhotasaConfig.value || !currentFolderConfig.value;
});
```

#### Template Integration

```vue
<template>
    <div class="flex flex-col h-full min-h-0">
        <!-- Enhanced header with file count -->
        <div class="px-4 py-2 border-b flex items-center justify-between">
            <BaseBreadcrumb>
                <BaseBreadcrumbItem ... />
            </BaseBreadcrumb>

            <!-- File count display -->
            <FileCountBadge
                :imageCount="imageCount"
                :videoCount="videoCount"
                :isLoading="isCountingFiles"
            />
        </div>

        <!-- Content area remains unchanged -->
        <div ref="imageListRef" class="flex-1 min-h-0 overflow-auto">
            <!-- Existing content -->
        </div>
    </div>
</template>
```

### 3. Responsive Design

#### Mobile Layout Adaptation

```scss
@media (max-width: 768px) {
    .file-count-badge {
        font-size: 11px;
        padding: 2px 6px;

        .count-breakdown {
            display: none; // Hide detailed breakdown on mobile
        }

        .total-count .count-label {
            display: none; // Show only numbers on mobile
        }
    }
}

@media (max-width: 480px) {
    .px-4.py-2.border-b {
        flex-direction: column;
        gap: 8px;
        align-items: stretch;

        .file-count-badge {
            align-self: flex-end;
        }
    }
}
```

### 4. Internationalization

#### Translation Keys

```json
// src/renderer/src/locales/en-US.json
{
    "common": {
        "files": "files",
        "images": "images",
        "videos": "videos",
        "counting": "Counting..."
    },
    "imageList": {
        "fileCount": {
            "total": "{count} files",
            "images": "{count} images",
            "videos": "{count} videos",
            "mixed": "{images} images, {videos} videos",
            "empty": "No files"
        }
    }
}
```

#### Localization Support

```typescript
// FileCountBadge.vue - Computed labels
const totalLabel = computed(() => {
    if (totalCount.value === 0) return t("imageList.fileCount.empty");
    if (totalCount.value === 1) return t("common.file");
    return t("common.files");
});

const tooltipText = computed(() => {
    if (props.imageCount > 0 && props.videoCount > 0) {
        return t("imageList.fileCount.mixed", {
            images: props.imageCount,
            videos: props.videoCount,
        });
    }
    return t("imageList.fileCount.total", { count: totalCount.value });
});
```

### 5. Performance Considerations

#### Efficient Counting

```typescript
// Optimize counting to avoid unnecessary recalculations
const fileCountMemo = computed(() => {
    const images = card.value?.images || [];

    // Single pass through the array
    let imageCount = 0;
    let videoCount = 0;

    for (const img of images) {
        if (img.isVideo) {
            videoCount++;
        } else {
            imageCount++;
        }
    }

    return { imageCount, videoCount, totalCount: imageCount + videoCount };
});

const imageCount = computed(() => fileCountMemo.value.imageCount);
const videoCount = computed(() => fileCountMemo.value.videoCount);
const totalFileCount = computed(() => fileCountMemo.value.totalCount);
```

#### Loading State Management

```typescript
// Debounced loading state to prevent flickering
const debouncedLoadingState = computed(() => {
    // Show loading only if it takes longer than 100ms
    return loadingPhotasaConfig.value && Date.now() - loadStartTime.value > 100;
});
```

## Implementation Plan

### Phase 1: Core Component Development (Week 1)

- [ ] Create FileCountBadge component
- [ ] Implement basic counting logic in ImageList.vue
- [ ] Add CSS styling for file count display
- [ ] Implement loading state handling

### Phase 2: UI Integration (Week 1-2)

- [ ] Integrate FileCountBadge into ImageList header
- [ ] Ensure responsive layout works correctly
- [ ] Test with various file count scenarios
- [ ] Implement hover states and interactions

### Phase 3: Internationalization (Week 2)

- [ ] Add translation keys for all supported languages
- [ ] Implement pluralization rules
- [ ] Test RTL language support
- [ ] Validate text overflow handling

### Phase 4: Performance & Polish (Week 2-3)

- [ ] Optimize counting calculations
- [ ] Add transition animations
- [ ] Implement accessibility features
- [ ] Comprehensive testing across different folder sizes

## Success Criteria

### Functional Requirements

- ✅ Display accurate file counts (images and videos separately)
- ✅ Show loading state during folder transitions
- ✅ Update counts in real-time when files change
- ✅ Support all UI languages with proper pluralization

### Performance Requirements

- 📊 Count calculation time < 50ms for folders with 1000+ files
- 📊 No visible layout shift during loading states
- 📊 Smooth transitions between different count states

### UX Requirements

- 🎯 Intuitive visual design that doesn't clutter the header
- 🎯 Clear distinction between image and video counts
- 🎯 Responsive layout works on mobile devices
- 🎯 Accessible to screen readers

### Integration Requirements

- 🔧 No conflicts with existing ImageList functionality
- 🔧 Consistent with overall application design language
- 🔧 Compatible with future BaseTree statistics (RFC 0010)

## Drawbacks

### Potential Issues

1. **Header Cluttering**: Additional elements in the header might feel crowded
    - **Mitigation**: Use minimal, clean design with proper spacing

2. **Performance Impact**: Calculating counts for large folders might slow down rendering
    - **Mitigation**: Implement efficient counting with memoization

3. **Mobile Space**: Limited space on mobile devices for additional UI elements
    - **Mitigation**: Implement responsive design that adapts to screen size

4. **Translation Complexity**: Pluralization rules vary across languages
    - **Mitigation**: Use vue-i18n's built-in pluralization support

## Alternatives

### Alternative 1: Status Bar Display

Show file counts in a bottom status bar instead of header

- **Pros**: Doesn't clutter main header, more space for information
- **Cons**: Less visible, requires additional UI component

### Alternative 2: Tooltip-Only Display

Show counts only in breadcrumb tooltip

- **Pros**: No UI clutter, minimal implementation
- **Cons**: Hidden information, poor discoverability

### Alternative 3: Sidebar Integration

Display counts in the folder tree sidebar

- **Pros**: Centralized location for all folder information
- **Cons**: Duplicates RFC 0010 functionality, not immediately visible

### Decision

Proceed with header integration as it provides the best balance of visibility and functionality.

## Relationship to Other RFCs

### RFC 0010: Folder Statistics Display

- **Complementary**: RFC 0010 focuses on tree node statistics, this RFC focuses on current folder display
- **Data Sharing**: Both RFCs can potentially share counting logic and caching mechanisms
- **Consistency**: Visual design should be consistent between tree statistics and header display

### Future Integration Opportunities

- Shared statistics service for counting logic
- Consistent loading states across both features
- Unified theming and visual language

## Unresolved Questions

1. **Filtering Integration**: How should counts update when filters are applied?
    - Option A: Show filtered counts vs total counts
    - Option B: Only show total counts regardless of filters
    - **Recommended**: Option A with clear visual distinction

2. **Performance Threshold**: At what folder size should we show loading indicators?
    - **Recommended**: Show loading for operations taking >100ms

3. **Accessibility**: What ARIA labels and roles should be used?
    - **Recommended**: Use `role="status"` for live count updates

4. **Animation**: Should count changes be animated?
    - **Recommended**: Subtle number transitions for better UX

## Future Enhancements

1. **Advanced Statistics**
    - File size information
    - Date range of files
    - File type distribution

2. **Interactive Features**
    - Click to show detailed breakdown modal
    - Filter shortcuts from count display

3. **Export Integration**
    - One-click selection of all files of a specific type
    - Batch operation shortcuts

## Implementation Notes

### Testing Strategy

- Unit tests for counting logic
- Component tests for FileCountBadge
- Integration tests with various folder sizes
- Visual regression tests for different languages

### Accessibility Considerations

- Screen reader support for count updates
- High contrast mode compatibility
- Keyboard navigation support
- Reduced motion preferences

### Browser Compatibility

- Modern browser support (Chrome 90+, Firefox 88+, Safari 14+)
- CSS Grid fallbacks for older browsers
- Responsive design testing across devices

## Changelog

### 2025-01-09

- Initial RFC creation
- Defined component structure and integration approach
- Established success criteria and implementation plan
