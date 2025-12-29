# RFC 0062: Extract Wenchang Engine to Package

## Status

- **Status**: Proposed
- **Date**: 2025-12-28
- **Author**: Photasa Team

## Context

The `WenchangEngine` (`apps/desktop/src/engines/wenchang`) is responsible for managing user preferences in the Photasa application. It is currently located within the `desktop` application but has been identified as a self-contained module with minimal external dependencies (only depending on `@photasa/common`).

Extracting it to a separate package (`packages/wenchang`) will:

1.  Improve modularity and separation of concerns.
2.  Allow other applications (e.g., CLI tools, future web apps) to potentially reuse the preference management logic.
3.  Reduce the complexity of the `desktop` application codebase.
4.  Align with the monorepo architecture where core engines are separated into packages (like `tianshu`).

## Goals

1.  Move `apps/desktop/src/engines/wenchang` to `packages/wenchang`.
2.  Rename the package to `@photasa/wenchang`.
3.  Ensure `apps/desktop` consumes the engine via the new package dependency.
4.  Maintain existing functionality without regression.

## Technical Design

### Package Structure

The new package `packages/wenchang` will have the following structure:

```
packages/wenchang/
├── package.json          # Name: @photasa/wenchang
├── tsconfig.json
├── vite.config.ts        # For building (if necessary, or just tsc)
├── src/
│   ├── index.ts          # Public API
│   ├── core/             # Core logic (WenchangEngine.ts)
│   └── types/            # Type definitions
```

### Dependencies

- `@photasa/common`: For logging and shared utilities.
- `fs-extra` (or `fs/promises`), `path`: For file system operations.

### Integration Changes

**`apps/desktop`**:

1.  Add `"@photasa/wenchang": "workspace:*"` to `package.json`.
2.  Update `src/engines/adapters/WenchangAdapter.ts` to import from `@photasa/wenchang`.
3.  Update any other references (e.g., `src/renderer/src/stores/preference.ts` comments).

**`electron.vite.config.ts`**:

- Ensure `@photasa/wenchang` is handled correctly (likely externalized or bundled depending on architecture, similar to `@photasa/tianshu`).

## Migration Strategy

1.  **Create Package**: Set up the directory structure and configuration files in `packages/wenchang`.
2.  **Move Code**: Copy the source code from `apps/desktop`.
3.  **Update References**: specific `desktop` code to point to the new package.
4.  **Verify**: Run unit tests and verify application startup.
5.  **Cleanup**: Remove the old code from `apps/desktop`.

## Risks and Mitigation

- **Risk**: Circular dependencies or type mismatches.
    - _Mitigation_: The engine is already decoupled. We will verify `npm run build` and `typecheck` at each step.
- **Risk**: Build configuration issues in monorepo.
    - _Mitigation_: We will follow the pattern established by `@photasa/tianshu` and `@photasa/common`.
