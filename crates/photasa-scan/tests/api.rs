use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use photasa_scan::media::is_photasa_media_file;
use photasa_scan::strategy::{
    decide_scan_strategy_with_config, should_process_file_with_config, ScanStrategy,
};
use photasa_types::{PhotasaConfigPhoto, PhotasaConfigView};

#[derive(Default)]
struct TestConfigView {
    exists: bool,
    photos: Vec<String>,
    fail: bool,
}

impl PhotasaConfigView for TestConfigView {
    fn has_config(&self, _folder: &str) -> bool {
        self.exists
    }

    fn photo_list(&self, _folder: &str) -> Result<Option<Vec<PhotasaConfigPhoto>>, String> {
        if self.fail {
            return Err("boom".into());
        }
        if !self.exists {
            return Ok(None);
        }
        Ok(Some(
            self.photos
                .iter()
                .map(|path| PhotasaConfigPhoto { path: path.clone() })
                .collect(),
        ))
    }
}

fn temp_dir(name: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock before epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("photasa-scan-api-{name}-{nanos}"));
    fs::create_dir_all(&dir).expect("mkdir");
    dir
}

#[test]
fn strategy_uses_config_view_not_tauri_config() {
    let view = TestConfigView {
        exists: true,
        photos: vec!["a.jpg".into()],
        fail: false,
    };

    assert!(!should_process_file_with_config(
        &view,
        "/album/a.jpg",
        "scan"
    ));
    assert!(should_process_file_with_config(
        &view,
        "/album/b.jpg",
        "scan"
    ));

    let decision = decide_scan_strategy_with_config(&view, "/album", "scan");
    assert_eq!(decision.strategy, ScanStrategy::Skip);
}

#[test]
fn file_media_guard_reuses_import_classifier_extensions() {
    let dir = temp_dir("media");
    let video = dir.join("clip.wmv");
    fs::write(&video, b"x").expect("write");

    assert!(is_photasa_media_file(&video));

    let _ = fs::remove_dir_all(dir);
}
