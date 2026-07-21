# RFC 0022: Test Stabilization Issues and Solutions

- **Start Date**: 2025-01-16
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)

## Summary

This RFC documents the comprehensive analysis and resolution of test stability issues encountered in the Picasa Vue project, including renderer process tests, main process tests, and the implementation of proper testing methodologies using Vue Test Utils and Vitest.

## Motivation

The project experienced multiple test stability issues that were preventing reliable test execution and development workflow. These issues included:

- Event system compatibility problems between different test environments
- Date mocking issues causing circular reference errors
- i18n configuration problems in test environments
- Incorrect event testing methodologies
- Test environment configuration conflicts

These issues needed to be systematically analyzed and resolved to ensure a stable testing foundation for future development.

## Detailed Design

### Problem Analysis

#### 1. Test Environment Configuration Issues

- **Main process tests** were running in jsdom environment, causing `@electron-toolkit/utils` errors
- **Renderer process tests** had environment selection issues with event API compatibility
- Unified Vitest configuration was causing conflicts between different test types

#### 2. Event System Compatibility Problems

- `@vue/test-utils` could not properly create DOM events in happy-dom environment
- Event constructors like `SupportedEventInterface` were not available
- Incorrect manual event constructor implementations in test setup

#### 3. Date Mock Issues

- Date mock implementations caused circular reference errors
- i18n internal Date.now access failures
- Inconsistent date handling across test environments

#### 4. i18n Configuration Problems

- i18n instance duplication in tests
- Date.now unavailability in i18n context
- Component registration warnings

### Solution Architecture

#### 1. Test Environment Separation

```typescript
// vitest.main.config.ts - Main process tests
export default defineConfig({
    test: {
        environment: "node",
        setupFiles: ["./test/setup.main.ts"],
        include: ["src/main/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    },
});

// vitest.config.ts - Renderer process tests
export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["./test/setup.renderer.ts"],
        include: ["src/renderer/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    },
});
```

#### 2. Event System Fix

- Use jsdom instead of happy-dom for renderer tests
- Rely on Vue Test Utils' `trigger()` method instead of manual event creation
- Remove incorrect manual event constructor implementations

#### 3. Date Mock Optimization

```typescript
// test/setup.renderer.ts
const mockDateNow = vi.fn(() => 1640995200000);
Object.defineProperty(Date, "now", {
    value: mockDateNow,
    writable: true,
});

global.Date.now = mockDateNow;

// Avoid circular references in Date mock
const mockDate = new Date(1640995200000);
global.Date = class extends OriginalDate {
    constructor(...args: any[]) {
        if (args.length === 0) {
            super(mockDate.getTime());
        } else {
            super(...args);
        }
    }
    static now() {
        return mockDateNow();
    }
    toISOString() {
        return mockDate.toISOString();
    }
    getTime() {
        return mockDate.getTime();
    }
} as any;
```

#### 4. i18n Configuration Management

```typescript
// test/setup.renderer.ts
let globalI18n: ReturnType<typeof createI18n> | null = null;

function getOrCreateI18n() {
    if (!globalI18n) {
        globalI18n = createI18n({
            legacy: false,
            locale: "en",
            fallbackLocale: "en",
            messages: { en: {} },
            missingWarn: false,
            fallbackWarn: false,
            silentTranslationWarn: true,
            silentFallbackWarn: true,
            datetimeFormats: {
                en: {
                    short: {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                    },
                },
            },
        });
    }
    return globalI18n;
}
```

### Key Learning: Correct Event Testing Methodology

**Problem**: We incorrectly implemented manual event constructors in test setup.

**Wrong Approach**:

```typescript
// ❌ Incorrect: Manual event constructor implementation
if (!window.MouseEvent) {
    window.MouseEvent = class MouseEvent extends Event {
        constructor(type: string, eventInitDict?: MouseEventInit) {
            super(type, eventInitDict);
            Object.assign(this, eventInitDict);
        }
    } as any;
}
```

**Correct Approach**:

```typescript
// ✅ Correct: Use Vue Test Utils trigger method
test("button click", async () => {
    const wrapper = mount(Component);
    await wrapper.find("button").trigger("click"); // Vue Test Utils handles event creation
    expect(wrapper.emitted()).toHaveProperty("click");
});
```

**Key Insights**:

1. Vue Test Utils' `trigger()` method internally creates appropriate event objects
2. No need to manually add event constructors - this causes compatibility issues
3. jsdom environment provides complete event API - rely on environment, not custom implementation
4. Context7 documentation is valuable for learning correct testing methods

## Drawbacks

- **Increased Configuration Complexity**: Separate test configurations require more maintenance
- **Learning Curve**: Team needs to understand correct Vue Test Utils usage
- **Environment Dependencies**: Tests now depend on specific environment configurations

## Alternatives

### Alternative 1: Single Test Environment

- **Approach**: Use single jsdom environment for all tests
- **Drawback**: Main process tests would have Electron API conflicts

### Alternative 2: Manual Event Mocking

- **Approach**: Continue with manual event constructor implementations
- **Drawback**: Causes compatibility issues and maintenance overhead

### Alternative 3: Different Testing Framework

- **Approach**: Switch to different testing framework
- **Drawback**: Major migration effort with uncertain benefits

## Unresolved Questions

1. **Performance Impact**: What is the performance impact of separate test environments?
2. **CI/CD Integration**: How will this affect continuous integration pipeline?
3. **Future Maintenance**: What are the long-term maintenance implications?

## Implementation Status

- [x] Test environment separation implemented
- [x] Event system fixes applied
- [x] Date mock optimization completed
- [x] i18n configuration management implemented
- [x] Incorrect event testing methods removed
- [x] Documentation updated

## Results

- **BaseButton tests**: 100% passing (5/5 tests)
- **BaseList tests**: 100% passing (7/7 tests)
- **Overall renderer test improvement**: Significant reduction in event-related failures
- **Test stability**: Much more reliable test execution

## Related Documentation

- [Vue Test Utils Documentation](https://vuejs.org/guide/scaling-up/testing.html)
- [Vitest Configuration Guide](https://vitest.dev/config/)
- [Context7 Vue Test Utils Guide](https://context7.io/vuejs/test-utils)
