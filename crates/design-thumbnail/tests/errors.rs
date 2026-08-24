use std::path::Path;

use design_thumbnail::{generate_thumbnail, ThumbnailError, ThumbnailOptions};

fn options() -> ThumbnailOptions {
    ThumbnailOptions {
        max_width: 64,
        max_height: 64,
    }
}

#[test]
fn rejects_zero_thumbnail_dimensions() {
    let output_dir = tempfile::tempdir().expect("create output directory");
    let error = generate_thumbnail(
        Path::new("tests/fixtures/sample.psd"),
        output_dir.path().join("thumbnail.png"),
        ThumbnailOptions {
            max_width: 0,
            max_height: 64,
        },
    )
    .expect_err("zero width must fail");

    assert!(matches!(error, ThumbnailError::InvalidDimensions));
}

#[test]
fn rejects_unsupported_source_extension() {
    let output_dir = tempfile::tempdir().expect("create output directory");
    let error = generate_thumbnail(
        Path::new("tests/fixtures/sample.png"),
        output_dir.path().join("thumbnail.png"),
        options(),
    )
    .expect_err("unsupported source extension must fail");

    assert!(matches!(
        error,
        ThumbnailError::UnsupportedExtension(extension) if extension == "png"
    ));
}

#[test]
fn rejects_corrupt_psd_without_panicking() {
    let output_dir = tempfile::tempdir().expect("create output directory");
    let source = output_dir.path().join("corrupt.psd");
    std::fs::write(&source, b"not a PSD").expect("write corrupt PSD");

    let error = generate_thumbnail(&source, output_dir.path().join("thumbnail.png"), options())
        .expect_err("corrupt PSD must fail");

    assert!(matches!(error, ThumbnailError::InvalidPsd(_)));
}

#[test]
fn rejects_psb_as_unsupported() {
    let output_dir = tempfile::tempdir().expect("create output directory");
    let source = output_dir.path().join("large-document.psd");
    let mut header = vec![0_u8; 26];
    header[0..4].copy_from_slice(b"8BPS");
    header[4..6].copy_from_slice(&2_u16.to_be_bytes());
    std::fs::write(&source, header).expect("write PSB header");

    let error = generate_thumbnail(&source, output_dir.path().join("thumbnail.png"), options())
        .expect_err("PSB must fail");

    assert!(matches!(error, ThumbnailError::UnsupportedPsd(_)));
}

#[test]
fn rejects_ai_without_pdf_compatibility() {
    let output_dir = tempfile::tempdir().expect("create output directory");
    let source = output_dir.path().join("legacy.ai");
    std::fs::write(&source, b"%!PS-Adobe-3.0").expect("write PostScript AI");

    let error = generate_thumbnail(&source, output_dir.path().join("thumbnail.png"), options())
        .expect_err("non-PDF AI must fail");

    assert!(matches!(error, ThumbnailError::UnsupportedAi(_)));
}

#[test]
fn rejects_corrupt_pdf_compatible_ai_without_panicking() {
    let output_dir = tempfile::tempdir().expect("create output directory");
    let source = output_dir.path().join("corrupt.ai");
    std::fs::write(&source, b"%PDF-1.7\nbroken").expect("write corrupt AI");

    let error = generate_thumbnail(&source, output_dir.path().join("thumbnail.png"), options())
        .expect_err("corrupt AI must fail");

    assert!(matches!(error, ThumbnailError::InvalidAi(_)));
}

#[test]
fn rejects_unsupported_output_extension() {
    let output_dir = tempfile::tempdir().expect("create output directory");
    let error = generate_thumbnail(
        Path::new("tests/fixtures/sample.psd"),
        output_dir.path().join("thumbnail.unsupported"),
        options(),
    )
    .expect_err("unsupported output extension must fail");

    assert!(matches!(error, ThumbnailError::Encode(_)));
}
