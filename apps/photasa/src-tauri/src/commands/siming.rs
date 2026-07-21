/*!
 * 司命 Tauri commands — RFC 0145：`photasa-folder-tree` crate，不经 zouwu Adapter
 *
 * command 名保留 siming_*（贞观拟人化 IPC）；实现 crate 跟功能命名。
 */
use photasa_folder_tree::FolderTreeStore;
use serde_json::{json, Value};

/// 持久化 folderTree 并返回册库同步所需 payload
#[tauri::command]
pub async fn siming_update_folder_tree(tree: Value) -> Result<Value, String> {
    let store = FolderTreeStore::new();
    store
        .persist_folder_tree(tree.clone())
        .map_err(|e| e.to_string())?;

    Ok(json!({
        "folderTree": tree,
        "persisted": true
    }))
}

/// 恢复完整 appState（启动时 restore_app_state 奏折）
#[tauri::command]
pub async fn siming_restore_app_state() -> Result<Value, String> {
    let store = FolderTreeStore::new();
    store.restore_app_state().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use photasa_folder_tree::FolderTreeStore;
    use serde_json::json;
    use std::path::PathBuf;

    #[tokio::test]
    async fn siming_update_folder_tree_roundtrip() {
        let path = std::env::temp_dir().join(format!(
            "photasa-folder-tree-cmd-{}.json",
            uuid::Uuid::new_v4()
        ));
        let store = FolderTreeStore::with_path(PathBuf::from(&path));
        let tree = json!([{
            "key": "/Volumes/SUCAI/Test",
            "title": "/Volumes/SUCAI/Test",
            "children": [{
                "key": "/Volumes/SUCAI/Test/2026",
                "title": "2026",
                "children": []
            }]
        }]);

        store.persist_folder_tree(tree.clone()).unwrap();

        let restored = store.restore_app_state().unwrap();
        assert_eq!(restored["folderTree"], tree);
    }
}
