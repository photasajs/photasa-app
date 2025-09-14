# Development Guide

## Table of Contents

- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Debugging](#debugging)
- [Build and Deployment](#build-and-deployment)

## Project Structure

This is an Electron + Vite application with TypeScript, targeting Windows and Mac desktop platforms.

```
picasa-vue/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # Electron preload scripts
│   ├── renderer/       # Vue frontend application
│   └── common/         # Shared utilities and types
├── docs/               # Documentation and RFCs
├── resources/          # Static resources and WASM files
└── tests/              # Test files
```

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

```bash
npm install
```

### Running Development

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

## Coding Standards

### TypeScript Guidelines

1. **Use ES6 imports always** - Never use `require()` or dynamic imports unless absolutely necessary
2. **Proper typing** - Avoid using `any` type. Use proper TypeScript types
3. **Type-first approach** - Define interfaces and types before implementation

### Vue Component Guidelines

1. **Component organization**:
    - Use component library philosophy for UI design
    - Split complex components into sub-components with clear responsibilities
    - Base components should start with `Base` prefix
    - Domain-specific components should use `Primitive` prefix

2. **Component structure**:
    - Prefer TSX for component design
    - Organize components in independent directories
    - Use multiple support files when necessary

### General Rules

1. **Each change should have corresponding tests**
2. **Never use `console.log`** - Use the logger instead
3. **No `!important` in CSS** - Causes maintenance issues
4. **Document using RFCs** - Read `docs/rfc/README.md` for RFC management

## Testing Guidelines

### Critical: Avoiding Test Hanging Issues

Test hanging is a critical problem that can block CI/CD pipelines. Follow these guidelines to prevent it:

#### 1. Timer Management in Tests

**ALWAYS clean up timers properly:**

```typescript
// ✅ CORRECT - Proper timer management
describe("Component with timers", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("should handle timers correctly", async () => {
        // Your test code
        await vi.runAllTimersAsync();
    });
});

// ❌ WRONG - Global timer manipulation without cleanup
vi.useFakeTimers(); // Never do this globally without cleanup!
```

#### 2. Promise Handling

**NEVER create never-resolving Promises:**

```typescript
// ❌ WRONG - This will hang forever
const neverResolves = new Promise(() => {});
const neverResolves2 = new Promise((_resolve) => {
    /* never resolves */
});

// ✅ CORRECT - Use timeout-based Promises with fake timers
const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(undefined), 5000);
});
// Then in test:
await vi.runAllTimersAsync();

// ✅ CORRECT - For testing timeout behavior
it("should timeout after 5 seconds", async () => {
    vi.useFakeTimers();

    const promise = functionThatMightTimeout();

    // Advance time to test timeout
    vi.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow("Timeout");

    vi.useRealTimers();
});
```

#### 3. Mock External Dependencies

**ALWAYS mock file system and network operations:**

```typescript
// ✅ CORRECT - Mock file system operations
vi.mock("fs-extra", () => ({
    readFile: vi.fn().mockResolvedValue("mock content"),
    writeFile: vi.fn().mockResolvedValue(undefined),
    existsSync: vi.fn().mockReturnValue(true),
}));

// ✅ CORRECT - Mock file scanning libraries
vi.mock("klaw", () => ({
    default: vi.fn(() => {
        const mockStream = {
            on: vi.fn((event, callback) => {
                if (event === "data") {
                    setTimeout(() => {
                        callback({ path: "/mock/file.jpg", stats: { isDirectory: () => false } });
                    }, 10);
                } else if (event === "end") {
                    setTimeout(() => callback(), 20);
                }
                return mockStream;
            }),
        };
        return mockStream;
    }),
}));

// ❌ WRONG - Real file system operations in tests
import klaw from "klaw";
const stream = klaw("/actual/directory"); // This will scan real filesystem!
```

#### 4. Observable Handling

**Ensure Observables complete properly:**

```typescript
// ✅ CORRECT - Observable that completes
import { Observable } from "rxjs";

const mockObservable = new Observable((subscriber) => {
    subscriber.next("data");
    subscriber.complete(); // Important!
});

// ❌ WRONG - Observable that never completes
const neverCompletes = new Observable((subscriber) => {
    subscriber.next("data");
    // Missing subscriber.complete()
});
```

#### 5. Async Test Patterns

**Use proper async/await patterns:**

```typescript
// ✅ CORRECT - Proper async test
it("should handle async operations", async () => {
    const result = await asyncFunction();
    expect(result).toBe("expected");
});

// ✅ CORRECT - Testing with fake timers
it("should handle delayed operations", async () => {
    vi.useFakeTimers();

    const promise = delayedOperation();

    // Advance all timers
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe("expected");

    vi.useRealTimers();
});

// ❌ WRONG - Mixing real and fake timers
it("should not mix timer types", async () => {
    vi.useFakeTimers();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Real timeout with fake timers!
});
```

#### 6. Test Timeouts Configuration

**Configure reasonable timeouts in vitest.config.ts:**

```typescript
// vitest.config.ts
export default defineConfig({
    test: {
        testTimeout: 10000, // 10 seconds max per test
        hookTimeout: 5000, // 5 seconds for hooks
        teardownTimeout: 5000, // 5 seconds for teardown
        // ... other config
    },
});
```

### Test Organization

1. **Unit Tests**: Place next to source files in `__tests__` directories
2. **Integration Tests**: Use `.integration.test.ts` suffix
3. **Edge Cases**: Use `.edge-cases.test.ts` suffix
4. **Mocks**: Place in `__mocks__` directories

### Test Checklist

Before committing test code, verify:

- [ ] All timers are properly managed (fake timers setup/cleanup)
- [ ] No never-resolving Promises
- [ ] External dependencies are mocked
- [ ] Observables complete properly
- [ ] Tests complete within 10 seconds
- [ ] No global state modifications without cleanup
- [ ] Proper error handling for async operations

### Common Test Utilities

```typescript
// Test helper for timer-based tests
export const withFakeTimers = (testFn: () => Promise<void>) => {
    return async () => {
        vi.useFakeTimers();
        try {
            await testFn();
        } finally {
            vi.useRealTimers();
        }
    };
};

// Usage
it(
    "should handle timers",
    withFakeTimers(async () => {
        // Your test with fake timers
        await vi.runAllTimersAsync();
    }),
);
```

## Debugging

### Rules for Debugging

1. **Don't run the app directly** - Can't verify it properly, give guidance instead
2. **Use logger instead of console.log**
3. **Provide clear reproduction steps**

### Logging

```typescript
import { loggers } from "@common/logger";

// Use appropriate logger
loggers.import.info("Import started");
loggers.scan.debug("Scanning directory", { path: "/some/path" });
loggers.watch.error("Watch error", error);
```

## Build and Deployment

### Building for Production

```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:win
npm run build:mac
```

### Pre-commit Hooks

The project uses pre-commit hooks to ensure code quality:

- Linting
- Type checking
- Unit tests

If tests hang, refer to the [Testing Guidelines](#testing-guidelines) section above.

## Troubleshooting

### Tests Hanging

If tests hang indefinitely:

1. Check for improper timer management
2. Look for never-resolving Promises
3. Verify external dependencies are mocked
4. Review `docs/issues/test-hanging-issue-resolution.md` for detailed solutions

### Build Issues

1. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
2. Clear Electron cache: `npm run clear-cache`
3. Check Node.js version compatibility

## Contributing

1. Create feature branch from `develop`
2. Write tests for new features
3. Follow coding standards
4. Create RFC for significant changes
5. Submit PR with clear description

## Resources

- [Debug Guide](DEBUG.md) - 调试设置和故障排除
- [RFC Index](rfc/README.md) - 设计决策和RFC文档
- [Design Documents](design/) - 架构和设计文档
- [Electron Documentation](https://www.electronjs.org/docs)
- [Vue 3 Documentation](https://vuejs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
