const CONTEXT_MENU_EVENT = "contextmenu" as const;

/**
 * 禁用 WebView / 浏览器默认右键菜单；应用内菜单由 BaseContextMenu 等组件自行处理。
 */
export function installDisableBrowserContextMenu(target: Document = document): () => void {
    const handler = (event: Event): void => {
        event.preventDefault();
    };

    target.addEventListener(CONTEXT_MENU_EVENT, handler, { capture: true });

    return () => {
        target.removeEventListener(CONTEXT_MENU_EVENT, handler, { capture: true });
    };
}
