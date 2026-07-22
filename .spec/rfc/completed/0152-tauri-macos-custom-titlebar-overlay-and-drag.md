# RFC 0152: Tauri macOS Custom Titlebar Overlay and Window Dragging

- **Start Date**: 2026-07-21
- **Status**: Completed
- **Priority**: P1
- **Area**: Photasa / UI / Tauri Window decorations
- **Path**: `.spec/rfc/completed/0152-tauri-macos-custom-titlebar-overlay-and-drag.md`

## Background & Root Causes

During the migration to Tauri v2.0 on macOS, custom window titlebar styling encountered three distinct failure modes:

1. **Double Titlebar Display**: The native OS-drawn black titlebar (housing traffic lights and the native window title text) rendered directly on top of the Vue custom `<TitlebarMac />` component, creating a redundant, non-integrated layout.
2. **Unresponsive UI Buttons (Click Hijacking)**: When applying `-webkit-app-region: drag` or `data-tauri-drag-region` on the entire header container, interactive descendant elements (such as settings icons) had their `mousedown` event bubble up to the drag region. Tauri intercepted the bubble to start window dragging, effectively blocking the button click listeners.
3. **Window Dragging Failing Entirely**: 
   * A CSS rule mismatch occurred when combining `-webkit-app-region: drag` and `data-tauri-drag-region` simultaneously, causing layout engine conflicts in WebKit.
   * Under Tauri v2's strict sandboxed capability model, window dragging APIs are guarded. Without granting the explicit window drag permission, the WebView was blocked from starting native window drag loops.

---

## Technical Decision & Implementation Details

To solve these issues natively and maintain compatibility with the Apple Human Interface Guidelines (HIG), the following changes were implemented:

### 1. Window Configuration (`tauri.conf.json`)
Modified the `"main"` window configuration under `"app" > "windows"`:
* **`"titleBarStyle": "Overlay"`**: Merges the titlebar area with the main webview frame, allowing the HTML content to flow all the way to the top of the screen.
* **`"hiddenTitle": true`**: Hides the native window title text next to the traffic lights, leaving only the Red, Yellow, Green controls.
* **`"decorations": true`**: Retains native macOS window controls while overlaying them on top of the webview.

### 2. Sandbox Capabilities (`capabilities/default.json`)
Added the explicit window dragging permission to the default application permissions array to grant WebView access to the drag loop IPC:
* `"core:window:allow-start-dragging"`

### 3. Header Component Layering (`TitlebarMac.vue`)
Refactored the custom header element structure into a three-layer layout to isolate dragging and clicking behaviors cleanly:
* **Draggable Background Handle**: An absolute background spacer element (`.titlebar-drag-handle`) covering `100%` of the header with `z-index: 0` and the `data-tauri-drag-region` attribute.
* **Centered Title**: The document title is centered absolutely (`left: 50%; transform: translateX(-50%)`) to keep a balanced native macOS visual style.
* **Pointer Events Passthrough**: The content overlay container (`.titlebar-content`) uses `pointer-events: none;`. Clicks on any empty background or title text pass straight down to the draggable background.
* **Interactive Zones Re-enabled**: Interactive elements like `.setting-header` explicitly override with `pointer-events: auto;`. Click events are triggered instantly, while the native macOS traffic lights (being native overlay windows) continue to capture events naturally inside the `.traffic-placeholder` space.
* **Pure HTML Interception**: Deleted all `-webkit-app-region: drag` rules from CSS stylesheets to prevent conflicts with Tauri's webview events.

---

## Verification & Parity Evidence

1. **Unit Tests Passing**: Ran full unit test suites (`pnpm run test:unit`) verifying no regressions in the Zhenguan router, stores, or IPC endpoints.
2. **macOS Integration Status**: Hand-tested by the user. The native black window bar is completely removed. Window controls sit aligned alongside utility buttons, window dragging works seamlessly from any empty space, and settings icons trigger their respective modal drawers without interception.
