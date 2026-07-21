# RFC 0066: Extract Siming Package

- **Author**: AI Assistant
- **Status**: ❌ Rejected (2026-07-20)

## Rejection Reason

Photasa / Tauri architecture uses Rust-first backend architecture (`crates/photasa-preference` and `apps/photasa/src-tauri`). Siming Node/TypeScript package extraction is superseded by Rust commands and Siming adapter retirement (RFC 0145). See [ROADMAP.md](../../ROADMAP.md) Golden Rule.

- **Created**: 2025-12-30

## Abstract

Extract the `Siming` engine and its adapter from `apps/desktop` to a dedicated package `@photasa/siming`. This improves modularity and allows other applications to use the app state management capabilities.

## Motivation

Currently, `SimingEngine` resides in `apps/desktop`. As we scale to more applications (e.g., mobile), we need a centralized way to manage application state (like folder trees, preferences, etc.) that can be shared or easily adapted. Moving Siming to its own package isolates this logic.

## Design

### Package Structure

New package: `packages/@photasa/siming`

```
packages/@photasa/siming/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── core/
│   │   └── SimingEngine.ts  <-- Moved from apps/desktop
│   ├── adapters/
│   │   └── SimingAdapter.ts <-- Moved from apps/desktop
│   └── index.ts             <-- Exports
```

### Dependencies

- `@photasa/common`: For logging and shared types.
- `@photasa/taiyi`: For `IAdapter` interface (used by `SimingAdapter`).

### Integration

`apps/desktop` will depend on `@photasa/siming` and import `SimingAdapter` from it during adapter registration.

## Migration Strategy

1.  Create `@photasa/siming` package.
2.  Move code.
3.  Update `apps/desktop` dependencies and imports.
4.  Verify functionality.
