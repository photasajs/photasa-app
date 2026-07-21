/**
 * 启奏（Qizou）事务类型常量
 * RFC 0038/0042: 启奏-圣旨架构
 *
 * 启奏（Qizou）：服务向李世民（中央路由器）汇报的事务
 */
export const QizouMatters = {
    // 袁天罡 - 偏好路径持久化完成（跨部门协调）
    ADD_PATH_COMPLETED: "add_path_completed",
    REMOVE_PATH_COMPLETED: "remove_path_completed",

    // 袁天罡 - 扫描事件相关
    SCAN_READY: "scan_ready",
    SCAN_FAILED: "scan_failed",
    SCAN_PROGRESS: "scan_progress", // ✅ RFC 0057: 扫描进度更新事件
    SCAN_DIRECTORY_DISCOVERED: "scan_directory_discovered", // ✅ RFC 0136: 千里眼发现直属子目录
    WATCH_SCAN_QUEUE_ADD: "watch_scan_queue_add", // ✅ RFC 0137: 文件监视合并批次入扫描队列

    // 尉迟恭 - 扫描队列事件相关
    SCAN_TASK_ADDED: "scan_task_added", // ✅ 扫描任务已添加到队列
    SCAN_QUEUE_EMPTY: "scan_queue_empty", // ✅ RFC 0057: 扫描队列为空，通知清空状态

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

    // ✅ RFC 0057: 状态栏通知（来自主进程的 notify:status IPC 事件）
    STATUS_NOTIFICATION: "status_notification",

    // ✅ RFC 0058: 菜单点击事件（来自主进程的 menu:action IPC 事件）
    MENU_ACTION: "menu_action",
    // ✅ RFC 0058: Shell 操作事件（不需要 store，直接通过 qizou 处理）
    OPEN_EXTERNAL: "open_external", // 打开外部链接
    OPEN_IN_FINDER: "open_in_finder", // 在 Finder 中显示文件
    REQUEST_RESCAN: "request_rescan", // ✅ 百姓请求重新扫描
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
    SCHEDULE_WATCH_FILE_OPERATIONS: "schedule_watch_file_operations",

    // 魏征 - appState管理
    ADD_ROOT: "add_root",
    REMOVE_ROOT: "remove_root",
    UPDATE_FOLDER_TREE: "update_folder_tree",
    FOLDER_DISCOVERED: "folder_discovered",
    FOLDER_REMOVED: "folder_removed",
    ADD_PATHS: "add_paths",
    SWITCH_FOLDER: "switch_folder",

    // ✅ RFC 0057: 虞世南 - 状态栏通知管理
    UPDATE_STATUS_NOTIFICATION: "update_status_notification",

    // ✅ RFC 0058: 长孙无忌 - 菜单点击事件处理
    MENU_ACTION: "menu_action",
    // ✅ RFC 0058: 长孙无忌 - Shell 操作命令
    OPEN_EXTERNAL: "open_external", // 打开外部链接
    OPEN_IN_FINDER: "open_in_finder", // 在 Finder 中显示文件
} as const;

/**
 * 启奏事务类型
 */
export type QizouMatter = (typeof QizouMatters)[keyof typeof QizouMatters];

/**
 * 圣旨命令类型
 */
export type ShengzhiCommand = (typeof ShengzhiCommands)[keyof typeof ShengzhiCommands];
