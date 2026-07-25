# RFC 0159 – Tauri Production Theme CSS Bundling

## Implementation principle (Photasa / Tauri)

> **Renderer-only fix.** Theme loading is Vue/Vite concern; no Rust changes. Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: ✅ Implemented  
**Created**: 2026-07-24  
**Area**: Photasa / Vue / Vite / Tauri WebView  
**Related**: [0073](../completed/0073-tauri-ui-migration-adapter.md), [0149](../completed/0149-tauri-ui-adapter-post-closure.md)  
**Skill**: [`.cursor/skills/tauri-theme-management/SKILL.md`](../../.cursor/skills/tauri-theme-management/SKILL.md) (in-repo); canonical marketplace copy: `linglong-marketplace` → `plugins/tauri-dev-plugin/skills/tauri-theme-management/`

---

## Problem

Production Tauri builds showed **split theming**: Settings modal looked correct (dark), while the main shell (FolderList, SplitView, tree, splitter) stayed on light fallbacks from `styles.less`.

### Root cause

`ThemeManager.applyTheme()` loaded theme styles at runtime via a **dev-only URL**:

```ts
// REMOVED — do not reintroduce
const href = `${themeDir}/${themeId}/theme.css`; // themeDir was "/src/themes"
```

- Vite dev server exposes `src/themes/**` at `/src/themes/**`.
- **`dist/` has no `/src/themes` path** → stylesheet 404 in production.
- `theme.json` (imported at build time) only defines a **subset** of CSS variables (`--color-card-bg`, etc.).
- `theme.css` defines the **full** token set (`--color-tree-bg`, `--color-splitter-*`, list/sidebar tokens, etc.).
- Modal components mostly used `theme.json` tokens → appeared correct.
- Main chrome depended on `theme.css` → fell back to `styles.less` light `:root` defaults.

A follow-up attempt using Vite `?url` + runtime `<link href="/assets/theme-*.css">` still risked **async load races** and Tauri WebView path resolution; CSS was emitted as separate assets instead of being guaranteed at `applyTheme()` time.

---

## Decision

Bundle each built-in `theme.css` into the JS bundle with Vite **`?raw`**, then inject **synchronously** via a `<style id="theme-style">` element in `ThemeManager.applyTheme()`.

### Architecture

```
theme.json (build import)     theme.css (?raw in bundle)
        │                              │
        └──────────► ThemeManager.applyTheme(themeId)
                         │
                         ├─ inline --color-* from theme.json on documentElement
                         ├─ <style id="theme-style"> with THEME_STYLESHEETS[themeId]
                         └─ documentElement.setAttribute("data-theme", themeId)
```

### Key files

| File                                                    | Role                                               |
| ------------------------------------------------------- | -------------------------------------------------- |
| `apps/photasa/src/services/chusuiliang/theme-styles.ts` | `?raw` imports → `THEME_STYLESHEETS` map           |
| `apps/photasa/src/services/chusuiliang/theme-manage.ts` | `ThemeManager.applyTheme(themeId)` — no `themeDir` |
| `apps/photasa/src/themes/*/theme.json`                  | Metadata + partial color tokens                    |
| `apps/photasa/src/themes/*/theme.css`                   | Full CSS variable surface                          |
| `apps/photasa/src/assets/css/styles.less`               | Light fallbacks only — not a theme substitute      |

### Removed (anti-patterns)

- `THEME_BASE_PATH = "/src/themes"` constant
- `applyTheme(themeId, themeDir)` second parameter
- Runtime fetch of `/src/themes/...` or dynamic `<link href="/assets/theme-*.css">`

---

## Adding a new built-in theme

1. Add `apps/photasa/src/themes/<id>/theme.json` + `theme.css`.
2. Import JSON in `theme-manage.ts` → `loadBuiltInThemes()`.
3. Import CSS with `?raw` in `theme-styles.ts` → `THEME_STYLESHEETS`.
4. Extend tests in `theme-styles.test.ts` and `theme-manage.test.ts`.
5. Run `pnpm --filter @photasa/photasa run test:unit` and `vite build`; confirm bundle contains theme tokens (e.g. `tree-bg`), no `/src/themes` strings.

---

## Verification

| Check                  | Command / evidence                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Unit tests             | `pnpm --filter @photasa/photasa exec vitest run src/services/chusuiliang/__tests__/`                                         |
| Vitest CSS raw imports | `css: true` in `vitest.config.ts` (without it, `?raw` stubs to `""`)                                                         |
| Production bundle      | `pnpm --filter @photasa/photasa exec vite build` → no orphan `dist/assets/theme-*.css`; JS bundle contains `--color-tree-bg` |
| Local prod install     | `pnpm --filter @photasa/photasa run build` → `ditto target/release/bundle/macos/Photasa.app /Applications/`                  |
| Manual                 | Main shell + Settings modal share same theme; tree/splitter colors match selected theme                                      |

**Validated**: 2026-07-24 on macOS arm64 — prod `.app` in `/Applications/Photasa.app`, user confirmed theme fix.

---

## Alternatives considered

| Approach                                             | Why rejected                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Keep `/src/themes` runtime URL                       | 404 in `dist/`                                                                                                              |
| Vite `?url` + `<link>`                               | Async; separate asset files; Tauri path edge cases                                                                          |
| Static import all `theme.css` with `:root` selectors | All themes use `:root,[data-theme]` — last import wins; must re-scope selectors to `[data-theme="id"]` (future improvement) |
| Merge all tokens into `theme.json` only              | Duplicates `theme.css`; loses cascade/shadows blocks                                                                        |

---

## Future work (out of scope)

- Scope each `theme.css` to `[data-theme="<id>"]` only and static-import all four — enables zero JS injection, pure attribute toggle.
- User-imported theme packs (`importTheme` / `loadLocalThemes`) — still TODO stubs; need Tauri FS or plugin path, not `/src/themes`.
