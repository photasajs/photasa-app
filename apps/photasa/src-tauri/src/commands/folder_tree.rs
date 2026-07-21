/*!
 * folder tree / appState 持久化 Tauri commands（RFC 0145，贞观：功能名 command，无 siming adapter）
 */
use photasa_folder_tree::FolderTreeStore;
use serde_json::{json, Value};

/// 持久化 folderTree 并返回 matter-sync payload
#[tauri::command]
pub async fn folder_tree_update(tree: Value) -> Result<Value, String> {
    let store = FolderTreeStore::new();
    store
        .persist_folder_tree(tree.clone())
        .map_err(|e| e.to_string())?;

    Ok(json!({
        "folderTree": tree,
        "persisted": true
    }))
}

/// 启动时恢复完整 appState
#[tauri::command]
pub async fn app_state_restore() -> Result<Value, String> {
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
    async fn folder_tree_update_roundtrip() {
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
