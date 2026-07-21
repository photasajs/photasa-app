// MenuItemData 类型声明，主进程、预加载、前端 UI 均可安全复用
export interface MenuItemData {
    /**
     * 菜单项唯一业务 id，必须全局唯一且不可变
     * 所有事件分发、渲染、diff 等均以 key 为主
     */
    key: string;
    /**
     * 国际化 key，仅用于显示和业务语义
     */
    label: string;
    shortcut?: string;
    disabled?: boolean;
    role?: string; // contract reference role 菜单项
    url?: string; // 自定义菜单项（如 help.learnMore）
    isMacOnly?: boolean; // 平台专属标志
    items?: MenuItemData[];
    /**
     * 菜单项类型，分隔符时为 'separator'
     */
    type?: "separator";
}
