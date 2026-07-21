# RFC 0064: Maliang Migration Completion & Robustness

- **RFC Number**: 0064
- **Title**: Maliang Migration Completion & Robustness
- **Author**: Picasa Team
- **Status**: Implemented
- **Type**: Standards Track

## Summary

This RFC documents the final polish and robustness improvements for the Maliang image processing engine migration (`@photasa/maliang`). It specifically addresses the integration of comprehensive test coverage, strict type safety for `MagicBrush` implementations, and standardizing package configuration.

## Motivation

While the core functionality of Ma-Liang (RFC 0031) has been implemented, several robustness issues persisted:

1.  **Incomplete Interface Implementation**: `BmpBrush` was missing the `cleanup` and `initialize` methods required by the `MagicBrush` interface, causing type errors in strict contexts.
2.  **Test Gaps**: Integration tests did not strictly validation the `MagicBrush` contract and lacked coverage for unknown file types.
3.  **Configuration Warnings**: `package.json` had export ordering issues causing build warnings.
4.  **Test Artifact Management**: Temporary test outputs were not properly cleaned up or ignored.

## Design

### 1. Robust `MagicBrush` Implementation

All Brush implementations must strictly adhere to the `MagicBrush` interface, even if specific methods are no-ops.

**Refinement to `BmpBrush`**:

```typescript
export class BmpBrush implements MagicBrush {
    // ... existing implementation ...

    public async initialize(config?: Record<string, any>, logger?: PhotasaLogger): Promise<void> {
        // No-op for BMP but required by interface
        logger?.debug(`${this.name} initialized with config:`, config);
    }

    public async cleanup(logger?: PhotasaLogger): Promise<void> {
        // No-op for BMP but required by interface
        logger?.debug(`${this.name} cleaned up`);
    }
}
```

### 2. Comprehensive Integration Testing

The integration test suite (`Integration.spec.ts`) is enhanced to be a strict contract validator:

- **Strict Typing**: The `brush` variable is strictly typed as `MagicBrush` to catch validation errors at compile time.
    ```typescript
    let brush: MagicBrush;
    ```
- **Fallback Mechanism**: `FallbackBrush` is explicitly tested as the default handler for unknown file extensions, ensuring no file type crashes the engine.
    ```typescript
    default:
        brush = new FallbackBrush();
        break;
    ```
- **Automatic Cleanup**: `afterAll` hooks ensure `output` directories are removed, keeping the workspace clean.

### 3. Package Configuration Standards

The `package.json` `exports` field must prioritize more specific conditions (like `types` and `import`) over generic ones to avoid resolution warnings.

**Correct Order**:

```json
"exports": {
    ".": {
        "types": "./dist/index.d.ts",
        "require": "./dist/index.js",
        "import": "./dist/index.mjs"
    }
}
```

## Implementation

### Completed Tasks

- [x] **BmpBrush**: Added `initialize` and `cleanup` methods.
- [x] **Integration Tests**:
    - Strictly typed `brush` variable.
    - Integrated `FallbackBrush` for comprehensive coverage.
    - Added automated cleanup logic.
    - Updated `.gitignore` to ignore test outputs.
- [x] **Configuration**: Fixed `package.json` export order.

### 4. CLI Enhancements

- **Clean Output by Default**: CLI commands now suppress internal application logs (info/debug) by default to provide a clean user experience.
- **Verbose Mode**: Added `-v, --verbose` flag to all validation commands (`validate`, `validate-ffmpeg`, `validate-heif`) to opt-in to detailed internal logging for debugging.

    ```bash
    # Clean output
    photasa-cli validate-heif

    # Detailed debug logs
    photasa-cli validate-heif --verbose
    ```

## Unresolved Questions

None. The migration and robustness polish are considered complete.
