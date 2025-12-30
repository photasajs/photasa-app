# RFC 0065: Extract Taiyi Package

- Start Date: 2025-12-29
- RFC PR: (To be added)
- Implementation PR: (To be added)
- Status: Implemented

## Summary

Extract the Taiyi Engine (currently in `apps/desktop/src/engines/taiyi`) and its workflow adapter helper (`apps/desktop/src/engines/workflow`) into a dedicated workspace package `@photasa/taiyi`.

## Motivation

As part of the ongoing architectural refactoring to modularize the codebase (following Wenchang, Sibu, and Maliang), the Taiyi Engine should be decoupled from the Desktop application. This promotes:

1.  **Clearer Boundaries**: Separation of core engine logic (Taiyi) from the application layer (Desktop).
2.  **Reusability**: Potential for Taiyi to be used in other contexts (e.g., CLI, Server) in the future.
3.  **Encapsulation**: Integrating the "Workflow Adapter" (`engines/workflow`) directly into the engine package, as these standardizers are internal implementation details of how Taiyi interacts with the Workflow Orchestrator (Tianshu).

## Detailed Design

### Package Structure

Create a new package at `packages/@photasa/taiyi`:

```
packages/@photasa/taiyi/
├── src/
│   ├── core/         # From apps/desktop/src/engines/taiyi/core
│   ├── workflow/     # From apps/desktop/src/engines/workflow
│   └── index.ts      # Main entry point
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Migration Steps

1.  **Create Package**: Set up configurations (`package.json`, `tsconfig.json`, etc.) mirroring other packages like `@photasa/sibu`.
2.  **Move Code**:
    - Move `apps/desktop/src/engines/taiyi` contents to `src/`.
    - Move `apps/desktop/src/engines/workflow` contents to `src/workflow/`.
3.  **Update References**:
    - Update imports in `apps/desktop/src/main/deity/taiyi-service.ts` to consume `@photasa/taiyi`.
    - Add `@photasa/taiyi` as a dependency to `apps/desktop`.

### API Changes

The `@photasa/taiyi` package will export:

- `TaiyiEngine` class.
- `TaiyiEngineConfig` interface.
- Internal types like `EngineCallResult` will be handled internally or exported if needed by consumers (like `TaiyiService`).

## Drawbacks

- None significant. Standard refactoring overhead.

## Alternatives

- Keep in `apps/desktop`: Violates the modularization goal.
- Move `engines/workflow` to `tianshu`: Rejected because `tianshu` defines the _generic contract_, while `workflow` contains _specific implementation adapters_ for Taiyi.

## Adoption Strategy

- Direct refactor. No breaking behavior changes expected.
