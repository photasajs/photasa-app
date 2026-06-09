/*!
 * 配置命令
 * 管理应用程序配置和照片元数据（.photasa.json 文件）
 * 含文件级 (query/add/remove_config) 与内容级 (RFC 0077-0081)
 */
use std::path::{Path, PathBuf};
use tokio::fs;

use super::photasa_config::{
    self, config_to_json_value, fix_config_sync, parse_config_value, PhotasaConfigData,
    PHOTASA_CONFIG_FILE,
};

/// 将 PhotasaConfig 转为前端期望的 JSON 形状（含 photoList）
pub fn photasa_config_to_json_value(c: &PhotasaConfigData) -> serde_json::Value {
    config_to_json_value(c)
}

/// 查询配置文件路径
/// 在指定目录下查找 .photasa.json 文件
#[tauri::command]
pub async fn query_config(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut config_paths = Vec::new();

    for path in paths {
        let config_path = get_config_path(&path);

        let pattern = format!("{path}/**/{PHOTASA_CONFIG_FILE}");
        match glob::glob(&pattern) {
            Ok(entries) => {
                for path in entries.flatten() {
                    config_paths.push(path.to_string_lossy().to_string());
                }
            }
            Err(_e) => {
                if config_path.exists() {
                    config_paths.push(config_path.to_string_lossy().to_string());
                }
            }
        }
    }

    Ok(config_paths)
}

/// 添加配置
/// 为指定路径创建默认的 .photasa.json 文件
#[tauri::command]
pub async fn add_config(paths: Vec<String>) -> Result<(), String> {
    for path in paths {
        let config_path = get_config_path(&path);

        if !config_path.exists() {
            let default_config = config_to_json_value(&PhotasaConfigData::empty());

            if let Some(parent) = config_path.parent() {
                fs::create_dir_all(parent)
                    .await
                    .map_err(|e| format!("Failed to create directory: {e}"))?;
            }

            let content = serde_json::to_string_pretty(&default_config)
                .map_err(|e| format!("Failed to serialize config: {e}"))?;
            fs::write(&config_path, content)
                .await
                .map_err(|e| format!("Failed to write config: {e}"))?;
        }
    }

    Ok(())
}

/// 移除配置
/// 删除指定路径的 .photasa.json 文件
#[tauri::command]
pub async fn remove_config(paths: Vec<String>) -> Result<(), String> {
    for path in paths {
        let config_path = get_config_path(&path);
        if config_path.exists() {
            fs::remove_file(&config_path)
                .await
                .map_err(|e| format!("Failed to remove config: {e}"))?;
        }
    }

    Ok(())
}

/// 获取配置文件路径
fn get_config_path(folder_path: &str) -> PathBuf {
    photasa_config::config_path_for_folder(folder_path)
}

// ---------- 内容级命令 (RFC 0077-0081) ----------

/// 读取指定文件夹下的 .photasa.json，返回解析后的配置；不存在或无效则返回 null
#[tauri::command]
pub async fn get_photasa_config(folder: String) -> Result<Option<serde_json::Value>, String> {
    let config_path = get_config_path(&folder);
    if !config_path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&config_path)
        .await
        .map_err(|e| format!("读取配置失败: {e}"))?;
    let v: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 JSON 失败: {e}"))?;
    let config = parse_config_value(&v);
    Ok(Some(photasa_config_to_json_value(&config)))
}

/// 将照片路径加入对应文件夹的 photoList（去重）；配置文件不存在则先创建
#[tauri::command]
pub async fn add_to_photo_list(photo_path: String) -> Result<(), String> {
    let folder = Path::new(&photo_path)
        .parent()
        .ok_or("无效的照片路径")?
        .to_string_lossy()
        .to_string();
    tokio::task::spawn_blocking(move || photasa_config::add_photo_to_folder_list(&folder, &photo_path))
        .await
        .map_err(|e| format!("任务失败: {e}"))??;
    Ok(())
}

/// 从包含该照片的配置中移除该路径，写回并返回被修改的配置路径与当前配置
#[tauri::command]
pub async fn remove_from_photo_list(photo_path: String) -> Result<serde_json::Value, String> {
    let folder = Path::new(&photo_path)
        .parent()
        .ok_or("无效的照片路径")?
        .to_string_lossy()
        .to_string();
    let config_path = get_config_path(&folder);
    if !config_path.exists() {
        return Ok(serde_json::json!({ "path": config_path.to_string_lossy(), "config": null }));
    }

    let photo_path_clone = photo_path.clone();
    let config = tokio::task::spawn_blocking(move || {
        let mut config = photasa_config::read_config_sync(&folder)?.unwrap_or_else(PhotasaConfigData::empty);
        let file_name = Path::new(&photo_path_clone)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&photo_path_clone)
            .replace('\\', "/");
        config.photo_list.retain(|p| p.path != file_name);
        config.last_modified = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        photasa_config::write_config_sync(&folder, &config)?;
        Ok::<PhotasaConfigData, String>(config)
    })
    .await
    .map_err(|e| format!("任务失败: {e}"))??;

    Ok(serde_json::json!({
        "path": config_path.to_string_lossy(),
        "config": photasa_config_to_json_value(&config)
    }))
}

/// 将指定文件夹下的 .photasa.json 的 photoList 置空并写回
#[tauri::command]
pub async fn reset_photasa_config(folder: String) -> Result<(), String> {
    let config_path = get_config_path(&folder);
    if !config_path.exists() {
        return Ok(());
    }
    let content = fs::read_to_string(&config_path)
        .await
        .map_err(|e| format!("读取配置失败: {e}"))?;
    let v: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("解析失败: {e}"))?;
    let mut config = parse_config_value(&v);
    config.photo_list.clear();
    config.last_modified = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("时间错误: {e}"))?
        .as_millis() as i64;
    let content = serde_json::to_string_pretty(&photasa_config_to_json_value(&config))
        .map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&config_path, content)
        .await
        .map_err(|e| format!("写入配置失败: {e}"))?;
    Ok(())
}

/// 规范化 photoList（去重、统一为 Electron Photo 对象）并写回
#[tauri::command]
pub async fn fix_photasa_config(folder: String) -> Result<(), String> {
    let folder_clone = folder.clone();
    tokio::task::spawn_blocking(move || fix_config_sync(&folder_clone))
        .await
        .map_err(|e| format!("任务失败: {e}"))??;
    Ok(())
}
