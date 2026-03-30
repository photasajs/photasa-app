/*!
 * 目录与对话框命令 (RFC 0084-0087, 0094)
 * choose_directory, choose_directories, get_directory, sub_folders, check_photasa_config
 */
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use tauri_plugin_dialog::DialogExt;
use tokio::fs;

/// 应用内存储的目录名 -> 路径（与 Electron get-directory 语义一致）
pub struct DirectoryStore(pub Mutex<HashMap<String, String>>);

/// 打开原生文件夹选择器，返回选中路径或 null（取消）
#[tauri::command]
pub async fn choose_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = tokio::task::spawn_blocking(move || {
        app.dialog()
            .file()
            .blocking_pick_folder()
            .and_then(|fp| fp.into_path().ok())
            .map(|pb| pb.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("选择目录任务异常: {e}"))?;
    Ok(path)
}

/// 与 Electron `chooseDirectories` 返回形状一致：`{ filePaths: string[] }`
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChooseDirectoriesResult {
    pub file_paths: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChooseDirectoriesArgs {
    #[serde(default = "default_multi_select")]
    pub multi_select: bool,
}

fn default_multi_select() -> bool {
    true
}

/// 单选或多选文件夹（RFC 0094）；取消时 `filePaths` 为空数组
#[tauri::command]
pub async fn choose_directories(
    app: tauri::AppHandle,
    args: ChooseDirectoriesArgs,
) -> Result<ChooseDirectoriesResult, String> {
    let multi = args.multi_select;
    tokio::task::spawn_blocking(move || {
        let picked = if multi {
            app.dialog()
                .file()
                .blocking_pick_folders()
                .unwrap_or_default()
        } else {
            match app.dialog().file().blocking_pick_folder() {
                Some(p) => vec![p],
                None => vec![],
            }
        };
        let file_paths = picked
            .into_iter()
            .filter_map(|fp| fp.into_path().ok())
            .map(|pb| pb.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        Ok(ChooseDirectoriesResult { file_paths })
    })
    .await
    .map_err(|e| format!("选择目录任务异常: {e}"))?
}

/// 根据名称返回已存储的目录路径；无则返回 null
#[tauri::command]
pub fn get_directory(name: String, state: tauri::State<DirectoryStore>) -> Result<Option<String>, String> {
    let store = state.0.lock().map_err(|e| format!("锁异常: {e}"))?;
    Ok(store.get(&name).cloned())
}

/// 存储目录路径到指定名称（供 get_directory 查询）
#[tauri::command]
pub fn set_directory(name: String, path: String, state: tauri::State<DirectoryStore>) -> Result<(), String> {
    let mut store = state.0.lock().map_err(|e| format!("锁异常: {e}"))?;
    store.insert(name, path);
    Ok(())
}

/// 列出指定路径下的直接子目录（仅一层）
#[tauri::command]
pub async fn sub_folders(folder_path: String) -> Result<Vec<String>, String> {
    let mut sub = Vec::new();
    let mut entries = fs::read_dir(&folder_path)
        .await
        .map_err(|e| format!("读取目录失败: {e}"))?;
    while let Some(entry) = entries.next_entry().await.map_err(|e| format!("遍历目录失败: {e}"))? {
        if let Ok(meta) = entry.metadata().await {
            if meta.is_dir() {
                sub.push(entry.path().to_string_lossy().into_owned());
            }
        }
    }
    sub.sort();
    Ok(sub)
}

/// 检查文件夹是否含有有效 .photasa.json（存在且可解析含 photoList）
#[tauri::command]
pub async fn check_photasa_config(folder_path: String) -> Result<bool, String> {
    let config_path = Path::new(&folder_path).join(".photasa.json");
    if !config_path.exists() {
        return Ok(false);
    }
    let content = fs::read_to_string(&config_path)
        .await
        .map_err(|e| format!("读取配置失败: {e}"))?;
    let v: serde_json::Value = serde_json::from_str(&content).map_err(|_| "无效 JSON".to_string())?;
    Ok(v.get("photoList").map(|a| a.is_array()).unwrap_or(false))
}
