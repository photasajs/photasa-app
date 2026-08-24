//! PSD and PDF-compatible AI thumbnail generation.

mod ai;
mod error;
mod output;
mod psd;

use std::path::Path;

pub use error::ThumbnailError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ThumbnailOptions {
    pub max_width: u32,
    pub max_height: u32,
}

pub fn generate_thumbnail(
    source: impl AsRef<Path>,
    destination: impl AsRef<Path>,
    options: ThumbnailOptions,
) -> Result<(), ThumbnailError> {
    if options.max_width == 0 || options.max_height == 0 {
        return Err(ThumbnailError::InvalidDimensions);
    }

    let source = source.as_ref();
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    let image = match extension.as_str() {
        "psd" => psd::decode(source)?,
        "ai" => ai::decode(source, options)?,
        _ => return Err(ThumbnailError::UnsupportedExtension(extension)),
    };

    output::save(image, destination.as_ref(), options)
}
