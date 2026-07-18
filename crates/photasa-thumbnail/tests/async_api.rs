use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use photasa_thumbnail::{create_thumbnail, remove_thumbnail, ThumbnailRequest};

fn unique_dir() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock before epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("photasa-thumbnail-test-{nanos}"))
}

#[tokio::test]
async fn raw_thumbnail_api_is_async_and_writes_fallback_file() {
    let dir = unique_dir();
    std::fs::create_dir_all(&dir).expect("mkdir");
    let thumbnail = dir.join("thumb.jpg");

    let response = create_thumbnail(ThumbnailRequest {
        path: "/fake/sample.cr2".into(),
        thumbnail: thumbnail.to_string_lossy().to_string(),
        width: Some(64),
        height: Some(48),
        without_enlargement: Some(true),
        preview: None,
        always: Some(true),
    })
    .await;

    assert!(response.success, "{response:?}");
    assert_eq!(response.fallback, Some(true));
    assert!(thumbnail.exists());

    remove_thumbnail(thumbnail.clone())
        .await
        .expect("remove thumbnail");
    assert!(!thumbnail.exists());

    let _ = std::fs::remove_dir_all(dir);
}
