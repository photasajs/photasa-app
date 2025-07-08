// 事件名常量归并为对象并冻结，避免 typo，便于统一管理
export const EventNames = Object.freeze({
    MENU_ACTION: "menu-action",
    WINDOW_MINIMIZE: "window-minimize",
    WINDOW_MAXIMIZE: "window-maximize",
    WINDOW_CLOSE: "window-close",
    APP_LOGIN: "app-login",
    APP_LOGOUT: "app-logout",
    // ...后续补充
});
