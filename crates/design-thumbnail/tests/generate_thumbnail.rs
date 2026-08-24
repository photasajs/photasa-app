use std::path::Path;

use design_thumbnail::{generate_thumbnail, ThumbnailOptions};

fn assert_thumbnail(source: &Path, extension: &str) {
    let output_dir = tempfile::tempdir().expect("create output directory");
    let destination = output_dir.path().join(format!("thumbnail.{extension}"));

    generate_thumbnail(
        source,
        &destination,
        ThumbnailOptions {
            max_width: 64,
            max_height: 64,
        },
    )
    .expect("generate thumbnail");

    let thumbnail = image::open(&destination).expect("decode generated thumbnail");
    assert!(thumbnail.width() > 0);
    assert!(thumbnail.height() > 0);
    assert!(thumbnail.width() <= 64);
    assert!(thumbnail.height() <= 64);
}

#[test]
fn generates_bounded_thumbnail_from_real_psd() {
    assert_thumbnail(Path::new("tests/fixtures/sample.psd"), "png");
}

#[test]
fn generates_bounded_thumbnail_from_real_pdf_compatible_ai() {
    assert_thumbnail(Path::new("tests/fixtures/sample.ai"), "png");
}

#[test]
fn generates_bounded_jpeg_thumbnail() {
    assert_thumbnail(Path::new("tests/fixtures/sample.psd"), "jpg");
}
