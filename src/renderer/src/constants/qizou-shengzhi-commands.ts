/**
 * 启奏（Qizou）事务类型常量
 * RFC 0038/0042: 启奏-圣旨架构
 *
 * 启奏（Qizou）：服务向李世民（中央路由器）汇报的事务
 */
export const QizouMatters = {
    // 褚遂良 - 偏好设置相关
    ADD_PATH_COMPLETED: "add_path_completed",
    REMOVE_PATH_COMPLETED: "remove_path_completed",

    // 袁天罡 - 扫描事件相关
    SCAN_READY: "scan_ready",
    SCAN_FAILED: "scan_failed",

    // 尉迟恭 - 扫描队列事件相关
    SCAN_TASK_ADDED: "scan_task_added", // ✅ 扫描任务已添加到队列

    // 秦琼 - 文件系统事件相关
    FOLDER_DISCOVERED: "folder_discovered",
    FOLDER_REMOVED: "folder_removed",

    // 通用状态报告
    SHENGZHI_UNKNOWN: "shengzhi_unknown",
    SHENGZHI_FAILED: "shengzhi_failed",
    FOLDER_DISCOVERED_HANDLED: "folder_discovered_handled",
    FOLDER_REMOVED_HANDLED: "folder_removed_handled",
    SCAN_COMPLETED_HANDLED: "scan_completed_handled",
    UPDATE_FOLDER_TREE_HANDLED: "update_folder_tree_handled",
} as const;

/**
 * 圣旨（Shengzhi）命令类型常量
 * RFC 0038/0042: 启奏-圣旨架构
 *
 * 圣旨（Shengzhi）：李世民（中央路由器）向服务下达的命令
 */
export const ShengzhiCommands = {
    // 尉迟恭 - 扫描队列管理
    ADD_SCAN_TASK: "add_scan_task",
    REMOVE_SCAN_TASK: "remove_scan_task",

    // 魏征 - appState管理
    ADD_ROOT: "add_root",
    REMOVE_ROOT: "remove_root",
    UPDATE_FOLDER_TREE: "update_folder_tree",
    FOLDER_DISCOVERED: "folder_discovered",
    FOLDER_REMOVED: "folder_removed",
    ADD_PATHS: "add_paths",
    SWITCH_FOLDER: "switch_folder",
    CHECK_AND_ADD_PATH: "check_and_add_path", // ✅ 智能检查并添加路径（根节点或子节点）
} as const;

/**
 * 启奏事务类型
 */
export type QizouMatter = (typeof QizouMatters)[keyof typeof QizouMatters];

/**
 * 圣旨命令类型
 */
export type ShengzhiCommand = (typeof ShengzhiCommands)[keyof typeof ShengzhiCommands];
