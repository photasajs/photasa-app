/**
 * 标题栏 / 系统菜单防回归守卫（纯函数，供 Vitest 与 CI 读取源码断言）
 *
 * 三次已知回归：
 * 1. macOS Help 子菜单空白（默认空 Help + 错误 id）
 * 2. 手动 set_as_help_menu_for_nsapp 在空菜单上
 * 3. TitlebarMac 内嵌菜单整块 pointer-events:auto 阻断拖拽（RFC 0152）
 */

export const TITLEBAR_GUARD_FILES = {
    titlebarMac: "src/components/TitlebarMac.vue",
    titlebarMenuBar: "src/components/TitlebarMenuBar.vue",
    menuData: "src/components/common/menu-data.ts",
    menuRs: "src-tauri/src/commands/menu.rs",
    mainRs: "src-tauri/src/main.rs",
} as const;

/** macOS 标题栏不得内嵌窗口菜单（与系统菜单栏重复，且易破坏拖拽层） */
export function assertTitlebarMacNoInWindowMenu(source: string): string[] {
    const errors: string[] = [];
    if (/import\s+TitlebarMenuBar\s+from/.test(source)) {
        errors.push("TitlebarMac 不得 import TitlebarMenuBar（macOS 仅用系统菜单栏）");
    }
    if (/<TitlebarMenuBar[\s/>]/.test(source)) {
        errors.push("TitlebarMac 不得渲染 TitlebarMenuBar 组件");
    }
    if (/\.titlebar-menus\b/.test(source)) {
        errors.push("TitlebarMac 不得包含 titlebar-menus 区域");
    }
    return errors;
}

/** RFC 0152：仅 setting-header 等叶子可 pointer-events:auto */
export function assertTitlebarMacDragContract(source: string): string[] {
    const errors: string[] = [];
    if (
        !source.includes("data-tauri-drag-region") &&
        !source.includes("TITLEBAR_DRAG_REGION_ATTR")
    ) {
        errors.push("TitlebarMac 缺少 data-tauri-drag-region 拖拽层");
    }
    if (!/\.titlebar-content[\s\S]*pointer-events:\s*none/.test(source)) {
        errors.push("TitlebarMac .titlebar-content 必须为 pointer-events: none");
    }
    if (!/\.setting-header[\s\S]*pointer-events:\s*auto/.test(source)) {
        errors.push("TitlebarMac .setting-header 必须为 pointer-events: auto");
    }
    if (/\.titlebar-menus[\s\S]*pointer-events:\s*auto/.test(source)) {
        errors.push("TitlebarMac .titlebar-menus 禁止 pointer-events: auto（阻断拖拽）");
    }
    return errors;
}

/** TitlebarMenuBar 容器穿透、仅 menu-item 可点 */
export function assertTitlebarMenuBarPointerContract(source: string): string[] {
    const errors: string[] = [];
    if (!/\.menu-bar[\s\S]*pointer-events:\s*none/.test(source)) {
        errors.push("TitlebarMenuBar .menu-bar 必须为 pointer-events: none");
    }
    if (!/\.menu-item[\s\S]*pointer-events:\s*auto/.test(source)) {
        errors.push("TitlebarMenuBar .menu-item 必须为 pointer-events: auto");
    }
    return errors;
}

/** macOS 系统菜单契约（RFC 0170：Help 上游 bug，禁止已知无效方案） */
export function assertMacSystemMenuContract(mainRs: string, menuRs: string): string[] {
    const errors: string[] = [];
    if (mainRs.includes("enable_macos_default_menu(false)")) {
        errors.push(
            "main.rs 禁止 enable_macos_default_menu(false)（异步 apply_system_menu 会导致启动期无菜单栏）",
        );
    }
    if (/"help"\s*=>\s*HELP_SUBMENU_ID/.test(menuRs)) {
        errors.push("menu.rs help 不得映射 HELP_SUBMENU_ID（muda#263 / muda#301）");
    }
    if (!menuRs.includes("WINDOW_SUBMENU_ID")) {
        errors.push("menu.rs 必须保留 window → WINDOW_SUBMENU_ID");
    }
    if (menuRs.includes("set_as_help_menu_for_nsapp()") && menuRs.includes("configure_macos")) {
        errors.push("menu.rs 禁止 configure_macos + set_as_help_menu_for_nsapp（曾导致空下拉）");
    }
    return errors;
}

export function assertHelpMenuHasReportIssue(menuDataSource: string): string[] {
    if (
        !menuDataSource.includes("help-report-issue") &&
        !menuDataSource.includes("MENU_KEY_HELP_REPORT_ISSUE")
    ) {
        return ["menu-data.ts Help 菜单必须包含 help-report-issue"];
    }
    return [];
}

export function collectTitlebarGuardViolations(files: {
    titlebarMac: string;
    titlebarMenuBar: string;
    menuData: string;
    menuRs: string;
    mainRs: string;
}): string[] {
    return [
        ...assertTitlebarMacNoInWindowMenu(files.titlebarMac),
        ...assertTitlebarMacDragContract(files.titlebarMac),
        ...assertTitlebarMenuBarPointerContract(files.titlebarMenuBar),
        ...assertMacSystemMenuContract(files.mainRs, files.menuRs),
        ...assertHelpMenuHasReportIssue(files.menuData),
    ];
}
