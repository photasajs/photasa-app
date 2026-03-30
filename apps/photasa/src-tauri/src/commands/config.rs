/*!
 * 配置命令
 * 管理应用程序配置和照片元数据（.photasa.json 文件）
 * 含文件级 (query/add/remove_config) 与内容级 (RFC 0077-0081)
 */
use std::path::{Path, PathBuf};
use tokio::fs;
use serde::{Deserialize, Serialize};

/// .photasa.json 内容结构（与前端 getPhotasaConfig 一致）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotasaConfig {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub photo_list: Vec<String>,
    #[serde(default)]
    pub last_modified: i64,
}

impl PhotasaConfig {
    fn default_config() -> Self {
        PhotasaConfig {
            version: "1.0".to_string(),
            photo_list: Vec::new(),
            last_modified: 0,
        }
    }
}

// serde 默认将 JSON 的 "photoList" 映射为 photo_list
const PHOTASA_JSON_PHOTO_LIST_KEY: &str = "photoList";

/// 从 JSON Value 解析 PhotasaConfig（兼容 photoList 键名）
fn parse_photasa_config(v: &serde_json::Value) -> Result<PhotasaConfig, String> {
    let photo_list = v
        .get(PHOTASA_JSON_PHOTO_LIST_KEY)
        .or_else(|| v.get("photo_list"))
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(String::from))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let version = v
        .get("version")
        .and_then(|x| x.as_str())
        .unwrap_or("1.0")
        .to_string();
    let last_modified = v.get("lastModified").or_else(|| v.get("last_modified")).and_then(|x| x.as_i64()).unwrap_or(0);
    Ok(PhotasaConfig {
        version,
        photo_list,
        last_modified,
    })
}

/// 将 PhotasaConfig 转为前端期望的 JSON 形状（含 photoList）
pub fn photasa_config_to_json_value(c: &PhotasaConfig) -> serde_json::Value {
    serde_json::json!({
        "version": c.version,
        "photoList": c.photo_list,
        "lastModified": c.last_modified
    })
}

/// 查询配置文件路径
/// 在指定目录下查找 .photasa.json 文件
#[tauri::command]
pub async fn query_config(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut config_paths = Vec::new();
    
    for path in paths {
        let config_path = get_config_path(&path);
        
        // 使用 glob 模式查找所有 .photasa.json 文件
        let pattern = format!("{path}/**/.photasa.json");
        match glob::glob(&pattern) {
            Ok(entries) => {
                for path in entries.flatten() {
                    config_paths.push(path.to_string_lossy().to_string());
                }
            }
            Err(_e) => {
                // 如果 glob 失败，至少检查根目录
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
        
        // 如果配置文件不存在，创建默认配置
        if !config_path.exists() {
            let default_config = serde_json::json!({
                "version": "1.0",
                "photoList": [],
                "lastModified": 0
            });
            
            // 确保目录存在
            if let Some(parent) = config_path.parent() {
                fs::create_dir_all(parent).await
                    .map_err(|e| format!("Failed to create directory: {e}"))?;
            }
            
            // 写入配置文件
            let content = serde_json::to_string_pretty(&default_config)
                .map_err(|e| format!("Failed to serialize config: {e}"))?;
            fs::write(&config_path, content).await
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
            fs::remove_file(&config_path).await
                .map_err(|e| format!("Failed to remove config: {e}"))?;
        }
    }
    
    Ok(())
}

/// 获取配置文件路径
fn get_config_path(folder_path: &str) -> PathBuf {
    Path::new(folder_path).join(".photasa.json")
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
    let v: serde_json::Value = serde_json::from_str(&content).map_err(|e| format!("解析 JSON 失败: {e}"))?;
    let config = parse_photasa_config(&v).map_err(|e| format!("配置格式错误: {e}"))?;
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
    let config_path = get_config_path(&folder);
    let mut config = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .await
            .map_err(|e| format!("读取配置失败: {e}"))?;
        let v: serde_json::Value = serde_json::from_str(&content).map_err(|e| format!("解析失败: {e}"))?;
        parse_photasa_config(&v)?
    } else {
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("创建目录失败: {e}"))?;
        }
        PhotasaConfig::default_config()
    };
    let normalized = photo_path.replace('\\', "/");
    if !config.photo_list.contains(&normalized) {
        config.photo_list.push(normalized);
    }
    config.last_modified = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let content = serde_json::to_string_pretty(&photasa_config_to_json_value(&config))
        .map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&config_path, content)
        .await
        .map_err(|e| format!("写入配置失败: {e}"))?;
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
    let content = fs::read_to_string(&config_path)
        .await
        .map_err(|e| format!("读取配置失败: {e}"))?;
    let v: serde_json::Value = serde_json::from_str(&content).map_err(|e| format!("解析失败: {e}"))?;
    let mut config = parse_photasa_config(&v)?;
    let normalized = photo_path.replace('\\', "/");
    config.photo_list.retain(|p| p != &normalized);
    config.last_modified = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let content = serde_json::to_string_pretty(&photasa_config_to_json_value(&config))
        .map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&config_path, content)
        .await
        .map_err(|e| format!("写入配置失败: {e}"))?;
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
    let v: serde_json::Value = serde_json::from_str(&content).map_err(|e| format!("解析失败: {e}"))?;
    let mut config = parse_photasa_config(&v)?;
    config.photo_list.clear();
    config.last_modified = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let content = serde_json::to_string_pretty(&photasa_config_to_json_value(&config))
        .map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&config_path, content)
        .await
        .map_err(|e| format!("写入配置失败: {e}"))?;
    Ok(())
}

/// 规范化 photoList（去重、统一路径格式）并写回
#[tauri::command]
pub async fn fix_photasa_config(folder: String) -> Result<(), String> {
    let config_path = get_config_path(&folder);
    if !config_path.exists() {
        return Ok(());
    }
    let content = fs::read_to_string(&config_path)
        .await
        .map_err(|e| format!("读取配置失败: {e}"))?;
    let v: serde_json::Value = serde_json::from_str(&content).map_err(|e| format!("解析失败: {e}"))?;
    let mut config = parse_photasa_config(&v)?;
    // 去重并统一为 / 分隔
    let mut seen = std::collections::HashSet::new();
    config.photo_list = config
        .photo_list
        .into_iter()
        .map(|p| p.replace('\\', "/"))
        .filter(|p| seen.insert(p.clone()))
        .collect();
    config.last_modified = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let content = serde_json::to_string_pretty(&photasa_config_to_json_value(&config))
        .map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&config_path, content)
        .await
        .map_err(|e| format!("写入配置失败: {e}"))?;
    Ok(())
}
