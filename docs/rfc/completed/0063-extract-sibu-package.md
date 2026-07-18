# RFC 0063: Extract Sibu Engine to Separate Package

- **Author**: Picasa Team
- **Status**: Implemented
- **Created**: 2025-12-28
- **Packages**: `@photasa/sibu`, `@photasa/desktop`

## Summary

Extract the Sibu Engine (Configuration Management) relative logic from `apps/desktop` into a standalone workspace package `@photasa/sibu`. This follows the architectural pattern established by `@photasa/wenchang`.

## Motivation

1.  **Decoupling**: Separate configuration management logic from the desktop application shell.
2.  **Testability**: Enable isolated unit testing with a target of 100% code coverage.
3.  **Reusability**: Allow other potential apps (e.g., CLI tools) to use the configuration engine.

## Detailed Design

### Package Structure

New package at `packages/@photasa/sibu`:

```
packages/@photasa/sibu/
├── package.json
├── tsconfig.json
├── vite.config.ts      # For bundling
├── vitest.config.ts    # For testing
└── src/
    ├── index.ts        # Public API
    ├── core/           # Core engine logic (SibuEngine.ts)
    ├── services/       # Setup, migration, validation services
    ├── support/        # Defaults and constants
    └── types/          # Shared type definitions
```

### Key Changes

1.  **Move Code**: Transfer `apps/desktop/src/engines/sibu` contents to the new package.
2.  **Dependencies**:
    - `@photasa/common`: For logging and utilities.
    - `fs-extra`, `js-yaml`: For file operations and parsing.
    - `zod`: For validation (if used).
3.  **Desktop Integration**:
    - `apps/desktop` will depend on `@photasa/sibu`.
    - `SibuAdapter` in desktop will import from the new package.

## Verification Plan

### Automated Tests

- **Coverage Goal**: 100% Statement, Branch, Function, and Line coverage.
- **Scope**:
    - Core Engine logic (initialization, loading, saving).
    - Migration services (version upgrades).
    - Validation logic (schema checks).

### Manual Verification

- Verify application startup reads configuration correctly.
- Verify configuration file creation on fresh start.
