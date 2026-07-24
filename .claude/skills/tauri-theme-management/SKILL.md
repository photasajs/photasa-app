---
name: tauri-theme-management
description: >-
    Photasa Tauri renderer theme loading: bundle theme.css with Vite ?raw, inject via
    ThemeManager synchronously. Use when fixing production theme bugs, adding themes,
    or debugging split light/dark UI between shell and Settings modal in apps/photasa.
---

# Tauri Theme Management (Photasa)

## When to use

- Production theme wrong but dev OK
- Main shell light, Settings modal dark (or vice versa)
- Adding/removing built-in themes
- Any urge to use `/src/themes`, `THEME_BASE_PATH`, or runtime `<link href="/assets/...">`

## Golden rules

1. **Never load theme CSS from `/src/themes` at runtime** — path exists only under Vite dev server; Tauri `dist/` has no such route.
2. **Never use `THEME_BASE_PATH` or `applyTheme(themeId, themeDir)`** — removed in RFC 0159.
3. **Bundle `theme.css` with Vite `?raw`** — CSS lives inside JS; no network fetch.
4. **Inject synchronously** — `<style id="theme-style">` with `textContent`, not `<link>` (avoids async race in Tauri WebView).
5. **`theme.json` ≠ full theme** — JSON is metadata + partial `--color-*`; `theme.css` has tree, splitter, list, scrollbar tokens. Both are applied in `applyTheme()`.

## File map

| File                                                     | Responsibility                                           |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `apps/photasa/src/services/chusuiliang/theme-styles.ts`  | `?raw` imports → `THEME_STYLESHEETS`                     |
| `apps/photasa/src/services/chusuiliang/theme-manage.ts`  | `ThemeManager.applyTheme(themeId)`                       |
| `apps/photasa/src/themes/<id>/theme.json`                | `ThemeMeta` + subset of colors                           |
| `apps/photasa/src/themes/<id>/theme.css`                 | Full CSS variables                                       |
| `apps/photasa/src/assets/css/styles.less`                | Fallback tokens only — not theme source of truth         |
| `apps/photasa/src/App.vue`                               | Watches preference store → `themeManager.applyTheme(id)` |
| `apps/photasa/src/components/settings/ThemeSettings.vue` | User pick → `applyTheme` then `chuSuiLiang.updateTheme`  |

## Correct `applyTheme` pattern

```ts
// theme-styles.ts
import darkCss from "@renderer/themes/dark/theme.css?raw";

export const THEME_STYLESHEETS: Readonly<Record<string, string>> = {
    dark: darkCss,
    // ...
};

// theme-manage.ts — inside applyTheme(themeId)
Object.entries(theme.colors).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--color-${key}`, value);
});
this._removeOldThemeStyle();
const stylesheet = THEME_STYLESHEETS[themeId];
if (stylesheet) {
    const styleEl = document.createElement("style");
    styleEl.id = "theme-style";
    styleEl.textContent = stylesheet;
    document.head.appendChild(styleEl);
}
document.documentElement.setAttribute("data-theme", themeId);
```

## Anti-patterns (do not reintroduce)

```ts
// BAD — dev-only path
link.href = `/src/themes/${themeId}/theme.css`;

// BAD — async, separate asset, Tauri edge cases
link.href = importedUrlFromQuestionMarkUrl;

// BAD — dead API
applyTheme(themeId, "/src/themes");
```

## Add a built-in theme (checklist)

- [ ] `src/themes/<id>/theme.json` + `theme.css`
- [ ] Import JSON in `loadBuiltInThemes()`
- [ ] Import CSS `?raw` in `theme-styles.ts`
- [ ] Tests: `theme-styles.test.ts`, `theme-manage.test.ts`
- [ ] `vitest.config.ts` has `css: true` (else `?raw` is empty in tests)
- [ ] `vite build` — bundle contains theme tokens; no `/src/themes` strings

## Debug workflow

1. **Symptom**: split theming → check if `#theme-style` exists in prod DevTools; if missing or 404, something bypassed `?raw` injection.
2. **Compare variables**: `--color-tree-bg`, `--color-splitter-bg` on `:root` — if light values, `theme.css` not applied.
3. **Build verify**:
    ```bash
    pnpm --filter @photasa/photasa exec vite build
    rg "tree-bg|/src/themes" apps/photasa/dist/assets/index-*.js
    ```
    Expect `tree-bg` in bundle; no `/src/themes`.
4. **Local prod smoke**:
    ```bash
    cd apps/photasa && pnpm run build
    ditto ../../target/release/bundle/macos/Photasa.app /Applications/Photasa.app
    open -a /Applications/Photasa.app
    ```

## Tests

```bash
pnpm --filter @photasa/photasa exec vitest run src/services/chusuiliang/__tests__/
```

## Reference

- RFC: [0159-tauri-production-theme-css-bundling.md](../../../.spec/rfc/completed/0159-tauri-production-theme-css-bundling.md)
