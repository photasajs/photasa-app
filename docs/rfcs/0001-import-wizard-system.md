# RFC 0001: Import Wizard System
- **RFC**: 0001
- **Title**: Import Wizard System
- **Author**: Picasa Vue Team
- **Start Date**: 2025-07-26
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)
- **Status**: In Progress
- **Assignee**: Development Team
- **Reviewers**: Product Team, UX Team, Engineering Team
- **Target Release**: v2.1.0
- **Implementation PR**: #XXX
- **Implementation Date**: 2024-01-XX

## Summary

This RFC proposes a comprehensive import wizard system for the photo management application, replacing the existing basic import functionality with a multi-step, user-friendly wizard interface that provides better validation, preview capabilities, and progress tracking.

## Motivation

The current import functionality has several limitations:

1. **Poor User Experience**: Single-step import without preview or validation
2. **Limited Validation**: No validation of source paths or file selection
3. **No Progress Tracking**: Users cannot see import progress or cancel operations
4. **Monolithic Code**: Large, hard-to-maintain component with mixed concerns
5. **Poor Error Handling**: Limited error recovery and user feedback
6. **No Testing**: Lack of unit tests for import logic

### Goals

- Create a intuitive multi-step import wizard
- Implement comprehensive validation at each step
- Provide real-time preview of files to be imported
- Add progress tracking with pause/resume/cancel capabilities
- Improve code maintainability through pure functions and proper separation of concerns
- Achieve high test coverage (>90%)
- Support internationalization and accessibility

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Import Wizard System                     │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                │
│  ├── ImportPhotos.vue (Main Wizard)                        │
│  ├── ImportProgressModal.vue (Progress Tracking)           │
│  └── Wizard Framework (BaseWizard, Indicators, Navigation) │
├─────────────────────────────────────────────────────────────┤
│  Utilities:                                                 │
│  ├── import-wizard-helpers.ts (Pure Functions)             │
│  ├── import-helpers.ts (General Utilities)                 │
│  └── api.ts (API Communication)                            │
├─────────────────────────────────────────────────────────────┤
│  Tests:                                                     │
│  ├── import-wizard-helpers.test.ts                         │
│  └── ImportPhotos.test.ts                                  │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

#### 1. ImportPhotos.vue (Main Component)

**Props:**

```typescript
interface ImportPhotosProps {
    show: boolean; // Controls wizard visibility
    initialSourcePaths?: string[]; // Pre-populate source directories
    initialTargetPath?: string; // Pre-populate target directory
}
```

**Events:**

```typescript
interface ImportPhotosEmits {
    (e: "update:show", show: boolean): void;
    (e: "import-complete", result: ImportResult): void;
}
```

**Wizard Steps:**

1. **Configuration Step**
    - Source directory selection (multiple)
    - Target directory selection (single)
    - File type filtering (images/videos)
    - Duplicate handling strategy
    - Validation: Must have ≥1 source path and valid target path

2. **Preview Step**
    - File discovery and scanning
    - Statistics display (counts, sizes by type)
    - Individual file selection/deselection
    - Validation: Must have ≥1 selected file

#### 2. ImportProgressModal.vue

**Features:**

- Real-time progress updates
- Pause/Resume/Cancel controls
- Error display and retry options
- Completion summary

#### 3. Wizard Framework

**BaseWizard.vue:**

- Reusable wizard container
- Step management and navigation
- Validation integration
- Event handling

**Supporting Components:**

- `WizardIndicator.vue`: Visual step progress
- `WizardNavigation.vue`: Navigation controls

### Pure Functions (import-wizard-helpers.ts)

```typescript
// Validation Functions
export function validateConfigurationStep(configData: any): boolean;
export function validatePreviewStep(previewData: any): boolean;

// Data Transformation Functions
export function createInitialConfigurationData(...): ConfigData;
export function createInitialPreviewData(): PreviewData;
export function transformToImportConfig(...): ImportConfig;
export function transformPreviewResponse(...): PreviewData;
export function createPreviewConfig(...): ImportConfig;
```

### API Integration

```typescript
// Existing APIs to be used
chooseDirectories(multiple: boolean): Promise<DirectoryResult>;
previewImport(config: ImportConfig): Promise<PreviewResult>;
executeImport(config: ImportConfig): Promise<ImportResult>;
```

### State Management

```typescript
// Component State
interface WizardState {
    currentStep: number;
    stepData: {
        configuration: ConfigurationData;
        preview: PreviewData;
    };
    isLoading: boolean;
    errors: string[];
}

// Configuration Data
interface ConfigurationData {
    sourcePaths: string[];
    targetPath: string;
    filters: ImportFilters;
    duplicateStrategy: DuplicateStrategy;
}

// Preview Data
interface PreviewData {
    files: FileGroup[];
    selectedFiles: Set<string>;
    totalCount: number;
    totalSize: number;
    statistics: ImportStatistics;
}
```

## Current Status & Issues

### ✅ What's Working

- Basic wizard framework with step navigation
- Configuration step with source/target directory selection
- File type filtering and duplicate handling options
- Pure functions for validation and data transformation
- Basic internationalization support

### 🚧 Known Issues

1. **Preview Step**: Preview data loading is broken - not properly triggered when entering preview step
2. **Modal Size**: Modal size is too small (currently md, should be lg or xl)
3. **Validation**: Step validation not properly preventing navigation when invalid
4. **Error Handling**: Limited error recovery and user feedback
5. **Testing**: No unit tests implemented yet
6. **Performance**: No optimization for large file lists

### ⏳ Next Priorities

1. Fix preview data loading mechanism
2. Implement proper step validation
3. Add comprehensive error handling
4. Create unit tests for all components
5. Improve modal sizing and UX

## Implementation Plan

### Phase 1: Core Infrastructure 🚧 (In Progress)

- [x] Create wizard framework components (BaseWizard, WizardIndicator, WizardNavigation)
- [x] Implement pure functions with full test coverage
- [x] Set up basic wizard structure

### Phase 2: Configuration Step 🚧 (Partially Complete)

- [x] Implement source directory selection
- [x] Implement target directory selection
- [x] Add file type filtering
- [x] Add duplicate handling options
- [x] Implement step validation

### Phase 3: Preview Step ⏳ (In Progress)

- [x] Implement file discovery and preview API integration
- [x] Create file list display with selection
- [x] Add statistics display
- [ ] Fix preview data loading issues
- [ ] Implement preview step validation properly

### Phase 4: Progress and Polish ⏳ (Needs Work)

- [x] Implement progress modal
- [ ] Add comprehensive error handling and recovery
- [ ] Complete internationalization (some keys missing)
- [ ] Accessibility improvements
- [ ] Performance optimization
- [ ] Fix modal size issues

### Phase 5: Testing and Documentation ❌ (Not Started)

- [ ] Achieve >90% test coverage
- [ ] Complete component tests
- [ ] Integration testing
- [ ] Documentation and examples

## Testing Strategy

### Unit Tests

- **Pure Functions**: 100% coverage of all utility functions
- **Component Logic**: Test wizard behavior, validation, and state management
- **Error Scenarios**: Test error handling and recovery paths

### Integration Tests

- **API Integration**: Test with mock API responses
- **User Workflows**: Test complete import workflows
- **Edge Cases**: Test boundary conditions and error states

### Test Files Structure

```
src/renderer/src/
├── utils/__tests__/
│   └── import-wizard-helpers.test.ts
├── components/__tests__/
│   ├── ImportPhotos.test.ts
│   └── ImportProgressModal.test.ts
└── components/wizard/__tests__/
    ├── BaseWizard.test.ts
    ├── WizardIndicator.test.ts
    └── WizardNavigation.test.ts
```

## Drawbacks

1. **Complexity**: More complex than the current simple import
2. **Bundle Size**: Additional components and logic increase bundle size
3. **Migration**: Existing users need to adapt to new interface
4. **Maintenance**: More code to maintain and test

## Alternatives

### Alternative 1: Incremental Improvement

- Improve existing import component without major restructuring
- **Pros**: Less disruptive, smaller changes
- **Cons**: Doesn't address fundamental architectural issues

### Alternative 2: Third-party Solution

- Use existing wizard library (e.g., vue-form-wizard)
- **Pros**: Less development time, proven solution
- **Cons**: Less control, potential bloat, dependency risk

### Alternative 3: Single-step with Preview

- Keep single step but add preview panel
- **Pros**: Simpler than multi-step wizard
- **Cons**: Cramped UI, less guided experience

## Unresolved Questions

1. **Performance**: How to handle very large directories (>10k files)?
2. **Memory Usage**: How to manage memory with large file lists?
3. **Cancellation**: How to handle cancellation of long-running preview operations?
4. **Persistence**: Should wizard state persist across app restarts?
5. **Batch Operations**: Should we support multiple concurrent imports?

## Future Possibilities

1. **Advanced Filtering**: Date ranges, file size filters, metadata filters
2. **Cloud Integration**: Support for cloud storage sources
3. **Batch Operations**: Multiple import jobs with queue management
4. **Smart Suggestions**: AI-powered organization suggestions
5. **Sync Integration**: Integration with cloud sync services

## Success Metrics

### User Experience Metrics

- **Task Completion Rate**: >95% of users complete import successfully
- **Error Rate**: <5% of imports result in errors
- **User Satisfaction**: >4.5/5 rating in user feedback

### Technical Metrics

- **Test Coverage**: >90% code coverage
- **Performance**: Preview generation <2s for <1000 files
- **Bundle Size**: <50KB increase in bundle size
- **Memory Usage**: <100MB peak memory for large imports

### Adoption Metrics

- **Feature Usage**: >80% of imports use new wizard within 3 months
- **Support Tickets**: <10% increase in import-related support tickets

## Implementation Tracking

### Milestones

- [x] **M1**: RFC Approved and Implementation Started ✅
- [x] **M2**: Core Infrastructure Complete ✅ (Wizard framework implemented)
- [x] **M3**: Configuration Step Complete ✅ (Basic functionality working)
- [ ] **M4**: Preview Step Complete 🚧 (In progress, has issues)
- [ ] **M5**: Progress Modal Complete 🚧 (Basic implementation exists)
- [ ] **M6**: Testing and Documentation Complete ❌ (Not started)
- [ ] **M7**: Feature Released ❌ (Blocked by issues)

### Risk Mitigation

1. **Performance Risk**: Implement virtualization for large file lists
2. **Complexity Risk**: Maintain comprehensive test suite
3. **User Adoption Risk**: Provide migration guide and onboarding
4. **Maintenance Risk**: Document architecture and provide examples

## Conclusion

The Import Wizard System represents a significant improvement to the photo management application's import capabilities. By implementing a well-structured, tested, and documented wizard system, we can provide users with a much better import experience while maintaining code quality and maintainability.

The proposed architecture separates concerns effectively, uses pure functions for business logic, and provides comprehensive testing coverage. The phased implementation plan allows for iterative development and early feedback.

---
